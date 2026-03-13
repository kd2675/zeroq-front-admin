import { Suspense } from "react";
import { AreaManagementScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

export default function AreasPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AreaManagementScreen />
    </Suspense>
  );
}
