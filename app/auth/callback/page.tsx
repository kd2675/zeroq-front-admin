"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ensureAccessToken, getUserFromToken, isManagerOrAdmin, logout } from "@/app/lib/auth";
import { consumePendingPath } from "@/app/lib/authRouting";
import { initializeProfile } from "@/app/lib/profile";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const failureQuery = buildOAuthFailureQuery(window.location.search);
    if (failureQuery) {
      router.replace(`/login?${failureQuery}`);
      return;
    }

    let cancelled = false;

    void (async () => {
      const token = await ensureAccessToken();
      if (cancelled) {
        return;
      }
      if (!token) {
        consumePendingPath();
        router.replace("/login?loginError=session_restore_failed");
        return;
      }

      const user = getUserFromToken(token);
      if (!isManagerOrAdmin(user?.role)) {
        await logout();
        consumePendingPath();
        router.replace("/login?denied=1");
        return;
      }

      const profileResult = await initializeProfile(token);
      if (cancelled) {
        return;
      }
      if (profileResult.error) {
        await logout();
        consumePendingPath();
        router.replace("/login?loginError=profile_initialize_failed");
        return;
      }

      router.replace(consumePendingPath());
    })().catch(async () => {
      await logout().catch(() => undefined);
      consumePendingPath();
      if (!cancelled) {
        router.replace("/login?loginError=processing_failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4" aria-live="polite">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" aria-hidden="true" />
        <h1 className="mt-5 text-xl font-bold text-slate-900">관리자 로그인을 마무리하고 있습니다</h1>
        <p className="mt-2 text-sm text-slate-600">권한과 세션을 확인한 뒤 이전 화면으로 이동합니다.</p>
      </section>
    </main>
  );
}

function buildOAuthFailureQuery(search: string): string | null {
  const callbackQuery = new URLSearchParams(search);
  if (!callbackQuery.has("error") && !callbackQuery.has("errorCode")) {
    return null;
  }
  const loginQuery = new URLSearchParams();
  ["error", "errorCode", "provider"].forEach((key) => {
    const value = callbackQuery.get(key);
    if (value) {
      loginQuery.set(key, value);
    }
  });
  return loginQuery.toString();
}
