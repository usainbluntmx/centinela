// Patrón de seguridad tipo guilloché, como el de cheques y billetes
export function Guilloche({ lines = 14, height = 120 }: { lines?: number; height?: number }) {
    const width = 1200;
    const paths = Array.from({ length: lines }, (_, i) => {
      const phase = (i / lines) * Math.PI * 2;
      const amp = height * 0.32;
      const mid = height / 2;
      let d = "";
      for (let x = 0; x <= width; x += 6) {
        const t = (x / width) * Math.PI * 8;
        const y = mid + amp * Math.sin(t + phase) * Math.cos(t / 3.7 - phase / 2);
        d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)} `;
      }
      return d;
    });
    return (
      <svg className="guilloche" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  }