import { Suspense } from "react";
import { GatewayDetailScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

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
