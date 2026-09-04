import type { ResponseEnvelope } from "@/app/types/response";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "direct";
const DEFAULT_GATEWAY_API_BASE = "http://localhost:8080";
const DEFAULT_DIRECT_ZEROQ_API_BASE = "http://localhost:20180";
const DEFAULT_DIRECT_AUTH_API_BASE = "http://localhost:9000";

export const IS_GATEWAY_MODE = API_MODE === "gateway";

export const API_BASE =
  process.env.NEXT_PUBLIC_ZEROQ_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (IS_GATEWAY_MODE ? DEFAULT_GATEWAY_API_BASE : DEFAULT_DIRECT_ZEROQ_API_BASE);
export const ADMIN_API_BASE =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? API_BASE;
export const AUTH_API_BASE =
  process.env.NEXT_PUBLIC_AUTH_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (IS_GATEWAY_MODE ? DEFAULT_GATEWAY_API_BASE : DEFAULT_DIRECT_AUTH_API_BASE);
export const ZEROQ_ADMIN_CLIENT_ID =
  process.env.NEXT_PUBLIC_CLIENT_ID ?? "zeroq-front-admin";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  code?: number | string;
  message?: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  baseUrl?: string;
};

function isEnvelope<T>(value: unknown): value is ResponseEnvelope<T> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.success === "boolean" &&
    (typeof record.code === "number" || typeof record.code === "string") &&
    typeof record.message === "string"
  );
}

function parseResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Gateway 또는 분리된 관리자 API base의 공통 응답 envelope를 ApiResult로 정규화한다. */
async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const method = options.method ?? "GET";
  const baseUrl = options.baseUrl ?? API_BASE;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      credentials: options.credentials ?? "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const parsed = parseResponseBody(text);

    if (isEnvelope<T>(parsed)) {
      if (response.ok && parsed.success) {
        return {
          ok: true,
          status: response.status,
          data: parsed.data ?? null,
          code: parsed.code,
          message: parsed.message,
        };
      }

      return {
        ok: false,
        status: response.status,
        data: null,
        code: parsed.code,
        message: parsed.message,
      };
    }

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        data: (parsed as T) ?? null,
      };
    }

    return {
      ok: false,
      status: response.status,
      data: null,
      message:
        (typeof parsed === "string" && parsed.trim()) ||
        response.statusText ||
        "요청 처리에 실패했습니다.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        ok: false,
        status: 0,
        data: null,
        message: error.message,
      };
    }

    return {
      ok: false,
      status: 0,
      data: null,
      message: "알 수 없는 네트워크 오류가 발생했습니다.",
    };
  }
}

export function postJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "POST", body, headers });
}

/** 로그인·회원가입·refresh·logout 요청을 분리된 인증 서버로 보낸다. */
export function postAuthJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, {
    method: "POST",
    body,
    headers,
    baseUrl: AUTH_API_BASE,
  });
}

export function getJson<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "GET", headers });
}

export function putJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "PUT", body, headers });
}

export function patchJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "PATCH", body, headers });
}

export function deleteJson<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "DELETE", headers });
}

/** 관리자 콘솔 read API를 NEXT_PUBLIC_ADMIN_API_URL 기준으로 호출한다. */
export function getAdminJson<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, {
    method: "GET",
    headers,
    baseUrl: ADMIN_API_BASE,
  });
}

/** 관리자 콘솔 설정·원장 갱신 API를 관리자 base URL로 호출한다. */
export function putAdminJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, {
    method: "PUT",
    body,
    headers,
    baseUrl: ADMIN_API_BASE,
  });
}

/** 관리자 공간·게이트웨이 생성 API를 관리자 base URL로 호출한다. */
export function postAdminJson<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, {
    method: "POST",
    body,
    headers,
    baseUrl: ADMIN_API_BASE,
  });
}
