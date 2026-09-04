import { Suspense } from "react";
import { AreaManagementScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/areas` route. 관리 공간 목록과 신규 공간 등록 동선을 제공한다. */
export default function AreasPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AreaManagementScreen />
    </Suspense>
  );
}
