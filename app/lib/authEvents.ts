import type { AuthExpireReason } from "@/app/lib/auth";

type AuthExpireListener = (reason: AuthExpireReason) => void;
type AuthChangeListener = () => void;

const authExpireListeners = new Set<AuthExpireListener>();
const authChangeListeners = new Set<AuthChangeListener>();

export function onAuthExpired(listener: AuthExpireListener): () => void {
  authExpireListeners.add(listener);
  return () => authExpireListeners.delete(listener);
}

export function emitAuthExpired(reason: AuthExpireReason): void {
  authExpireListeners.forEach((listener) => listener(reason));
}

export function onAuthChanged(listener: AuthChangeListener): () => void {
  authChangeListeners.add(listener);
  return () => authChangeListeners.delete(listener);
}

export function emitAuthChanged(): void {
  authChangeListeners.forEach((listener) => listener());
}
