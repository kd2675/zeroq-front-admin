"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAccessToken,
  ensureAccessToken,
  isManagerOrAdmin,
  logout,
  normalizeRole,
} from "@/app/lib/auth";
import { getJson, patchJson, postJson, putJson } from "@/app/lib/api";
import type { AuthUser } from "@/app/types/auth";
import useAuthSession from "@/app/hooks/useAuthSession";

type SensorSnapshot = {
  placeId: number;
  occupiedCount: number;
  activeSensorCount: number;
  occupancyRate: number;
  crowdLevel: string;
  lastMeasuredAt?: string;
  lastCalculatedAt?: string;
  sourceWindowSeconds?: number;
};

type SensorDevice = {
  id: number;
  sensorId: string;
  macAddress: string;
  model: string;
  type: string;
  protocol: string;
  status: string;
  placeId?: number;
  batteryPercent?: number;
  lastHeartbeatAt?: string;
};

type RecentTelemetry = {
  telemetryId: number;
  sensorId: string;
  distanceCm: number;
  occupied: boolean;
  qualityStatus: string;
  measuredAt: string;
  batteryPercent?: number;
};

type SpaceOverview = {
  spaceId: number;
  spaceName: string;
  capacity: number;
  snapshot: SensorSnapshot;
  sensors: SensorDevice[];
  recentTelemetry: RecentTelemetry[];
};

type RegisterForm = {
  sensorId: string;
  macAddress: string;
  model: string;
  type: string;
  protocol: string;
  placeId: string;
};

type CommandForm = {
  sensorId: string;
  commandType: string;
  commandPayload: string;
};

type StatusForm = {
  sensorId: string;
  status: string;
};

const SENSOR_TYPES = ["OCCUPANCY_DETECTION"];
const SENSOR_PROTOCOLS = ["MQTT", "HTTP"];
const SENSOR_COMMAND_TYPES = [
  "REBOOT",
  "SET_THRESHOLD",
  "SET_SAMPLE_INTERVAL",
  "SYNC_TIME",
  "FIRMWARE_UPDATE",
];
const SENSOR_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "DECOMMISSIONED"];

export default function HomePage() {
  const router = useRouter();
  const { isHydrated, authStatus, user: sessionUser } = useAuthSession();
  const [user, setUser] = useState<AuthUser | null>(sessionUser);

  const [placeIdInput, setPlaceIdInput] = useState("1");
  const [overview, setOverview] = useState<SpaceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    sensorId: "",
    macAddress: "",
    model: "ZQ-SENSOR-V1",
    type: SENSOR_TYPES[0],
    protocol: SENSOR_PROTOCOLS[0],
    placeId: "1",
  });

  const [commandForm, setCommandForm] = useState<CommandForm>({
    sensorId: "",
    commandType: SENSOR_COMMAND_TYPES[0],
    commandPayload: "",
  });

  const [statusForm, setStatusForm] = useState<StatusForm>({
    sensorId: "",
    status: SENSOR_STATUSES[0],
  });

  const currentPlaceId = useMemo(() => {
    const parsed = Number(placeIdInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [placeIdInput]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (authStatus !== "in") {
      router.replace("/login");
      return;
    }
    if (!isManagerOrAdmin(sessionUser?.role)) {
      clearAccessToken();
      router.replace("/login?denied=1");
      return;
    }

    setUser(sessionUser);
  }, [authStatus, isHydrated, router, sessionUser]);

  const resolveAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const token = await ensureAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace("/login?expired=1");
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [router]);

  const loadOverview = useCallback(async (placeId: number, recalculate: boolean) => {
    setLoading(true);
    setErrorMessage(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }

    const result = await getJson<SpaceOverview>(
      `/api/zeroq/v1/space-sensors/spaces/${placeId}/overview?recalculate=${recalculate ? "true" : "false"}&telemetryLimit=30`,
      headers,
    );

    if (!result.ok || !result.data) {
      setOverview(null);
      setErrorMessage(result.message ?? "공간 센서 오버뷰를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    setOverview(result.data);
    setRegisterForm((prev) => ({ ...prev, placeId: String(placeId) }));
    setLoading(false);
  }, [resolveAuthHeaders]);

  useEffect(() => {
    if (!isHydrated || authStatus !== "in" || !isManagerOrAdmin(sessionUser?.role)) {
      return;
    }
    void loadOverview(currentPlaceId, true);
  }, [authStatus, currentPlaceId, isHydrated, loadOverview, sessionUser?.role]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout API failure and clear local session
    } finally {
      clearAccessToken();
      router.replace("/login");
    }
  };

  const handleRegisterSensor = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      return;
    }

    const payload = {
      sensorId: registerForm.sensorId,
      macAddress: registerForm.macAddress,
      model: registerForm.model,
      type: registerForm.type,
      protocol: registerForm.protocol,
      placeId: Number(registerForm.placeId),
    };

    const result = await postJson<SensorDevice>("/api/zeroq/v1/space-sensors/devices", payload, headers);
    if (!result.ok) {
      setErrorMessage(result.message ?? "센서 등록에 실패했습니다.");
      return;
    }

    setNotice(`센서 ${payload.sensorId} 등록 완료`);
    setRegisterForm((prev) => ({ ...prev, sensorId: "", macAddress: "" }));
    await loadOverview(Number(registerForm.placeId), true);
  };

  const handleSendCommand = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      return;
    }

    const result = await postJson(
      "/api/zeroq/v1/space-sensors/commands",
      {
        sensorId: commandForm.sensorId,
        commandType: commandForm.commandType,
        commandPayload: commandForm.commandPayload || null,
      },
      headers,
    );

    if (!result.ok) {
      setErrorMessage(result.message ?? "센서 명령 전송에 실패했습니다.");
      return;
    }

    setNotice(`센서 ${commandForm.sensorId}에 ${commandForm.commandType} 명령을 전송했습니다.`);
    setCommandForm((prev) => ({ ...prev, commandPayload: "" }));
  };

  const handleUpdateStatus = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      return;
    }

    const result = await patchJson<SensorDevice>(
      `/api/zeroq/v1/space-sensors/devices/${statusForm.sensorId}/status`,
      { status: statusForm.status },
      headers,
    );

    if (!result.ok) {
      setErrorMessage(result.message ?? "센서 상태 변경에 실패했습니다.");
      return;
    }

    setNotice(`센서 ${statusForm.sensorId} 상태를 ${statusForm.status}(으)로 변경했습니다.`);
    await loadOverview(currentPlaceId, true);
  };

  const handleInstallSensor = async (sensorId: string) => {
    setNotice(null);
    setErrorMessage(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      return;
    }

    const result = await putJson<SensorDevice>(
      `/api/zeroq/v1/space-sensors/devices/${sensorId}/install`,
      { placeId: currentPlaceId },
      headers,
    );

    if (!result.ok) {
      setErrorMessage(result.message ?? "센서 설치 반영에 실패했습니다.");
      return;
    }

    setNotice(`센서 ${sensorId}를 공간 ${currentPlaceId}에 반영했습니다.`);
    await loadOverview(currentPlaceId, true);
  };

  if (!isHydrated || authStatus !== "in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">세션 확인 중...</p>
      </div>
    );
  }

  const sensors = overview?.sensors ?? [];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <main className="mx-auto w-full max-w-6xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">ZeroQ Admin</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">센서 운영 콘솔</h1>
              <p className="mt-2 text-sm text-slate-600">
                로그인된 권한: {normalizeRole(user?.role) ?? "UNKNOWN"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700">공간 ID</label>
            <input
              type="number"
              min={1}
              value={placeIdInput}
              onChange={(event) => setPlaceIdInput(event.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => void loadOverview(currentPlaceId, true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>

          {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
          {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">공간 센서 오버뷰</h2>
            {loading ? (
              <p className="mt-3 text-sm text-slate-600">로딩 중...</p>
            ) : overview?.snapshot ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">공간</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {overview.spaceName} (ID: {overview.spaceId})
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">혼잡도</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {overview.snapshot.occupancyRate.toFixed(1)}% ({overview.snapshot.crowdLevel})
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">활성 센서</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {overview.snapshot.activeSensorCount}개 / 점유 {overview.snapshot.occupiedCount}개
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">마지막 측정</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {overview.snapshot.lastMeasuredAt ?? "-"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">표시할 오버뷰 데이터가 없습니다.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">센서 상태 변경</h2>
            <form className="mt-3 space-y-3" onSubmit={handleUpdateStatus}>
              <select
                value={statusForm.sensorId}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, sensorId: event.target.value }))}
                required
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">센서 선택</option>
                {sensors.map((sensor) => (
                  <option key={sensor.sensorId} value={sensor.sensorId}>
                    {sensor.sensorId} ({sensor.status})
                  </option>
                ))}
              </select>

              <select
                value={statusForm.status}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                {SENSOR_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                상태 변경
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">센서 등록</h2>
            <form className="mt-3 grid gap-2" onSubmit={handleRegisterSensor}>
              <input
                value={registerForm.sensorId}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, sensorId: event.target.value }))}
                placeholder="sensorId"
                required
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <input
                value={registerForm.macAddress}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, macAddress: event.target.value }))}
                placeholder="MAC address"
                required
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <input
                value={registerForm.model}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="model"
                required
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={registerForm.type}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  {SENSOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <select
                  value={registerForm.protocol}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, protocol: event.target.value }))}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  {SENSOR_PROTOCOLS.map((protocol) => (
                    <option key={protocol} value={protocol}>
                      {protocol}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={registerForm.placeId}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, placeId: event.target.value }))}
                  placeholder="placeId"
                  required
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                센서 등록
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">센서 명령</h2>
            <form className="mt-3 grid gap-2" onSubmit={handleSendCommand}>
              <select
                value={commandForm.sensorId}
                onChange={(event) => setCommandForm((prev) => ({ ...prev, sensorId: event.target.value }))}
                required
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">센서 선택</option>
                {sensors.map((sensor) => (
                  <option key={sensor.sensorId} value={sensor.sensorId}>
                    {sensor.sensorId}
                  </option>
                ))}
              </select>

              <select
                value={commandForm.commandType}
                onChange={(event) => setCommandForm((prev) => ({ ...prev, commandType: event.target.value }))}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                {SENSOR_COMMAND_TYPES.map((commandType) => (
                  <option key={commandType} value={commandType}>
                    {commandType}
                  </option>
                ))}
              </select>

              <textarea
                value={commandForm.commandPayload}
                onChange={(event) => setCommandForm((prev) => ({ ...prev, commandPayload: event.target.value }))}
                placeholder='{"threshold": 80}'
                rows={4}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />

              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                명령 전송
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">센서 목록 ({sensors.length})</h2>
            <div className="mt-3 max-h-72 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Sensor</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Battery</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sensors.map((sensor) => (
                    <tr key={sensor.sensorId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{sensor.sensorId}</td>
                      <td className="px-3 py-2 text-slate-700">{sensor.status}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {typeof sensor.batteryPercent === "number"
                          ? `${sensor.batteryPercent.toFixed(1)}%`
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void handleInstallSensor(sensor.sensorId)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          현재 공간으로 설치
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">최근 텔레메트리</h2>
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
              {(overview?.recentTelemetry ?? []).map((telemetry) => (
                <li key={telemetry.telemetryId} className="rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {telemetry.sensorId} / {telemetry.occupied ? "점유" : "비점유"}
                  </p>
                  <p className="text-xs text-slate-600">
                    distance={telemetry.distanceCm.toFixed(1)}cm, quality={telemetry.qualityStatus}
                  </p>
                  <p className="text-xs text-slate-500">{telemetry.measuredAt}</p>
                </li>
              ))}
              {(overview?.recentTelemetry ?? []).length === 0 ? (
                <li className="text-sm text-slate-500">최근 텔레메트리 데이터가 없습니다.</li>
              ) : null}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
