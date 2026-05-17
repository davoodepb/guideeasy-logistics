// Password-protected session. Stored in localStorage.
export type Session = { name: string; phone: string; authenticated: boolean };

const KEY = "prudencio_session";
const APP_PASSWORD = "Rpavg5n";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.authenticated ? s : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession()?.authenticated === true;
}

export function authenticate(password: string): boolean {
  return password === APP_PASSWORD;
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify({ ...s, authenticated: true }));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
