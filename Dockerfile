FROM node:24-slim
WORKDIR /app

# Frontend: dependencias y build
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web/ web/
RUN cd web && npm run build

# Backend: dependencias y código
COPY services/package.json services/package-lock.json services/
RUN cd services && npm ci
COPY services/ services/

WORKDIR /app/services
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "src/server.ts"]