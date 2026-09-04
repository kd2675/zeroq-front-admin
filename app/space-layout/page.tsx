import { redirect } from "next/navigation";

/** 이전 `/space-layout` 링크를 현재 공간 관리 진입점 `/areas`로 연결한다. */
export default function SpaceLayoutPage() {
  redirect("/areas");
}
