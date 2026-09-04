import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  ManagerSignUpRequest,
} from "@/app/types/auth";
import type { ApiResult } from "@/app/lib/api";
import {
  IS_GATEWAY_MODE,
  postAuthJson,
  ZEROQ_ADMIN_CLIENT_ID,
} from "@/app/lib/api";
import { emitAuthChanged, emitAuthExpired } from "@/app/lib/authEvents";

const TOKEN_EXPIRY_LEEWAY_SECONDS = 300;
let accessTokenMemory: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let bootstrapRefreshDone = false;
let bootstrapRefreshInFlight: Promise<string | null> | null = null;
let authGeneration = 0;
let explicitlySignedOut = false;

function withClientId(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    "X-Client-Id": ZEROQ_ADMIN_CLIENT_ID,
    ...headers,
  };
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

/** 관리자 access token을 현재 탭 메모리에만 저장하고 인증 구독자에게 알린다. */
export function setAccessToken(token: string): void {
  accessTokenMemory = token;
  explicitlySignedOut = false;
  bootstrapRefreshDone = false;
  authGeneration += 1;
  emitAuthChanged();
}

export function clearAccessToken(): void {
  accessTokenMemory = null;
  bootstrapRefreshDone = false;
  bootstrapRefreshInFlight = null;
  authGeneration += 1;
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

/**
 * Gateway 모드에는 Bearer token만 보내고, 로컬 직결 모드에는 gateway가 주입하던
 * 사용자 식별 헤더를 token claim에서 함께 구성한다.
 */
export function buildServiceAuthHeaders(token: string): Record<string, string> {
  const user = IS_GATEWAY_MODE ? null : getUserFromToken(token);

  return {
    Authorization: `Bearer ${token}`,
    ...(user?.username
      ? { "X-User-Name": encodeURIComponent(user.username) }
      : {}),
    ...(user?.userKey ? { "X-User-Key": user.userKey } : {}),
    ...(user?.role ? { "X-User-Role": user.role } : {}),
  };
}

export type AuthExpireReason = "expired" | "refresh_failed";

export function notifyAuthExpired(reason: AuthExpireReason = "expired"): void {
  emitAuthExpired(reason);
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** UI 역할 분기용 JWT claim을 해석하며 서버의 서명 검증을 대신하지 않는다. */
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
    const rawUserKey = parsed.userKey;
    const userKey = typeof rawUserKey === "string" ? rawUserKey : undefined;

    return {
      username: typeof parsed.sub === "string" ? parsed.sub : undefined,
      userKey,
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

/** zeroq-front-admin client id로 로컬 로그인을 요청한다. */
export async function login(
  payload: LoginRequest,
): Promise<ApiResult<LoginResponse>> {
  return postAuthJson<LoginResponse>("/auth/login", payload, withClientId());
}

/** 가입 비밀키와 MANAGER 역할을 명시해 운영자 계정 생성을 요청한다. */
export async function signUpManager(payload: {
  username: string;
  email: string;
  password: string;
  signupSecret: string;
}): Promise<ApiResult<{ userKey?: string }>> {
  const requestBody: ManagerSignUpRequest = {
    username: payload.username,
    email: payload.email,
    password: payload.password,
    role: "MANAGER",
    signupSecret: payload.signupSecret,
  };

  return postAuthJson<{ userKey?: string }>(
    "/api/users",
    requestBody,
    withClientId(),
  );
}

/** logout 뒤 진행 중 refresh가 관리자 세션을 되살리지 못하도록 인증 세대를 무효화한다. */
export async function logout(): Promise<void> {
  explicitlySignedOut = true;
  authGeneration += 1;
  try {
    await postAuthJson<void>("/auth/logout", {}, withClientId());
  } finally {
    accessTokenMemory = null;
    bootstrapRefreshDone = true;
    bootstrapRefreshInFlight = null;
    emitAuthChanged();
  }
}

/** 관리자 client별 HttpOnly refresh cookie로 access token을 복구한다. */
async function requestRefreshAccessToken(): Promise<string | null> {
  const requestGeneration = authGeneration;
  const result = await postAuthJson<LoginResponse>(
    "/auth/refresh",
    {},
    withClientId(),
  );
  if (!result.ok || !result.data?.accessToken) {
    return null;
  }
  if (requestGeneration !== authGeneration || explicitlySignedOut) {
    return null;
  }
  setAccessToken(result.data.accessToken);
  return result.data.accessToken;
}

/** 동시 refresh 호출을 하나로 합쳐 token rotation 충돌을 줄인다. */
export async function refreshAccessToken(): Promise<string | null> {
  if (explicitlySignedOut) {
    return null;
  }
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = requestRefreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** 메모리 토큰을 우선 사용하고 없을 때 페이지 생명주기당 한 번 cookie 복구를 시도한다. */
export async function ensureAccessToken(): Promise<string | null> {
  if (accessTokenMemory) {
    return accessTokenMemory;
  }
  if (explicitlySignedOut || bootstrapRefreshDone) {
    return null;
  }
  if (bootstrapRefreshInFlight) {
    return bootstrapRefreshInFlight;
  }

  bootstrapRefreshInFlight = refreshAccessToken().finally(() => {
    bootstrapRefreshDone = true;
    bootstrapRefreshInFlight = null;
  });
  return bootstrapRefreshInFlight;
}
