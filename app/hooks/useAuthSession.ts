"use client";

import { useEffect, useState } from "react";
import {
  clearAccessToken,
  getAccessToken,
  getUserFromToken,
  isTokenExpired,
  notifyAuthExpired,
  refreshAccessToken,
  scheduleTokenExpiry,
} from "@/app/lib/auth";
import { onAuthChanged } from "@/app/lib/authEvents";
import type { AuthUser } from "@/app/types/auth";

type AuthStatus = "unknown" | "in" | "out";

export default function useAuthSession() {
  const readSnapshot = (): { status: AuthStatus; user: AuthUser | null } => {
    if (typeof window === "undefined") {
      return { status: "unknown", user: null };
    }

    const token = getAccessToken();
    if (!token) {
      return { status: "out", user: null };
    }

    const user = getUserFromToken(token);
    if (!user) {
      return { status: "out", user: null };
    }

    if (user.exp && isTokenExpired(user.exp)) {
      return { status: "out", user: null };
    }

    return { status: "in", user };
  };

  const [snapshot, setSnapshot] = useState(readSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthChanged(() => setSnapshot(readSnapshot()));

    (async () => {
      const initial = readSnapshot();
      if (initial.status === "out") {
        await refreshAccessToken();
      }
      if (cancelled) {
        return;
      }
      setSnapshot(readSnapshot());
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userExp = snapshot.user?.exp;
    if (!userExp) {
      return;
    }

    if (isTokenExpired(userExp)) {
      let cancelled = false;
      (async () => {
        const refreshed = await refreshAccessToken();
        if (cancelled) {
          return;
        }
        if (!refreshed) {
          clearAccessToken();
          notifyAuthExpired("refresh_failed");
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    return scheduleTokenExpiry(() => {
      clearAccessToken();
      notifyAuthExpired("expired");
    }, userExp);
  }, [snapshot.user?.exp]);

  return {
    isHydrated,
    authStatus: snapshot.status,
    user: snapshot.user,
  };
}
