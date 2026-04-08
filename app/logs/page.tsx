import { Suspense } from "react";
import { LogsScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default function LogsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LogsScreen />
    </Suspense>
  );
}
