import { Suspense } from "react";
import { AreaDetailScreen } from "@/app/components/admin/screens";
import { LoadingScreen } from "@/app/components/admin/ui";

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
