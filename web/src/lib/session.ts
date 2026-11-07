// Sesión sandbox guardada en el navegador del juez
const KEY = "centinela.session";
let memory: string | null = null;

export function getStoredSession(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function storeSession(id: string) {
  memory = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

export function clearSession() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que limpiar */
  }
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo(0, 0);
}