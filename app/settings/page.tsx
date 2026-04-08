import { Suspense } from "react";
import { SettingsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SettingsScreen />
    </Suspense>
  );
}
