import { Suspense } from "react";
import { SensorDetailScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ sensorId: string }>;
}) {
  const { sensorId } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SensorDetailScreen sensorId={sensorId} />
    </Suspense>
  );
}
