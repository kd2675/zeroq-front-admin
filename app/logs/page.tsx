import { Suspense } from "react";
import { LogsScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

export default function LogsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LogsScreen />
    </Suspense>
  );
}
