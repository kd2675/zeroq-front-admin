import { Suspense } from "react";
import { SettingsScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SettingsScreen />
    </Suspense>
  );
}
