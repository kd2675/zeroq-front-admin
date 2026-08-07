"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import useAuthSession from "@/app/hooks/useAuthSession";
import { getUserFromToken, isManagerOrAdmin, login, logout, setAccessToken } from "@/app/lib/auth";
import { API_BASE } from "@/app/lib/api";
import { rememberPendingPath, sanitizeAuthNextPath } from "@/app/lib/authRouting";
import { initializeProfile } from "@/app/lib/profile";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authStatus, isHydrated, user } = useAuthSession();
  const [username, setUsername] = useState(searchParams.get("username") ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = useMemo(
    () => sanitizeAuthNextPath(searchParams.get("next")),
    [searchParams],
  );
  const queryMessage = resolveQueryMessage(searchParams);

  useEffect(() => {
    if (isSubmitting || !isHydrated || authStatus === "unknown" || authStatus === "out") {
      return;
    }
    if (!isManagerOrAdmin(user?.role)) {
      void logout().finally(() => setMessage("ZeroQ Admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다."));
      return;
    }
    router.replace(nextPath);
  }, [authStatus, isHydrated, isSubmitting, nextPath, router, user?.role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login({ username: normalizedUsername, password });
      if (!result.ok || !result.data?.accessToken) {
        setMessage(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      setAccessToken(result.data.accessToken);
      const loggedInUser = getUserFromToken(result.data.accessToken);
      if (!isManagerOrAdmin(loggedInUser?.role)) {
        await logout();
        setMessage("ZeroQ Admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다.");
        return;
      }

      const profileResult = await initializeProfile(result.data.accessToken);
      if (profileResult.error) {
        await logout();
        setMessage("관리자 프로필을 준비하지 못했습니다. 다시 로그인해 주세요.");
        return;
      }
      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startOAuthLogin = (provider: "naver-zeroq-admin" | "kakao-zeroq-admin") => {
    rememberPendingPath(nextPath);
    window.location.replace(`${API_BASE}/oauth2/authorize/${provider}`);
  };

  if (!isHydrated || authStatus === "unknown" || (authStatus === "in" && !isSubmitting)) {
    return <AdminLoginProgress />;
  }

  return (
    <main className="min-h-screen bg-[#eef1f4] px-5 py-8 text-[#18212b]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-xl border border-[#d8dee5] bg-white shadow-[0_24px_64px_rgba(21,31,43,0.12)] lg:grid-cols-[1fr_440px]">
        <div className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-[#18212b] p-8 text-white md:p-12">
          <div className="absolute -right-16 -top-16 size-64 rounded-full border border-white/10" />
          <div className="absolute -right-4 top-12 size-40 rounded-full border border-orange-400/25" />
          <div className="relative">
            <p className="text-xs font-black tracking-[0.24em] text-orange-400">ZEROQ OPERATIONS</p>
            <h1 className="mt-5 max-w-xl break-keep text-4xl font-black leading-tight tracking-[-0.035em] md:text-5xl">
              공간 운영의 현재를
              <br />한 화면에서 통제합니다
            </h1>
            <p className="mt-5 max-w-xl break-keep text-sm leading-7 text-slate-300">
              센서, 게이트웨이, 점유율과 운영 로그를 다루는 관리자 전용 진입점입니다.
              인증 후 요청했던 운영 화면으로 안전하게 돌아갑니다.
            </p>
          </div>
          <div className="relative mt-10 grid gap-3 text-sm sm:grid-cols-3">
            <AdminMetric value="MANAGER" label="매장 운영" />
            <AdminMetric value="ADMIN" label="전체 관리" />
            <AdminMetric value="RETURN" label="경로 복귀" />
          </div>
        </div>

        <div className="flex items-center p-6 md:p-9">
          <form onSubmit={handleSubmit} className="w-full">
            <p className="text-xs font-black tracking-[0.2em] text-orange-600">AUTHORIZED ACCESS</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.025em]">관리자 로그인</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">MANAGER 또는 ADMIN 권한이 있는 계정만 접근할 수 있습니다.</p>

            <div className="mt-6 space-y-3">
              <AdminField label="아이디" name="username" value={username} onChange={setUsername} autoComplete="username" />
              <AdminField label="비밀번호" name="password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
            </div>

            {searchParams.get("signup") === "1" ? (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">회원가입이 완료되었습니다. 로그인해 주세요.</p>
            ) : null}
            {message || queryMessage ? (
              <p role="alert" aria-live="polite" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
                {message ?? queryMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 min-h-12 w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? "확인 중" : "운영 콘솔 로그인"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              연결된 관리자 소셜 계정
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => startOAuthLogin("naver-zeroq-admin")} className="min-h-11 rounded-lg bg-[#03c75a] px-3 py-2 text-sm font-black text-white hover:brightness-95">네이버</button>
              <button type="button" onClick={() => startOAuthLogin("kakao-zeroq-admin")} className="min-h-11 rounded-lg bg-[#fee500] px-3 py-2 text-sm font-black text-[#191919] hover:brightness-95">카카오</button>
            </div>

            <p className="mt-5 text-center text-sm text-slate-600">
              계정이 없나요?{" "}
              <Link href="/signup" className="font-black text-orange-700 hover:underline">MANAGER 회원가입</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function AdminMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-white/20 pl-3">
      <p className="font-mono text-sm font-black text-orange-300">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function AdminField({
  label,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={255}
        className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-600/10"
      />
    </label>
  );
}

function AdminLoginProgress() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f4] px-5" aria-live="polite">
      <section className="text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-600" aria-hidden="true" />
        <p className="mt-4 text-sm font-bold text-slate-600">관리자 권한과 세션을 확인하고 있습니다.</p>
      </section>
    </main>
  );
}

function resolveQueryMessage(searchParams: URLSearchParams): string | null {
  if (searchParams.get("denied") === "1") {
    return "ZeroQ Admin은 MANAGER/ADMIN 계정만 로그인할 수 있습니다.";
  }
  if (searchParams.get("expired") === "1") {
    return "세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  const errorCode = searchParams.get("errorCode");
  const provider = searchParams.get("provider")?.trim().toUpperCase();
  if (errorCode === "oauth_provider_mismatch") {
    const providerLabel = provider === "NAVER" ? "네이버" : provider === "KAKAO" ? "카카오" : "기존 소셜 계정";
    return `${providerLabel} 로그인으로 다시 시도해 주세요.`;
  }
  if (errorCode === "oauth_email_missing") {
    return "소셜 계정의 이메일 제공 동의가 필요합니다.";
  }
  if (errorCode === "oauth_provider_unsupported") {
    return "지원하지 않는 소셜 로그인 방식입니다.";
  }
  switch (searchParams.get("loginError")) {
    case "profile_initialize_failed":
      return "관리자 프로필을 준비하지 못했습니다. 다시 로그인해 주세요.";
    case "session_restore_failed":
      return "소셜 로그인 세션을 확인할 수 없습니다. 다시 시도해 주세요.";
    case "processing_failed":
      return "로그인 정보를 처리하는 중 문제가 발생했습니다. 다시 시도해 주세요.";
    default:
      return searchParams.get("error") ? "소셜 로그인에 실패했습니다. 다시 시도해 주세요." : null;
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#eef1f4]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
