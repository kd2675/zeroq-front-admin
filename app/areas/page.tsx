import { Suspense } from "react";
import { AreaManagementScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function AreasPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AreaManagementScreen />
    </Suspense>
  );
}
