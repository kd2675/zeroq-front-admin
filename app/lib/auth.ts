import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  ManagerSignUpRequest,
} from "@/app/types/auth";
import type { ApiResult } from "@/app/lib/api";
import { postJson } from "@/app/lib/api";
import { emitAuthChanged, emitAuthExpired } from "@/app/lib/authEvents";

const TOKEN_EXPIRY_LEEWAY_SECONDS = 300;
let accessTokenMemory: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function setAccessToken(token: string): void {
  accessTokenMemory = token;
  emitAuthChanged();
}

export function clearAccessToken(): void {
  accessTokenMemory = null;
  emitAuthChanged();
}

export function normalizeRole(role?: string | null): string | null {
  if (!role) {
    return null;
  }
  const normalized = role.trim().toUpperCase();
  return normalized.startsWith("ROLE_") ? normalized.slice(5) : normalized;
}

export function isManagerOrAdmin(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "MANAGER" || normalized === "ADMIN";
}

export type AuthExpireReason = "expired" | "refresh_failed";

export function notifyAuthExpired(reason: AuthExpireReason = "expired"): void {
  emitAuthExpired(reason);
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

export function getUserFromToken(token?: string | null): AuthUser | null {
  const rawToken = token ?? getAccessToken();
  if (!rawToken) {
    return null;
  }

  const parts = rawToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const rawUserId = parsed.userId;
    const userId =
      typeof rawUserId === "number"
        ? rawUserId
        : typeof rawUserId === "string"
          ? Number(rawUserId)
          : undefined;

    return {
      username: typeof parsed.sub === "string" ? parsed.sub : undefined,
      userId: Number.isFinite(userId) ? userId : undefined,
      role: typeof parsed.role === "string" ? parsed.role : undefined,
      exp: typeof parsed.exp === "number" ? parsed.exp : undefined,
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(
  exp?: number,
  leewaySeconds = TOKEN_EXPIRY_LEEWAY_SECONDS,
): boolean {
  if (!exp) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}

export function scheduleTokenExpiry(
  onExpire: () => void,
  exp?: number,
  leewaySeconds = TOKEN_EXPIRY_LEEWAY_SECONDS,
): () => void {
  if (!exp) {
    return () => undefined;
  }
  const now = Math.floor(Date.now() / 1000);
  const delayMs = Math.max((exp - now - leewaySeconds) * 1000, 0);
  const timeoutId = window.setTimeout(onExpire, delayMs);
  return () => window.clearTimeout(timeoutId);
}

export async function login(
  payload: LoginRequest,
): Promise<ApiResult<LoginResponse>> {
  return postJson<LoginResponse>("/auth/login", payload);
}

export async function signUpManager(payload: {
  username: string;
  email: string;
  password: string;
  signupSecret: string;
}): Promise<ApiResult<{ id?: number }>> {
  const requestBody: ManagerSignUpRequest = {
    username: payload.username,
    email: payload.email,
    password: payload.password,
    role: "MANAGER",
    signupSecret: payload.signupSecret,
  };

  return postJson<{ id?: number }>("/api/users", requestBody);
}

export async function logout(): Promise<void> {
  const token = getAccessToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  await postJson<void>("/auth/logout", {}, headers);
}

async function requestRefreshAccessToken(): Promise<string | null> {
  const result = await postJson<LoginResponse>("/auth/refresh", {});
  if (!result.ok || !result.data?.accessToken) {
    return null;
  }
  setAccessToken(result.data.accessToken);
  return result.data.accessToken;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = requestRefreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function ensureAccessToken(): Promise<string | null> {
  if (accessTokenMemory) {
    return accessTokenMemory;
  }
  return refreshAccessToken();
}
