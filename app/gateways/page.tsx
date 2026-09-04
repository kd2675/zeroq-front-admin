import { Suspense } from "react";
import { GatewaysScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/gateways` route. 등록 gateway의 연결 상태와 부하를 관리한다. */
export default function GatewaysPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GatewaysScreen />
    </Suspense>
  );
}
