import { Suspense } from "react";
import { DashboardScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardScreen />
    </Suspense>
  );
}
