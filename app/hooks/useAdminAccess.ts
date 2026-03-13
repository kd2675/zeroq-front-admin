"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useAuthSession from "@/app/hooks/useAuthSession";
import {
  clearAccessToken,
  ensureAccessToken,
  isManagerOrAdmin,
  logout,
  normalizeRole,
} from "@/app/lib/auth";

export const ADMIN_PENDING_PATH_KEY = "zeroq_admin_pending_path";

function rememberPendingPath(pathname: string, search: string) {
  if (typeof window === "undefined") {
    return;
  }

  const pendingPath = `${pathname}${search ? `?${search}` : ""}`;
  window.sessionStorage.setItem(ADMIN_PENDING_PATH_KEY, pendingPath);
}

export default function useAdminAccess() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isHydrated, authStatus, user } = useAuthSession();

  const search = searchParams.toString();
  const allowed = isManagerOrAdmin(user?.role);
  const isReady = isHydrated && authStatus === "in" && allowed;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (authStatus !== "in") {
      rememberPendingPath(pathname, search);
      router.replace("/login");
      return;
    }

    if (!allowed) {
      clearAccessToken();
      rememberPendingPath(pathname, search);
      router.replace("/login?denied=1");
    }
  }, [allowed, authStatus, isHydrated, pathname, router, search]);

  const resolveAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const token = await ensureAccessToken();
    if (!token) {
      clearAccessToken();
      rememberPendingPath(pathname, search);
      router.replace("/login?expired=1");
      return null;
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }, [pathname, router, search]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Ignore server logout failures and clear the client session.
    } finally {
      clearAccessToken();
      router.replace("/login");
    }
  }, [router]);

  return {
    isHydrated,
    isReady,
    authStatus,
    user,
    roleLabel: normalizeRole(user?.role) ?? "UNKNOWN",
    resolveAuthHeaders,
    signOut,
  };
}
