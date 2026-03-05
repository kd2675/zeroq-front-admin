import type { ResponseEnvelope } from "@/app/types/response";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
};

function isEnvelope<T>(value: unknown): value is ResponseEnvelope<T> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.success === "boolean" &&
    (typeof record.code === "number" || typeof record.code === "string") &&
    typeof record.message === "string" &&
    "data" in record
  );
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const method = options.method ?? "GET";

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      credentials: options.credentials ?? "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : null;

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
      message: response.statusText || "요청 처리에 실패했습니다.",
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
