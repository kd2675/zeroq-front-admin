"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useAuthSession from "@/app/hooks/useAuthSession";
import {
  ensureAccessToken,
  isManagerOrAdmin,
  logout,
  normalizeRole,
} from "@/app/lib/auth";
import { rememberPendingPath } from "@/app/lib/authRouting";

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
      rememberPendingPath(`${pathname}${search ? `?${search}` : ""}`);
      router.replace("/login");
      return;
    }

    if (!allowed) {
      rememberPendingPath(`${pathname}${search ? `?${search}` : ""}`);
      void logout();
      router.replace("/login?denied=1");
    }
  }, [allowed, authStatus, isHydrated, pathname, router, search]);

  const resolveAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const token = await ensureAccessToken();
    if (!token) {
      rememberPendingPath(`${pathname}${search ? `?${search}` : ""}`);
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
