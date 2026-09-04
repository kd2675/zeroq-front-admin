import { Suspense } from "react";
import { AreaDetailScreen } from "@/app/components/admin/AdminScreens";
import { LoadingScreen } from "@/app/components/admin/AdminUI";

/** `/areas/[spaceId]` route. 경로의 공간 ID를 센서·사용량 상세 화면에 전달한다. */
export default async function AreaDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AreaDetailScreen spaceId={Number(spaceId)} />
    </Suspense>
  );
}
