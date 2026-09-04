import { Suspense } from "react";
import { LogsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/logs` route. workspace에서 구성한 센서·gateway 운영 이벤트를 조회한다. */
export default function LogsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LogsScreen />
    </Suspense>
  );
}
