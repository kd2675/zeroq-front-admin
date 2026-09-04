import { Suspense } from "react";
import { DashboardScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/` route. 전체 운영 요약과 주요 경보를 표시하는 관리자 dashboard다. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardScreen />
    </Suspense>
  );
}
