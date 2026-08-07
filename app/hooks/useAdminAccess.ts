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
import { buildLoginPath } from "@/app/lib/authRouting";

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
      router.replace(buildLoginPath(`${pathname}${search ? `?${search}` : ""}`));
      return;
    }

    if (!allowed) {
      void logout();
      router.replace(buildLoginPath(`${pathname}${search ? `?${search}` : ""}`, { denied: true }));
    }
  }, [allowed, authStatus, isHydrated, pathname, router, search]);

  const resolveAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const token = await ensureAccessToken();
    if (!token) {
      router.replace(buildLoginPath(`${pathname}${search ? `?${search}` : ""}`, { expired: true }));
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
