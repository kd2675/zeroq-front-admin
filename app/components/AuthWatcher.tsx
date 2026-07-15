"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthExpired } from "@/app/lib/authEvents";
import { rememberPendingPath } from "@/app/lib/authRouting";

const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/signup";
const CALLBACK_PATH = "/auth/callback";

function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === SIGNUP_PATH || pathname === CALLBACK_PATH;
}

export default function AuthWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      if (isPublicPath(pathname)) {
        return;
      }

      const query = searchParams.toString();
      const pendingPath = `${pathname}${query ? `?${query}` : ""}`;
      rememberPendingPath(pendingPath);
      router.push("/login?expired=1");
    });

    return () => {
      unsubscribe();
    };
  }, [pathname, router, searchParams]);

  return null;
}
