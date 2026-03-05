import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  ManagerSignUpRequest,
} from "@/app/types/auth";
import type { ApiResult } from "@/app/lib/api";
import { postJson } from "@/app/lib/api";

const ACCESS_TOKEN_KEY = "accessToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
