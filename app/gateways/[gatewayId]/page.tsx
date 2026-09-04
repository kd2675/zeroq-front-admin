import { Suspense } from "react";
import { GatewayDetailScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/gateways/[gatewayId]` route. 선택 gateway의 runtime·연결 센서 상세를 표시한다. */
export default async function GatewayDetailPage({
  params,
}: {
  params: Promise<{ gatewayId: string }>;
}) {
  const { gatewayId } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GatewayDetailScreen gatewayId={gatewayId} />
    </Suspense>
  );
}
