import { Suspense } from "react";
import { SensorsScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

export default function SensorsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SensorsScreen />
    </Suspense>
  );
}
