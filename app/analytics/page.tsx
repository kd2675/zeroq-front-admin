import { Suspense } from "react";
import { AnalyticsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AnalyticsScreen />
    </Suspense>
  );
}
