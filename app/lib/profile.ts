import { postJson } from "@/app/lib/api";

export type ProfileSummary = {
  profileId: number;
  userKey: string;
  displayName: string;
  tagline?: string;
  profileColor?: string;
};

export type ProfileInitializeResult = {
  data: ProfileSummary | null;
  error?: string;
};

export async function initializeProfile(
  accessToken: string,
): Promise<ProfileInitializeResult> {
  const result = await postJson<ProfileSummary>(
    "/api/zeroq/v1/admin/profile/initialize",
    {},
    { Authorization: `Bearer ${accessToken}` },
  );

  if (!result.ok || !result.data) {
    return {
      data: null,
      error: result.message ?? "관리자 프로필 초기화에 실패했습니다.",
    };
  }

  return { data: result.data };
}
