const INTERNAL_ORIGIN = "https://zeroq-admin.internal";

export const ADMIN_PENDING_PATH_KEY = "zeroq_admin_pending_path";

export function sanitizeAuthNextPath(value: string | null): string {
  if (!value) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) {
      return "/";
    }
    const resolved = new URL(decoded, INTERNAL_ORIGIN);
    if (resolved.origin !== INTERNAL_ORIGIN) {
      return "/";
    }
    if (
      resolved.pathname === "/login" ||
      resolved.pathname === "/signup" ||
      resolved.pathname.startsWith("/auth/callback")
    ) {
      return "/";
    }
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return "/";
  }
}

export function buildLoginPath(nextPath: string, options: { denied?: boolean; expired?: boolean } = {}): string {
  const query = new URLSearchParams();
  const safeNextPath = sanitizeAuthNextPath(nextPath);
  if (safeNextPath !== "/") {
    query.set("next", safeNextPath);
  }
  if (options.denied) {
    query.set("denied", "1");
  }
  if (options.expired) {
    query.set("expired", "1");
  }
  const queryString = query.toString();
  return queryString ? `/login?${queryString}` : "/login";
}

export function rememberPendingPath(nextPath: string): void {
  window.sessionStorage.setItem(ADMIN_PENDING_PATH_KEY, sanitizeAuthNextPath(nextPath));
}

export function consumePendingPath(): string {
  const nextPath = sanitizeAuthNextPath(window.sessionStorage.getItem(ADMIN_PENDING_PATH_KEY));
  window.sessionStorage.removeItem(ADMIN_PENDING_PATH_KEY);
  return nextPath;
}
