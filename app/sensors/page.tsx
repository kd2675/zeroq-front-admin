import { Suspense } from "react";
import { SensorsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function SensorsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SensorsScreen />
    </Suspense>
  );
}
