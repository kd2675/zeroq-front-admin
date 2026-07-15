"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ensureAccessToken,
  getUserFromToken,
  isManagerOrAdmin,
  login,
  logout,
  setAccessToken,
} from "@/app/lib/auth";
import { consumePendingPath } from "@/app/lib/authRouting";
import { initializeProfile } from "@/app/lib/profile";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const signupDone = searchParams.get("signup") === "1";
  const denied = searchParams.get("denied") === "1";
  const expired = searchParams.get("expired") === "1";
  const loginError = searchParams.get("loginError");
  const oauthError = searchParams.get("error");
  const oauthErrorCode = searchParams.get("errorCode");
  const oauthProvider = searchParams.get("provider");
  const usernameFromQuery = useMemo(
    () => searchParams.get("username") ?? "",
    [searchParams],
  );

  const [username, setUsername] = useState(usernameFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    resolveOAuthError(oauthErrorCode, oauthProvider, oauthError) ?? resolveLoginError(loginError),
  );
  const [loading, setLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  const routeToPendingOrHome = useCallback(() => {
    router.replace(consumePendingPath());
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const restoredToken = await ensureAccessToken();
      if (cancelled) {
        return;
      }
      if (!restoredToken) {
        setIsRestoring(false);
        return;
      }

      const restoredUser = getUserFromToken(restoredToken);
      if (isManagerOrAdmin(restoredUser?.role)) {
        routeToPendingOrHome();
        return;
      }

      await logout();
      router.replace("/login?denied=1");
    };

    void bootstrap().catch(() => {
      if (!cancelled) {
        setError("로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setIsRestoring(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [routeToPendingOrHome, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ username: username.trim(), password });
      if (!result.ok || !result.data?.accessToken) {
        setError(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      setAccessToken(result.data.accessToken);
      const user = getUserFromToken(result.data.accessToken);
      if (!isManagerOrAdmin(user?.role)) {
        await logout();
        setError("ZeroQ Admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다.");
        return;
      }

      const initializeResult = await initializeProfile(result.data.accessToken);
      if (initializeResult.error) {
        await logout();
        setError("프로필을 준비하지 못했습니다. 다시 로그인해 주세요.");
        return;
      }

      routeToPendingOrHome();
    } catch {
      setError("로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (isRestoring) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4" aria-live="polite">
        <section className="text-center">
          <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-600" aria-hidden="true" />
          <p className="mt-4 text-sm text-slate-600">로그인 상태를 확인하고 있습니다.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          ZeroQ Admin
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">관리자 로그인</h1>
        <p className="mt-2 text-sm text-slate-600">
          매장 관리자(MANAGER) 또는 운영자(ADMIN) 계정만 접근할 수 있습니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              아이디
            </label>
            <input
              id="username"
              type="text"
              required
              maxLength={255}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="manager01"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              maxLength={255}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="********"
            />
          </div>

          {signupDone ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              회원가입이 완료되었습니다. 로그인해 주세요.
            </p>
          ) : null}

          {denied ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              zeroq-front-admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다.
            </p>
          ) : null}

          {expired ? (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              세션이 만료되었습니다. 다시 로그인해 주세요.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-400"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          계정이 없나요?{" "}
          <Link href="/signup" className="font-semibold text-orange-600 hover:underline">
            MANAGER 회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

function resolveLoginError(loginError: string | null): string | null {
  switch (loginError) {
    case "profile_initialize_failed":
      return "프로필을 준비하지 못했습니다. 다시 로그인해 주세요.";
    case "session_restore_failed":
      return "소셜 로그인 세션을 확인할 수 없습니다. 다시 시도해 주세요.";
    case "processing_failed":
      return "로그인 정보를 처리하는 중 문제가 발생했습니다. 다시 시도해 주세요.";
    default:
      return null;
  }
}

function resolveOAuthError(
  errorCode: string | null,
  provider: string | null,
  fallback: string | null,
): string | null {
  if (errorCode === "oauth_provider_mismatch") {
    const normalizedProvider = provider?.trim().toUpperCase();
    const providerLabel = normalizedProvider === "NAVER"
      ? "네이버"
      : normalizedProvider === "KAKAO"
        ? "카카오"
        : null;
    return providerLabel
      ? `${providerLabel}로 가입된 계정입니다. ${providerLabel} 로그인을 이용해 주세요.`
      : "다른 소셜 로그인 방식으로 가입된 계정입니다. 기존 로그인 수단을 이용해 주세요.";
  }
  if (errorCode === "oauth_email_missing") {
    return "소셜 계정의 이메일 제공 동의가 필요합니다.";
  }
  if (errorCode === "oauth_provider_unsupported") {
    return "지원하지 않는 소셜 로그인 방식입니다.";
  }
  return fallback ? "소셜 로그인에 실패했습니다. 다시 시도해 주세요." : null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <LoginPageContent />
    </Suspense>
  );
}
