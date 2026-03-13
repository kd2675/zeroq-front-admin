import { Suspense } from "react";
import { GatewaysScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

export default function GatewaysPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GatewaysScreen />
    </Suspense>
  );
}
