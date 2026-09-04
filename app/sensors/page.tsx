import { Suspense } from "react";
import { SensorsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/sensors` route. 소유 센서 원장과 등록·설치·명령 동선을 제공한다. */
export default function SensorsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SensorsScreen />
    </Suspense>
  );
}
