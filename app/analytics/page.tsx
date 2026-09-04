import { Suspense } from "react";
import { AnalyticsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/analytics` route. workspace의 실측 집계 지표를 분석 화면으로 연결한다. */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AnalyticsScreen />
    </Suspense>
  );
}
