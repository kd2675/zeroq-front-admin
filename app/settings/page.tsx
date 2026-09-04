import { Suspense } from "react";
import { SettingsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/settings` route. 관리자 프로필별 임계값·보존·알림 설정을 편집한다. */
export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SettingsScreen />
    </Suspense>
  );
}
