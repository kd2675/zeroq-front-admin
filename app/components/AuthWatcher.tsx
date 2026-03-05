"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthExpired } from "@/app/lib/authEvents";

const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/signup";
const PENDING_PATH_KEY = "zeroq_admin_pending_path";

function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === SIGNUP_PATH;
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
      window.sessionStorage.setItem(PENDING_PATH_KEY, pendingPath);
      router.push("/login?expired=1");
    });

    return () => {
      unsubscribe();
    };
  }, [pathname, router, searchParams]);

  return null;
}
