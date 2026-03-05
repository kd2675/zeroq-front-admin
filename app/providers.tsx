"use client";

import { Suspense } from "react";
import AuthWatcher from "@/app/components/AuthWatcher";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <AuthWatcher />
      </Suspense>
    </>
  );
}
