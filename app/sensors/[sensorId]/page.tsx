import { Suspense } from "react";
import { SensorDetailScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/sensors/[sensorId]` route. 선택 센서의 상태·배치·최근 측정을 표시한다. */
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
