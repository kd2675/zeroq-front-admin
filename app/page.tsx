"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAccessToken,
  isManagerOrAdmin,
  logout,
  normalizeRole,
} from "@/app/lib/auth";
import type { AuthUser } from "@/app/types/auth";
import useAuthSession from "@/app/hooks/useAuthSession";

export default function HomePage() {
  const router = useRouter();
  const { isHydrated, authStatus, user: sessionUser } = useAuthSession();
  const [user, setUser] = useState<AuthUser | null>(sessionUser);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (authStatus !== "in") {
      router.replace("/login");
      return;
    }
    if (!isManagerOrAdmin(sessionUser?.role)) {
      clearAccessToken();
      router.replace("/login?denied=1");
      return;
    }

    setUser(sessionUser);
  }, [authStatus, isHydrated, router, sessionUser]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout API failure and clear local session
    } finally {
      clearAccessToken();
      router.replace("/login");
    }
  };

  if (!isHydrated || authStatus !== "in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">세션 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <main className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              ZeroQ Admin
            </p>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">관리자 콘솔</h1>
            <p className="mt-2 text-sm text-slate-600">
              로그인된 권한: {normalizeRole(user?.role) ?? "UNKNOWN"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">세션 정보</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Username</dt>
              <dd className="mt-1 font-medium">{user?.username ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">User ID</dt>
              <dd className="mt-1 font-medium">{user?.userId ?? "-"}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
