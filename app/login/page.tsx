"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearAccessToken,
  getAccessToken,
  getUserFromToken,
  isManagerOrAdmin,
  login,
  setAccessToken,
} from "@/app/lib/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenFromQuery = searchParams.get("token");
  const signupDone = searchParams.get("signup") === "1";
  const denied = searchParams.get("denied") === "1";
  const usernameFromQuery = useMemo(
    () => searchParams.get("username") ?? "",
    [searchParams],
  );

  const [username, setUsername] = useState(usernameFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenFromQuery) {
      setAccessToken(tokenFromQuery);
      const user = getUserFromToken(tokenFromQuery);

      if (!isManagerOrAdmin(user?.role)) {
        clearAccessToken();
        router.replace("/login?denied=1");
        return;
      }

      router.replace("/");
      return;
    }

    const existingToken = getAccessToken();
    if (!existingToken) {
      return;
    }

    const user = getUserFromToken(existingToken);
    if (isManagerOrAdmin(user?.role)) {
      router.replace("/");
      return;
    }

    clearAccessToken();
    router.replace("/login?denied=1");
  }, [router, tokenFromQuery]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    const result = await login({ username: username.trim(), password });
    setLoading(false);

    if (!result.ok || !result.data?.accessToken) {
      setError(result.message ?? "로그인에 실패했습니다.");
      return;
    }

    setAccessToken(result.data.accessToken);
    const user = getUserFromToken(result.data.accessToken);
    if (!isManagerOrAdmin(user?.role)) {
      clearAccessToken();
      setError("zeroq-front-admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다.");
      return;
    }

    router.replace("/");
  };

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

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <LoginPageContent />
    </Suspense>
  );
}
