/** Armazenamento tolerante a falhas (navegadores internos podem bloquear). */
export const safeStorage = {
  get(key: string): string | null {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { window.sessionStorage.setItem(key, value); } catch { /* ignora */ }
  },
  remove(key: string) {
    try { window.sessionStorage.removeItem(key); } catch { /* ignora */ }
  },
};
