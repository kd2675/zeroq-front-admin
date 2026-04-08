import { Suspense } from "react";
import { GatewaysScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function GatewaysPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GatewaysScreen />
    </Suspense>
  );
}
