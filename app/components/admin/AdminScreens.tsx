"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import useAdminAccess from "@/app/hooks/useAdminAccess";
import {
  createGateway,
  createZone,
  createSensorCommand,
  deleteSensorDevice,
  installSensorDevice,
  loadAdminConsoleSettings,
  loadAdminWorkspace,
  loadSpaceHistory,
  registerSensorDevice,
  type AdminConsoleSettings,
  type AdminWorkspace,
  type CreateGatewayInput,
  type CreateZoneInput,
  type GatewayRecord,
  type SensorRecord,
  type SensorUsageSummary,
  type Severity,
  type SpaceRecord,
  updateAdminConsoleSettings,
} from "@/app/lib/adminConsole";
import {
  AdminShell,
  cn,
  EmptyPanel,
  Icon,
  LoadingScreen,
  MetricCard,
  MiniBars,
  ModalFrame,
  Panel,
  StatusBadge,
} from "@/app/components/admin/AdminUI";

const SENSOR_TYPES = ["OCCUPANCY_DETECTION"];
const SENSOR_PROTOCOLS = ["BLE_GATEWAY", "MQTT", "HTTP"];
const SENSOR_COMMAND_TYPES = [
  "REBOOT",
  "SET_THRESHOLD",
  "SET_SAMPLE_INTERVAL",
  "SYNC_TIME",
];
const ZONE_OPERATIONAL_STATUSES = ["ACTIVE", "STAGING", "MAINTENANCE", "CRITICAL", "CLOSED"];
const GATEWAY_ROLES = ["EDGE", "HUB"];

type WorkspaceState = ReturnType<typeof useWorkspaceLoader>;

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "확인 불가" : `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function parseApiDate(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(value?: string) {
  if (!value) {
    return "수신 기록 없음";
  }

  const target = parseApiDate(value).getTime();
  if (Number.isNaN(target)) {
    return value;
  }

  const diffMinutes = Math.max(Math.round((Date.now() - target) / 60000), 0);
  if (diffMinutes < 1) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return `${Math.round(diffHours / 24)}일 전`;
}

function formatShortTime(value?: string) {
  if (!value) {
    return "확인 불가";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function textOrFallback(value?: string | null, fallback = "미등록") {
  return value && value.trim().length > 0 ? value : fallback;
}

function spaceTone(space: SpaceRecord) {
  if (!hasAvailableOccupancy(space)) {
    return "neutral" as const;
  }
  if (space.occupancyRate >= 90) {
    return "critical" as const;
  }
  if (space.occupancyRate >= 75) {
    return "warning" as const;
  }
  if (space.occupancyRate >= 45) {
    return "info" as const;
  }
  return "success" as const;
}

function hasAvailableOccupancy(space: SpaceRecord) {
  return space.snapshot?.dataStatus !== "UNAVAILABLE"
    && space.snapshot?.occupancyRate !== null
    && space.snapshot?.occupancyRate !== undefined;
}

function formatSpaceOccupancy(space: SpaceRecord) {
  return hasAvailableOccupancy(space) ? formatPercent(space.occupancyRate) : "확인 불가";
}

function searchField(
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
) {
  return (
    <label className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm sm:min-w-[280px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <span className="sr-only">{placeholder}</span>
      <Icon name="search" className="size-4 text-slate-400" />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
    </label>
  );
}

function toolButton(
  label: string,
  onClick: () => void,
  tone: "default" | "primary" = "default",
  disabled = false,
) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "필요한 데이터가 준비되거나 현재 작업이 끝난 뒤 다시 시도해 주세요." : undefined}
      className={cn(
        "min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        tone === "primary"
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
      )}
    >
      {label}
    </button>
  );
}

/** access token을 확보한 뒤 관리자 workspace를 불러오고 재시도 가능한 화면 상태로 변환한다. */
function useWorkspaceLoader() {
  const access = useAdminAccess();
  const { isReady, resolveAuthHeaders } = access;
  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = await resolveAuthHeaders();
      if (!headers) {
        setError("관리자 데이터를 불러오기 위한 인증 세션이 없습니다.");
        return;
      }
      const nextWorkspace = await loadAdminWorkspace(headers);
      setWorkspace(nextWorkspace);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "관리자 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isReady, resolveAuthHeaders]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void reload();
  }, [isReady, reload]);

  return {
    ...access,
    workspace,
    setWorkspace,
    loading,
    error,
    setError,
    reload,
  };
}

/** 선택 공간이 바뀔 때 실측 sensor usage를 조회하고 이전 요청 결과의 역전 반영을 막는다. */
function useSpaceHistoryState(state: WorkspaceState, space: SpaceRecord | null) {
  const { isReady, resolveAuthHeaders } = state;
  const [history, setHistory] = useState<Array<{ label: string; value: number }>>([]);
  const [usage, setUsage] = useState<SensorUsageSummary | null>(null);
  const [loadedSpaceId, setLoadedSpaceId] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const toHistoryPoints = useCallback((summary: SensorUsageSummary | null) => {
    return (summary?.buckets ?? []).filter((bucket) => bucket.observedSeconds > 0).map((bucket) => {
      const utcDate = parseApiDate(bucket.from);
      const label = Number.isNaN(utcDate.getTime())
        ? "--"
        : new Intl.DateTimeFormat("ko-KR", {
            hour: "2-digit",
            hour12: false,
          }).format(utcDate);
      return {
        label,
        value: bucket.utilizationPercent,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isReady || !space) {
      return;
    }

    void (async () => {
      setHistoryError(null);
      try {
        const headers = await resolveAuthHeaders();
        if (cancelled) {
          return;
        }
        if (!headers) {
          throw new Error("센서 사용량 조회에 필요한 인증 세션이 없습니다.");
        }

        const summary = await loadSpaceHistory(headers, space);
        if (cancelled) {
          return;
        }

        setUsage(summary);
        setHistory(toHistoryPoints(summary));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setUsage(null);
        setHistory([]);
        setHistoryError(loadError instanceof Error ? loadError.message : "센서 사용량을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoadedSpaceId(space.spaceId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, resolveAuthHeaders, space, toHistoryPoints]);

  const reloadHistory = useCallback(async () => {
    if (!isReady || !space) {
      return;
    }

    setHistoryError(null);
    try {
      const headers = await resolveAuthHeaders();
      if (!headers) {
        throw new Error("센서 사용량 조회에 필요한 인증 세션이 없습니다.");
      }

      const summary = await loadSpaceHistory(headers, space);
      setUsage(summary);
      setHistory(toHistoryPoints(summary));
    } catch (loadError) {
      setUsage(null);
      setHistory([]);
      setHistoryError(loadError instanceof Error ? loadError.message : "센서 사용량을 불러오지 못했습니다.");
    } finally {
      setLoadedSpaceId(space.spaceId);
    }
  }, [isReady, resolveAuthHeaders, space, toHistoryPoints]);

  const hasCurrentSpaceData = isReady && space !== null && loadedSpaceId === space.spaceId;
  const visibleHistory = useMemo(
    () => (hasCurrentSpaceData ? history : []),
    [hasCurrentSpaceData, history],
  );
  const visibleUsage = hasCurrentSpaceData ? usage : null;
  const visibleError = hasCurrentSpaceData ? historyError : null;

  return { history: visibleHistory, usage: visibleUsage, error: visibleError, reloadHistory };
}

function NoticeStrip({
  notice,
  error,
}: {
  notice?: string | null;
  error?: string | null;
}) {
  if (!notice && !error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {notice ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function ShellContent({
  activeKey,
  title,
  subtitle,
  state,
  toolbar,
  children,
}: {
  activeKey: string;
  title: string;
  subtitle: string;
  state: WorkspaceState;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  if (!state.isReady || state.loading) {
    return <LoadingScreen />;
  }

  return (
    <AdminShell
      activeKey={activeKey}
      title={title}
      subtitle={subtitle}
      user={state.user}
      toolbar={
        <>
          {toolbar}
          {toolButton("데이터 새로고침", () => void state.reload())}
        </>
      }
      onLogout={() => void state.signOut()}
    >
      {state.error && state.workspace ? (
        <NoticeStrip error={`${state.error} 현재 화면에는 마지막으로 불러온 데이터를 표시합니다.`} />
      ) : null}
      {!state.workspace ? (
        <Panel className="grid min-h-64 place-items-center text-center" >
          <div className="max-w-md">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">운영 데이터를 불러오지 못했습니다.</h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {state.error ?? "잠시 후 다시 시도해 주세요."}
            </p>
            <button type="button" onClick={() => void state.reload()} className="mt-5 min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
              다시 불러오기
            </button>
          </div>
        </Panel>
      ) : children}
    </AdminShell>
  );
}

function occupancyStateLabel(space: SpaceRecord) {
  if (!hasAvailableOccupancy(space)) {
    return "확인 불가";
  }
  if (space.occupancyRate >= 90) {
    return "매우 혼잡";
  }
  if (space.offlineCount > 0
      || space.lowBatteryCount > 0
      || space.sensors.some((sensor) => sensor.detectionStatus === "Unreliable")) {
    return "점검 필요";
  }
  if (space.occupancyRate >= 75) {
    return "혼잡";
  }
  if (space.occupancyRate >= 45) {
    return "보통";
  }
  return "여유";
}

function occupancyStateTone(space: SpaceRecord) {
  if (!hasAvailableOccupancy(space)) {
    return "neutral" as const;
  }
  if (space.occupancyRate >= 90) {
    return "critical" as const;
  }
  if (space.offlineCount > 0
      || space.lowBatteryCount > 0
      || space.sensors.some((sensor) => sensor.detectionStatus === "Unreliable")
      || space.occupancyRate >= 75) {
    return "warning" as const;
  }
  if (space.occupancyRate >= 45) {
    return "info" as const;
  }
  return "success" as const;
}

function formatHourLabel(label?: string) {
  if (!label) {
    return "확인 불가";
  }
  if (label.includes(":")) {
    return label;
  }
  return `${label}:00`;
}

function gatewayTone(status: GatewayRecord["status"]) {
  if (status === "Online") {
    return "success" as const;
  }
  if (status === "Offline") {
    return "critical" as const;
  }
  if (status === "Warning") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function gatewayLoadPercent(gateway: GatewayRecord) {
  const capacity = gateway.sensorCapacity;
  const load = gateway.currentSensorLoad ?? gateway.connectedSensors.length;
  if (!capacity || capacity <= 0) {
    return null;
  }
  return Math.max(0, Math.round((load / capacity) * 100));
}

function formatGatewayLoadPercent(gateway: GatewayRecord) {
  const loadPercent = gatewayLoadPercent(gateway);
  return loadPercent == null ? "확인 불가" : `${loadPercent}%`;
}

function gatewayDisplayStatus(gateway: GatewayRecord) {
  if (gateway.status === "Offline") {
    return "Offline" as const;
  }
  if (gateway.status === "Unknown") {
    return "Unknown" as const;
  }
  if (gateway.status === "Warning") {
    return "Warning" as const;
  }
  return "Active" as const;
}

function gatewayDisplayTone(gateway: GatewayRecord) {
  const status = gatewayDisplayStatus(gateway);
  if (status === "Active") {
    return "success" as const;
  }
  if (status === "Warning") {
    return "warning" as const;
  }
  return status === "Offline" ? "critical" as const : "neutral" as const;
}

function gatewayDisplayLabel(gateway: GatewayRecord) {
  const status = gatewayDisplayStatus(gateway);
  if (status === "Active") {
    return "정상";
  }
  if (status === "Warning") {
    return "주의";
  }
  if (status === "Offline") {
    return "오프라인";
  }
  return "확인 불가";
}

function severityCardStyle(severity: Severity) {
  if (severity === "critical") {
    return "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10";
  }
  if (severity === "success") {
    return "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10";
  }
  return "border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10";
}

function severityLabel(severity: Severity) {
  if (severity === "critical") {
    return "긴급";
  }
  if (severity === "warning") {
    return "주의";
  }
  if (severity === "success") {
    return "정상";
  }
  return "정보";
}

function sensorLifecycleLabel(status: string) {
  if (status === "ACTIVE") {
    return "정상 운영";
  }
  if (status === "INACTIVE") {
    return "비활성";
  }
  if (status === "MAINTENANCE") {
    return "점검 중";
  }
  return status;
}

function detectionStatusLabel(status: string) {
  if (status === "Occupied") {
    return "사용 중";
  }
  if (status === "Vacant") {
    return "비어 있음";
  }
  if (status === "Unreliable") {
    return "측정 불신";
  }
  if (status === "Offline") {
    return "오프라인";
  }
  if (status === "Not Monitored") {
    return "미관측";
  }
  return status;
}

function detectionStatusTone(status: string) {
  if (status === "Offline") {
    return "critical" as const;
  }
  if (status === "Unreliable") {
    return "warning" as const;
  }
  if (status === "Occupied" || status === "Vacant") {
    return "success" as const;
  }
  return "neutral" as const;
}

function operationalStatusLabel(status?: string | null) {
  if (!status) {
    return null;
  }
  if (status === "ACTIVE") {
    return "운영 중";
  }
  if (status === "STAGING") {
    return "준비 중";
  }
  if (status === "MAINTENANCE") {
    return "점검 중";
  }
  if (status === "CRITICAL") {
    return "긴급 점검";
  }
  if (status === "CLOSED") {
    return "운영 종료";
  }
  return status;
}

function operationalStatusTone(status?: string | null) {
  if (status === "CRITICAL") {
    return "critical" as const;
  }
  if (status === "MAINTENANCE" || status === "STAGING") {
    return "warning" as const;
  }
  if (status === "ACTIVE") {
    return "success" as const;
  }
  return "neutral" as const;
}

function telemetryQualityLabel(status?: string | null) {
  if (status === "VALID") {
    return "정상";
  }
  if (status === "OUTLIER") {
    return "이상치";
  }
  if (status === "STALE") {
    return "지연";
  }
  if (status === "DUPLICATE") {
    return "중복";
  }
  return "확인 불가";
}

/** 전체 공간·센서·gateway 상태와 우선 대응 경보를 요약하는 관리자 홈 화면이다. */
export function DashboardScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const visibleSpaces = useMemo(() => {
    const spaces = state.workspace?.spaces ?? [];
    if (!deferredQuery.trim()) {
      return spaces;
    }
    const keyword = deferredQuery.toLowerCase();
    return spaces.filter(
      (space) =>
        space.name.toLowerCase().includes(keyword) ||
        space.addressLabel.toLowerCase().includes(keyword),
    );
  }, [deferredQuery, state.workspace?.spaces]);

  const topSpace = visibleSpaces[0] ?? null;
  const {
    history: dashboardHistory,
    usage: dashboardUsage,
    error: dashboardHistoryError,
  } = useSpaceHistoryState(state, topSpace);
  const gateways = useMemo(() => state.workspace?.gateways ?? [], [state.workspace?.gateways]);
  const alerts = state.workspace?.alerts ?? [];
  const logs = state.workspace?.logs ?? [];
  const peakZones = visibleSpaces
    .filter(hasAvailableOccupancy)
    .slice()
    .sort((left, right) => right.occupancyRate - left.occupancyRate)
    .slice(0, 4);
  const topLoadedGateways = useMemo(() => {
    return gateways
      .flatMap((gateway) => {
        const loadPercent = gatewayLoadPercent(gateway);
        return loadPercent == null ? [] : [{ gatewayId: gateway.gatewayId, loadPercent }];
      })
      .sort((left, right) => right.loadPercent - left.loadPercent)
      .slice(0, 5);
  }, [gateways]);
  const highestLoadedGateway = topLoadedGateways[0] ?? null;
  const criticalAlertCount = alerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = alerts.filter((alert) => alert.severity === "warning").length;
  const priorityAlerts = alerts
    .slice()
    .sort((left, right) => {
      const rank = { critical: 0, warning: 1, info: 2, success: 3 };
      return rank[left.severity] - rank[right.severity];
    })
    .slice(0, 3);

  return (
    <ShellContent
      activeKey="dashboard"
      title="운영 현황"
      subtitle="최근 점유 데이터와 장비 상태를 확인하고 필요한 조치를 우선순위대로 처리합니다."
      state={state}
      toolbar={searchField(query, setQuery, "공간 이름 또는 주소 검색")}
    >
      {state.workspace && state.workspace.spaces.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard
              label="전체 점유율"
              value={formatPercent(state.workspace.summary.occupancyRate)}
              hint={`현재 ${formatNumber(state.workspace.summary.occupiedNow)}개 센서 위치가 사용 중입니다.`}
            />
            <MetricCard
              label="정상 게이트웨이"
              value={`${formatNumber(gateways.filter((gateway) => gateway.status === "Online").length)}/${formatNumber(gateways.length)}`}
              hint={`${formatNumber(gateways.filter((gateway) => gateway.status !== "Online").length)}개는 주의·오프라인·확인 불가 상태입니다.`}
              tone="orange"
            />
            <MetricCard
              label="확인할 알림"
              value={formatNumber(alerts.length)}
              hint={`긴급 ${criticalAlertCount}개 · 주의 ${warningAlerts}개`}
              tone="rose"
            />
            <MetricCard
              label="게이트웨이 가용률"
              value={formatPercent(state.workspace.summary.gatewayHealth)}
              hint="등록된 게이트웨이 중 현재 온라인인 비율입니다."
              tone="emerald"
            />
          </div>

          {query.trim() && visibleSpaces.length === 0 ? (
            <Panel className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">검색 조건에 맞는 공간이 없습니다.</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">공간 이름이나 주소를 바꿔 검색해 주세요. 상단의 전체 지표와 알림은 검색과 관계없이 유지됩니다.</p>
            </Panel>
          ) : null}

          <Panel className={priorityAlerts.length > 0 ? "border-amber-200 dark:border-amber-500/30" : "border-emerald-200 dark:border-emerald-500/30"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">우선 확인 항목</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">장비와 공간 상태에서 현재 조치가 필요한 항목입니다.</p>
              </div>
              <Link href="/logs" className="text-sm font-bold text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
                전체 이벤트 로그
              </Link>
            </div>
            {priorityAlerts.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                {priorityAlerts.map((alert) => (
                  <div key={alert.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-3">
                    <StatusBadge tone={alert.severity}>{severityLabel(alert.severity)}</StatusBadge>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{alert.description}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatRelative(alert.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">현재 불러온 데이터에는 별도 알림이 없습니다.</p>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    시간대별 점유율
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {topSpace ? `${topSpace.name}의 실제 관측 구간만 집계합니다.` : "표시할 공간이 없습니다."}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {dashboardUsage ? `관측 범위 ${dashboardUsage.coveragePercent.toFixed(1)}%` : "관측 데이터 없음"}
                </div>
              </div>
              <div className="mt-6">
                <MiniBars points={dashboardHistory} />
              </div>
              {dashboardHistoryError ? (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">{dashboardHistoryError}</p>
              ) : null}
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">혼잡 공간</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                신뢰 가능한 최근 점유율이 높은 순서입니다.
              </p>
              <div className="mt-6 space-y-5">
                {peakZones.map((space) => (
                  <Link key={space.spaceId} href={`/areas/${space.spaceId}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {space.name}
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-300">
                        {formatSpaceOccupancy(space)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          space.occupancyRate >= 90
                            ? "bg-rose-500"
                            : space.occupancyRate >= 75
                              ? "bg-blue-500"
                              : "bg-slate-400",
                        )}
                        style={{ width: `${Math.min(Math.max(space.occupancyRate, 0), 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-6 pt-4">
                <Link
                  href="/areas"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  모든 공간 보기
                </Link>
              </div>
            </Panel>
          </div>

          <div>
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  게이트웨이 센서 수용량
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  수용량 대비
                </span>
              </div>
              {topLoadedGateways.length > 0 ? (
                <div className="mt-6 grid h-[180px] grid-cols-5 items-end gap-4">
                  {topLoadedGateways.map((gateway) => (
                    <div key={gateway.gatewayId} className="flex h-full flex-col items-center justify-end gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {gateway.loadPercent}%
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-t-lg",
                          gateway.loadPercent > 100
                            ? "border-t-2 border-amber-500 bg-amber-500/20 dark:bg-amber-500/12"
                            : "bg-blue-500/20 dark:bg-blue-500/12",
                        )}
                        style={{ height: `${Math.min(gateway.loadPercent, 100)}%` }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {gateway.gatewayId}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 grid h-[180px] place-items-center text-sm text-slate-500 dark:text-slate-400">
                  등록된 센서 용량 정보가 없습니다.
                </div>
              )}
              <div
                className={cn(
                  "mt-4 flex items-center gap-3 rounded-xl border p-3 text-xs",
                  highestLoadedGateway && highestLoadedGateway.loadPercent > 100
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
                )}
              >
                <Icon name="alert" className="size-4 shrink-0" />
                <p>
                  {highestLoadedGateway
                    ? `${highestLoadedGateway.gatewayId}의 등록 센서 비율이 ${highestLoadedGateway.loadPercent}%로 가장 높습니다.`
                    : "등록 센서 수와 수용량이 모두 있는 게이트웨이가 없습니다."}
                </p>
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  최근 운영 이벤트
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  공간과 장비에서 최근 생성된 이벤트입니다.
                </p>
              </div>
              <StatusBadge tone="info">{logs.length}건</StatusBadge>
            </div>
            {logs.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {logs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/35"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {severityLabel(log.severity)}
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {log.eventType}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {log.details}
                  </p>
                </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">최근 운영 이벤트가 없습니다.</p>
            )}
          </Panel>
        </div>
      ) : (
        <EmptyPanel
          title="표시할 공간 데이터가 없습니다."
          description="공간과 센서 데이터가 연결되면 대시보드가 자동으로 채워집니다."
        />
      )}
    </ShellContent>
  );
}

/** 소유 공간 목록을 탐색하고 새 공간을 등록하는 운영 화면이다. */
export function AreaManagementScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    description: "",
    operationalStatus: "ACTIVE",
    address: "",
    latitude: "37.4986",
    longitude: "127.0285",
    phoneNumber: "",
    operatingHours: "",
    imageUrl: "",
  });
  const deferredQuery = useDeferredValue(query);

  const spaces = useMemo(() => {
    const list = state.workspace?.spaces ?? [];
    if (!deferredQuery.trim()) {
      return list;
    }
    const keyword = deferredQuery.toLowerCase();
    return list.filter(
      (space) =>
        space.name.toLowerCase().includes(keyword) ||
        space.addressLabel.toLowerCase().includes(keyword),
    );
  }, [deferredQuery, state.workspace?.spaces]);

  const moderateOccupancyCount = spaces.filter(
    (space) => hasAvailableOccupancy(space) && space.occupancyRate >= 45 && space.occupancyRate < 75,
  ).length;
  const highOccupancyCount = spaces.filter(
    (space) => hasAvailableOccupancy(space) && space.occupancyRate >= 75 && space.occupancyRate < 90,
  ).length;
  const criticalCount = spaces.filter(
    (space) => hasAvailableOccupancy(space) && space.occupancyRate >= 90,
  ).length;

  const resetZoneForm = useCallback(() => {
    setZoneForm({
      name: "",
      description: "",
      operationalStatus: "ACTIVE",
      address: "",
      latitude: "37.4986",
      longitude: "127.0285",
      phoneNumber: "",
      operatingHours: "",
      imageUrl: "",
    });
    setCreateError(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetZoneForm();
    setCreateModalOpen(true);
  }, [resetZoneForm]);

  const closeCreateModal = useCallback(() => {
    if (createSubmitting) {
      return;
    }
    setCreateModalOpen(false);
    setCreateError(null);
  }, [createSubmitting]);

  const submitCreateZone = useCallback(async () => {
    setCreateError(null);

    if (!zoneForm.name.trim() || !zoneForm.description.trim() || !zoneForm.address.trim()) {
      setCreateError("이름, 설명, 주소는 필수입니다.");
      return;
    }
    const latitude = Number(zoneForm.latitude);
    const longitude = Number(zoneForm.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setCreateError("위도와 경도는 숫자여야 합니다.");
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setCreateError("위도는 -90~90, 경도는 -180~180 범위로 입력해 주세요.");
      return;
    }

    const payload: CreateZoneInput = {
      name: zoneForm.name.trim(),
      description: zoneForm.description.trim(),
      address: zoneForm.address.trim(),
      latitude,
      longitude,
      phoneNumber: zoneForm.phoneNumber.trim() || undefined,
      operatingHours: zoneForm.operatingHours.trim() || undefined,
      imageUrl: zoneForm.imageUrl.trim() || undefined,
      operationalStatus: zoneForm.operationalStatus,
    };

    setCreateSubmitting(true);
    try {
      const headers = await state.resolveAuthHeaders();
      if (!headers) {
        setCreateError("인증 세션을 확인할 수 없습니다.");
        return;
      }
      await createZone(headers, payload);
      await state.reload();
      setCreateModalOpen(false);
      resetZoneForm();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "공간 생성에 실패했습니다.");
    } finally {
      setCreateSubmitting(false);
    }
  }, [resetZoneForm, state, zoneForm]);

  return (
    <ShellContent
      activeKey="areas"
      title="공간 관리"
      subtitle="운영 공간별 최근 점유율과 연결 장비 상태를 확인하고 새 공간을 등록합니다."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "공간 이름 또는 주소 검색")}
          {toolButton("새 공간 등록", openCreateModal, "primary")}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-800"><span className="text-slate-500 dark:text-slate-400">검색 결과</span><strong className="ml-2 text-slate-900 dark:text-white">{spaces.length}</strong></div>
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200"><span>보통 45–74%</span><strong className="ml-2">{moderateOccupancyCount}</strong></div>
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><span>혼잡 75–89%</span><strong className="ml-2">{highOccupancyCount}</strong></div>
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"><span>매우 혼잡 90%+</span><strong className="ml-2">{criticalCount}</strong></div>
          </div>

          {spaces.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {spaces.map((space) => {
              const gatewayCount =
                state.workspace?.gateways.filter((gateway) => gateway.spaceId === space.spaceId)
                  .length ?? 0;

              return (
                <Link key={space.spaceId} href={`/areas/${space.spaceId}`} className="block">
                  <Panel
                    className={cn(
                      "h-full transition hover:border-blue-300 hover:shadow-md dark:hover:border-blue-500/40",
                      space.occupancyRate >= 90
                        ? "border-rose-200 dark:border-rose-500/20"
                        : space.occupancyRate >= 75
                          ? "border-amber-200 dark:border-amber-500/20"
                          : "border-slate-200 dark:border-slate-800",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{space.name}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ID: ZN-{String(space.spaceId).padStart(3, "0")}
                        </p>
                      </div>
                      <StatusBadge tone={occupancyStateTone(space)}>
                        {occupancyStateLabel(space)}
                      </StatusBadge>
                    </div>

                    <div className="mt-5">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">현재 점유율</span>
                        <span
                          className={cn(
                            "font-bold",
                            space.occupancyRate >= 90
                              ? "text-rose-500"
                              : "text-slate-700 dark:text-slate-200",
                          )}
                        >
                          {!hasAvailableOccupancy(space)
                            ? "수집 데이터 없음"
                            : space.occupancyRate >= 100
                            ? "수용 범위 초과"
                            : `${Math.round(space.occupancyRate)}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            space.occupancyRate >= 90
                              ? "bg-rose-500"
                              : space.occupancyRate >= 75
                                ? "bg-amber-500"
                                : "bg-blue-500",
                          )}
                          style={{
                            width: hasAvailableOccupancy(space)
                              ? `${Math.min(Math.max(space.occupancyRate, 0), 100)}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          게이트웨이
                        </p>
                        <p className="mt-1 text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                          {gatewayCount > 0
                            ? state.workspace?.gateways.find((gateway) => gateway.spaceId === space.spaceId)
                                ?.gatewayId ?? "확인 불가"
                            : "미등록"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          센서
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          {space.sensors.length}개 등록
                        </p>
                      </div>
                    </div>
                  </Panel>
                </Link>
              );
            })}
          </div>
          ) : (
            <EmptyPanel
              title={query.trim() ? "검색 결과가 없습니다." : "등록된 공간이 없습니다."}
              description={query.trim() ? "공간 이름이나 주소를 바꿔 다시 검색해 주세요." : "새 공간 등록으로 첫 운영 공간을 추가해 주세요."}
            />
          )}
        </div>
      ) : (
        <EmptyPanel
          title="공간 데이터를 불러오지 못했습니다."
          description="백엔드 연결 상태와 로그인 세션을 확인해 주세요."
        />
      )}
      <ModalFrame
        open={isCreateModalOpen}
        title="새 공간 등록"
        description="새 공간을 등록하면 관리자 워크스페이스에 즉시 추가되고, 공개 노출은 검증 전까지 보류됩니다."
        onClose={closeCreateModal}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              공간은 기본적으로 검증 전 상태로 생성됩니다.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="submit"
                form="create-zone-form"
                disabled={createSubmitting}
                className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSubmitting ? "등록 중..." : "공간 등록"}
              </button>
            </div>
          </div>
        }
      >
        <form
          id="create-zone-form"
          className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreateZone();
          }}
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">공간 이름 *</span>
              <input
                value={zoneForm.name}
                onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="시그마 회의실"
                required
                maxLength={255}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">설명 *</span>
              <textarea
                value={zoneForm.description}
                onChange={(event) => setZoneForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                placeholder="현재 점유율과 장비 상태를 확인할 공간 설명"
                required
                maxLength={1000}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">운영 상태</span>
                <select
                  value={zoneForm.operationalStatus}
                  onChange={(event) => setZoneForm((current) => ({ ...current, operationalStatus: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  {ZONE_OPERATIONAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {operationalStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">주소 *</span>
              <input
                value={zoneForm.address}
                onChange={(event) => setZoneForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="서울 강남구 테헤란로 101"
                required
                maxLength={500}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="grid gap-4">
            <Panel className="border-blue-100 bg-blue-50 shadow-none dark:border-blue-500/10 dark:bg-blue-500/5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-500 dark:text-blue-300">
                위치 및 연락 정보
              </p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">위도 *</span>
                  <input
                    value={zoneForm.latitude}
                    onChange={(event) => setZoneForm((current) => ({ ...current, latitude: event.target.value }))}
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    required
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">경도 *</span>
                  <input
                    value={zoneForm.longitude}
                    onChange={(event) => setZoneForm((current) => ({ ...current, longitude: event.target.value }))}
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    required
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">전화번호</span>
                  <input
                    value={zoneForm.phoneNumber}
                    onChange={(event) => setZoneForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                    placeholder="02-7000-1000"
                    type="tel"
                    maxLength={30}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">운영 시간</span>
                  <input
                    value={zoneForm.operatingHours}
                    onChange={(event) => setZoneForm((current) => ({ ...current, operatingHours: event.target.value }))}
                    placeholder="08:00-22:00"
                    maxLength={100}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">이미지 경로</span>
                  <input
                    value={zoneForm.imageUrl}
                    onChange={(event) => setZoneForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    placeholder="/images/spaces/new-zone.jpg"
                    maxLength={1000}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              </div>
            </Panel>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <p className="font-semibold text-slate-900 dark:text-white">생성 규칙</p>
              <ul className="mt-3 space-y-2">
                <li>새 공간은 현재 로그인한 관리자 소유로 생성됩니다.</li>
                <li>생성 직후 관리자 화면에는 보이지만, 공개 노출은 검증 전까지 제외됩니다.</li>
                <li>게이트웨이와 센서는 이후 해당 공간 안에서 별도로 연결합니다.</li>
              </ul>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {createError}
              </div>
            ) : null}
          </div>
        </form>
      </ModalFrame>
    </ShellContent>
  );
}

/** 단일 공간의 현재 스냅샷, 연결 센서, 실측 사용량을 함께 보여준다. */
export function AreaDetailScreen({ spaceId }: { spaceId: number }) {
  const state = useWorkspaceLoader();
  const space = useMemo(
    () => state.workspace?.spaces.find((item) => item.spaceId === spaceId) ?? null,
    [spaceId, state.workspace?.spaces],
  );
  const gatewayCount = useMemo(
    () => state.workspace?.gateways.filter((gateway) => gateway.spaceId === space?.spaceId).length ?? 0,
    [space?.spaceId, state.workspace?.gateways],
  );
  const { history, error: historyError, reloadHistory } = useSpaceHistoryState(state, space);

  return (
    <ShellContent
      activeKey="areas"
      title={space ? `${space.name} 상세` : "공간 상세"}
      subtitle="공간별 점유율, 등록된 센서 위치 코드, 최근 텔레메트리를 한 번에 검토합니다."
      state={state}
      toolbar={
        <>
          <Link
            href="/areas"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            목록으로
          </Link>
          {toolButton("히스토리 갱신", () => void reloadHistory(), "primary")}
        </>
      }
    >
      {space ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="현재 사용 위치"
              value={hasAvailableOccupancy(space) ? `${formatNumber(space.occupiedCount)}개` : "확인 불가"}
              hint={hasAvailableOccupancy(space)
                ? `${formatPercent(space.occupancyRate)} · ${occupancyStateLabel(space)}`
                : "최근 신뢰 가능한 센서 데이터가 없습니다."}
            />
            <MetricCard
              label="보고 센서"
              value={`${formatNumber(space.activeSensorCount)}개`}
              hint={`오프라인 ${formatNumber(space.offlineCount)}개`}
              tone="emerald"
            />
            <MetricCard
              label="평균 배터리"
              value={space.avgBattery === null ? "확인 불가" : `${space.avgBattery.toFixed(0)}%`}
              hint={`배터리 부족 ${formatNumber(space.lowBatteryCount)}개`}
              tone="orange"
            />
            <MetricCard
              label="사용자 평점"
              value={space.averageRating > 0 ? space.averageRating.toFixed(1) : "0.0"}
              hint={`리뷰 ${formatNumber(space.reviewCount)}건 기준`}
              tone="rose"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-300">위치 원장</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    센서 위치 등록 현황
                  </h2>
                </div>
                <StatusBadge tone={space.operationalStatus ? operationalStatusTone(space.operationalStatus) : spaceTone(space)}>
                  {operationalStatusLabel(space.operationalStatus) ?? occupancyStateLabel(space)}
                </StatusBadge>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">{textOrFallback(space.addressLabel, "주소 미등록")}</span>
                <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">센서 {space.sensors.length}개</span>
                <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">게이트웨이 {gatewayCount}개</span>
              </div>
              {space.sensors.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {space.sensors.map((sensor) => (
                    <Link
                      key={sensor.sensorId}
                      href={`/sensors/${sensor.sensorId}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/35 dark:hover:border-blue-500/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{sensor.sensorId}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {textOrFallback(sensor.positionCode ?? sensor.locationLabel, "위치 미지정")}
                          </p>
                        </div>
                        <StatusBadge tone={detectionStatusTone(sensor.detectionStatus)}>
                          {detectionStatusLabel(sensor.detectionStatus)}
                        </StatusBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">이 공간에 등록된 센서가 없습니다.</p>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                현재 API는 도면 좌표를 제공하지 않으므로 실제 평면 배치를 추정하지 않고 등록된 위치 코드만 표시합니다.
              </p>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">연결 센서</h2>
                <div className="mt-4 space-y-3">
                  {space.sensors.map((sensor) => (
                    <Link
                      key={sensor.sensorId}
                      href={`/sensors/${sensor.sensorId}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-500/40"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{sensor.sensorId}</p>
                        <p className="mt-1 text-xs text-slate-400">{sensor.locationLabel}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge
                          tone={detectionStatusTone(sensor.detectionStatus)}
                        >
                          {detectionStatusLabel(sensor.detectionStatus)}
                        </StatusBadge>
                        <p className="mt-2 text-xs text-slate-500">{sensor.batteryLabel}</p>
                      </div>
                    </Link>
                  ))}
                  {space.sensors.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">이 공간에 연결된 센서가 없습니다.</p>
                  ) : null}
                </div>
              </Panel>

              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">최근 텔레메트리</h2>
                <div className="mt-4 space-y-3">
                  {space.recentTelemetry.slice(0, 5).map((telemetry) => (
                    <div
                      key={telemetry.telemetryId}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <p className="font-bold text-slate-900 dark:text-white">
                        {telemetry.sensorId} · {telemetry.occupied ? "사용 중" : "비어 있음"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {telemetry.distanceCm != null
                          ? `거리 ${telemetry.distanceCm.toFixed(1)}cm`
                          : `패드 ${telemetry.padLeftValue ?? "-"} / ${telemetry.padRightValue ?? "-"}`}
                        {" · "}신뢰도 {telemetryQualityLabel(telemetry.qualityStatus)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(telemetry.measuredAt)}</p>
                    </div>
                  ))}
                  {space.recentTelemetry.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">최근 텔레메트리가 없습니다.</p>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>

          <Panel>
            <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">시간대별 사용률</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    선택 기간의 실측 사용률을 시간 bucket별로 표시합니다.
                  </p>
                </div>
              <StatusBadge tone={spaceTone(space)}>{formatSpaceOccupancy(space)}</StatusBadge>
            </div>
            <div className="mt-5">
              <MiniBars points={history} />
            </div>
            {historyError ? (
              <p className="mt-3 text-xs text-rose-300">{historyError}</p>
            ) : null}
          </Panel>
        </div>
      ) : (
        <EmptyPanel
          title="선택한 공간을 찾을 수 없습니다."
          description="공간 목록으로 돌아가 다른 공간을 선택해 주세요."
        />
      )}
    </ShellContent>
  );
}

/** 센서 검색·상태 확인·등록·설치·명령 생성을 담당하는 운영 화면이다. */
export function SensorsScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isInstallModalOpen, setInstallModalOpen] = useState(false);
  const [isCommandModalOpen, setCommandModalOpen] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    sensorId: "",
    macAddress: "",
    model: "XIAO-NRF52840-VL53L1X",
    type: SENSOR_TYPES[0],
    protocol: SENSOR_PROTOCOLS[0],
    placeId: 0,
    gatewayId: "",
  });
  const [installForm, setInstallForm] = useState({
    sensorId: "",
    placeId: 0,
    gatewayId: "",
  });
  const [commandForm, setCommandForm] = useState({
    sensorId: "",
    commandType: SENSOR_COMMAND_TYPES[0],
    commandPayload: "",
  });

  const sensors = useMemo(() => {
    const list = state.workspace?.sensors ?? [];
    if (!deferredQuery.trim()) {
      return list;
    }
    const keyword = deferredQuery.toLowerCase();
    return list.filter(
      (sensor) =>
        sensor.sensorId.toLowerCase().includes(keyword) ||
        sensor.spaceName.toLowerCase().includes(keyword) ||
        (sensor.gatewayId?.toLowerCase() ?? "").includes(keyword),
    );
  }, [deferredQuery, state.workspace?.sensors]);

  const selectedRegisterPlaceId = useMemo(() => {
    const spaces = state.workspace?.spaces ?? [];
    if (spaces.length === 0) {
      return 0;
    }

    const validPlaceIds = new Set(spaces.map((space) => space.spaceId));
    if (validPlaceIds.has(registerForm.placeId)) {
      return registerForm.placeId;
    }

    return spaces[0].spaceId;
  }, [registerForm.placeId, state.workspace?.spaces]);

  const selectedInstallPlaceId = useMemo(() => {
    const spaces = state.workspace?.spaces ?? [];
    if (spaces.length === 0) {
      return 0;
    }

    const validPlaceIds = new Set(spaces.map((space) => space.spaceId));
    if (validPlaceIds.has(installForm.placeId)) {
      return installForm.placeId;
    }

    const selectedSensor = state.workspace?.sensors.find((sensor) => sensor.sensorId === installForm.sensorId);
    if (selectedSensor && validPlaceIds.has(selectedSensor.placeId)) {
      return selectedSensor.placeId;
    }

    return spaces[0].spaceId;
  }, [installForm.placeId, installForm.sensorId, state.workspace?.spaces, state.workspace?.sensors]);

  const availableGatewaysForPlace = useCallback(
    (placeId: number) =>
      (state.workspace?.gateways ?? []).filter(
        (gateway) => gateway.spaceId === placeId || gateway.spaceId === null || gateway.spaceId === undefined,
      ),
    [state.workspace?.gateways],
  );

  const registerGatewayOptions = useMemo(
    () => availableGatewaysForPlace(selectedRegisterPlaceId),
    [availableGatewaysForPlace, selectedRegisterPlaceId],
  );
  const installGatewayOptions = useMemo(
    () => availableGatewaysForPlace(selectedInstallPlaceId),
    [availableGatewaysForPlace, selectedInstallPlaceId],
  );
  const selectedCommandSensor = useMemo(
    () => state.workspace?.sensors.find((sensor) => sensor.sensorId === commandForm.sensorId) ?? null,
    [commandForm.sensorId, state.workspace?.sensors],
  );
  const isBleCommandTarget = selectedCommandSensor?.protocol.trim().toUpperCase() === "BLE_GATEWAY";

  const resetRegisterForm = useCallback(() => {
    setRegisterForm({
      sensorId: "",
      macAddress: "",
      model: "XIAO-NRF52840-VL53L1X",
      type: SENSOR_TYPES[0],
      protocol: SENSOR_PROTOCOLS[0],
      placeId: state.workspace?.spaces[0]?.spaceId ?? 0,
      gatewayId: "",
    });
  }, [state.workspace?.spaces]);

  const openRegisterModal = useCallback(() => {
    resetRegisterForm();
    setActionError(null);
    setRegisterModalOpen(true);
  }, [resetRegisterForm]);

  const closeRegisterModal = useCallback(() => {
    if (actionSubmitting) {
      return;
    }
    setRegisterModalOpen(false);
  }, [actionSubmitting]);

  const openInstallModal = useCallback((sensor?: SensorRecord | null) => {
    setActionError(null);
    setInstallForm({
      sensorId: sensor?.sensorId ?? "",
      placeId: sensor?.placeId ?? state.workspace?.spaces[0]?.spaceId ?? 0,
      gatewayId: sensor?.gatewayId ?? "",
    });
    setInstallModalOpen(true);
  }, [state.workspace?.spaces]);

  const closeInstallModal = useCallback(() => {
    if (actionSubmitting) {
      return;
    }
    setInstallModalOpen(false);
  }, [actionSubmitting]);

  const openCommandModal = useCallback((sensor?: SensorRecord | null) => {
    setActionError(null);
    setCommandForm({
      sensorId: sensor?.sensorId ?? "",
      commandType: SENSOR_COMMAND_TYPES[0],
      commandPayload: "",
    });
    setCommandModalOpen(true);
  }, []);

  const closeCommandModal = useCallback(() => {
    if (actionSubmitting) {
      return;
    }
    setCommandModalOpen(false);
  }, [actionSubmitting]);

  const executeAction = useCallback(
    async (runner: (headers: Record<string, string>) => Promise<{ ok: boolean; message?: string }>, successMessage: string) => {
      if (actionSubmitting) {
        return false;
      }
      setNotice(null);
      setActionError(null);
      setActionSubmitting(true);
      try {
        const headers = await state.resolveAuthHeaders();
        if (!headers) {
          setActionError("인증 세션을 확인할 수 없습니다.");
          return false;
        }
        const result = await runner(headers);
        if (!result.ok) {
          setActionError(result.message ?? "요청 처리에 실패했습니다.");
          return false;
        }

        setNotice(successMessage);
        await state.reload();
        return true;
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");
        return false;
      } finally {
        setActionSubmitting(false);
      }
    },
    [actionSubmitting, state],
  );

  const removeSensor = useCallback(
    (sensor: SensorRecord) => {
      if (!window.confirm(`${sensor.sensorId} 센서를 삭제하시겠습니까? 관련 raw 데이터와 명령 이력도 함께 제거됩니다.`)) {
        return;
      }

      void executeAction(
        (headers) => deleteSensorDevice(headers, sensor.sensorId),
        `${sensor.sensorId} 센서를 삭제했습니다.`,
      );
    },
    [executeAction],
  );

  const gatewaySections = useMemo(() => {
    const buckets = new Map<string, SensorRecord[]>();
    sensors.forEach((sensor) => {
      if (!sensor.gatewayId) {
        return;
      }
      const list = buckets.get(sensor.gatewayId) ?? [];
      list.push(sensor);
      buckets.set(sensor.gatewayId, list);
    });

    return (state.workspace?.gateways ?? [])
      .filter((gateway) => buckets.has(gateway.gatewayId))
      .map((gateway) => ({
        gateway,
        sensors: buckets.get(gateway.gatewayId) ?? [],
      }));
  }, [sensors, state.workspace?.gateways]);
  const assignedGatewayIds = useMemo(
    () => new Set(gatewaySections.map((section) => section.gateway.gatewayId)),
    [gatewaySections],
  );
  const unassignedSensors = useMemo(
    () => sensors.filter((sensor) => !sensor.gatewayId || !assignedGatewayIds.has(sensor.gatewayId)),
    [assignedGatewayIds, sensors],
  );
  const activeSensors = useMemo(
    () => sensors.filter((sensor) => sensor.status === "ACTIVE").length,
    [sensors],
  );
  const inventorySubtitle = `활성 센서 ${formatNumber(activeSensors)}개 · 등록 게이트웨이 ${formatNumber(state.workspace?.gateways.length ?? 0)}개`;

  return (
    <ShellContent
      activeKey="sensors"
      title="센서 관리"
      subtitle={inventorySubtitle}
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "센서 ID, 공간 또는 게이트웨이 검색")}
          {toolButton(
            "센서 등록",
            openRegisterModal,
            "primary",
            (state.workspace?.spaces.length ?? 0) === 0 || (state.workspace?.gateways.length ?? 0) === 0,
          )}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <NoticeStrip notice={notice} error={actionError ?? state.error} />

          {sensors.length > 0 ? (
          <div className="space-y-8">
            {gatewaySections.map(({ gateway, sensors: gatewaySensors }) => (
              <section key={gateway.gatewayId} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <Icon name="gateways" className="size-5 text-blue-500 dark:text-blue-300" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    게이트웨이 <span className="text-blue-700 dark:text-blue-300">{gateway.gatewayId}</span>
                  </h3>
                  <StatusBadge tone={gatewayTone(gateway.status)}>{gatewayDisplayLabel(gateway)}</StatusBadge>
                  <span className="ml-auto text-sm text-slate-400">
                    센서 {gatewaySensors.length}개
                  </span>
                </div>

                <Panel className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                          <th className="px-6 py-4">센서 ID</th>
                          <th className="px-6 py-4">유형</th>
                          <th className="px-6 py-4">배터리</th>
                          <th className="px-6 py-4">등록 / 감지 상태</th>
                          <th className="px-6 py-4 text-right">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {gatewaySensors.map((sensor) => (
                          <tr
                            key={sensor.sensorId}
                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/25"
                          >
                            <td className="px-6 py-4 text-sm font-mono text-slate-700 dark:text-slate-200">
                              {sensor.sensorId}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                              {sensor.type}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className={cn(
                                      "h-full",
                                      sensor.batteryPercent === null
                                        ? "bg-slate-400"
                                        : sensor.batteryPercent <= 15
                                        ? "bg-rose-500"
                                        : sensor.batteryPercent <= 40
                                          ? "bg-amber-500"
                                          : "bg-emerald-500",
                                    )}
                                    style={{ width: `${sensor.batteryPercent ?? 0}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    sensor.batteryPercent === null
                                      ? "text-slate-400"
                                      : sensor.batteryPercent <= 15
                                      ? "text-rose-500"
                                      : sensor.batteryPercent <= 40
                                        ? "text-amber-500"
                                        : "text-emerald-500",
                                  )}
                                >
                                  {sensor.batteryPercent !== null
                                    ? `${sensor.batteryPercent.toFixed(0)}%`
                                    : "확인 불가"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge
                                tone={
                                  sensor.status === "ACTIVE"
                                    ? "success"
                                    : sensor.status === "MAINTENANCE"
                                      ? "warning"
                                      : "critical"
                                }
                              >
                                {sensorLifecycleLabel(sensor.status)}
                              </StatusBadge>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {detectionStatusLabel(sensor.detectionStatus)}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Link
                                  href={`/sensors/${sensor.sensorId}`}
                                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  상세
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => openInstallModal(sensor)}
                                  disabled={actionSubmitting}
                                  className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  배치
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCommandModal(sensor)}
                                  disabled={actionSubmitting}
                                  className="min-h-10 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
                                >
                                  명령
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSensor(sensor)}
                                  disabled={actionSubmitting}
                                  className="min-h-10 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60"
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </section>
            ))}

            {unassignedSensors.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <Icon name="alert" className="size-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">미배치 센서</h3>
                  <StatusBadge tone="warning">배치 필요</StatusBadge>
                  <span className="ml-auto text-sm text-slate-400">
                    {unassignedSensors.length}개
                  </span>
                </div>
                <Panel className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                          <th className="px-6 py-4">센서 ID</th>
                          <th className="px-6 py-4">유형</th>
                          <th className="px-6 py-4">공간</th>
                          <th className="px-6 py-4">배터리</th>
                          <th className="px-6 py-4 text-right">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {unassignedSensors.map((sensor) => (
                          <tr key={sensor.sensorId}>
                            <td className="px-6 py-4 text-sm font-mono text-slate-700 dark:text-slate-200">
                              {sensor.sensorId}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                              {sensor.type}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                              {sensor.spaceName}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                              {sensor.batteryLabel}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openInstallModal(sensor)}
                                  disabled={actionSubmitting}
                                  className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                                >
                                  배치
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSensor(sensor)}
                                  disabled={actionSubmitting}
                                  className="min-h-10 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60"
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </section>
            ) : null}
          </div>
          ) : (
            <EmptyPanel
              title={query.trim() ? "검색 결과가 없습니다." : "등록된 센서가 없습니다."}
              description={
                query.trim()
                  ? "센서 ID, 공간 또는 게이트웨이 검색어를 바꿔 주세요."
                  : (state.workspace?.spaces.length ?? 0) === 0
                    ? "센서를 등록하려면 먼저 공간을 등록해 주세요."
                    : (state.workspace?.gateways.length ?? 0) === 0
                      ? "센서를 등록하려면 해당 공간의 게이트웨이를 먼저 등록해 주세요."
                      : "센서 등록으로 첫 장비를 추가해 주세요."
              }
            />
          )}
        </div>
      ) : (
        <EmptyPanel
          title="센서 데이터를 불러오지 못했습니다."
          description="센서 브리지 API 연결 상태를 먼저 확인해 주세요."
        />
      )}

      <ModalFrame
        open={isRegisterModalOpen}
        title="센서 등록"
        description="새 센서를 등록하고 공간 및 게이트웨이 매핑을 함께 설정합니다."
        onClose={closeRegisterModal}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const selectedPlaceId = selectedRegisterPlaceId || state.workspace?.spaces[0]?.spaceId;
            if (!selectedPlaceId) {
              setActionError("센서를 등록하려면 먼저 공간 정보를 등록해 주세요.");
              return;
            }
            if (!registerForm.gatewayId) {
              setActionError("센서를 등록할 게이트웨이를 선택해 주세요.");
              return;
            }
            if (
              registerForm.protocol === "BLE_GATEWAY"
              && !/^[A-Za-z0-9_-]{1,8}$/.test(registerForm.sensorId.trim())
            ) {
              setActionError("BLE 센서 ID는 영문, 숫자, 하이픈, 밑줄만 사용해 1~8자로 입력해 주세요.");
              return;
            }
            if (
              registerForm.protocol === "BLE_GATEWAY"
              && !/^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/.test(registerForm.macAddress.trim())
            ) {
              setActionError("BLE MAC 주소는 AA:BB:CC:DD:EE:FF 형식으로 입력해 주세요.");
              return;
            }

            void (async () => {
              const ok = await executeAction(
                (headers) =>
                  registerSensorDevice(headers, {
                    ...registerForm,
                    placeId: selectedPlaceId,
                    gatewayId: registerForm.gatewayId || null,
                  }),
                `${registerForm.sensorId} 등록 완료`,
              );

              if (ok) {
                closeRegisterModal();
                resetRegisterForm();
              }
            })();
          }}
        >
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            센서 ID *
            <input
              value={registerForm.sensorId}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, sensorId: event.target.value }))
              }
              placeholder="SPOT-014"
              maxLength={registerForm.protocol === "BLE_GATEWAY" ? 8 : 50}
              pattern={registerForm.protocol === "BLE_GATEWAY" ? "[A-Za-z0-9_-]{1,8}" : undefined}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            />
            {registerForm.protocol === "BLE_GATEWAY" ? (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">BLE 광고 프로토콜 제한에 따라 영문·숫자·-·_ 조합 8자 이하만 사용할 수 있습니다.</span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            MAC 주소 *
            <input
              value={registerForm.macAddress}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, macAddress: event.target.value }))
              }
              placeholder="AA:BB:CC:DD:EE:FF"
              maxLength={20}
              pattern={registerForm.protocol === "BLE_GATEWAY" ? "[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}" : undefined}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            모델 *
            <input
              value={registerForm.model}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, model: event.target.value }))
              }
              placeholder="XIAO-NRF52840-VL53L1X"
              maxLength={100}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              센서 유형
              <select
              value={registerForm.type}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, type: event.target.value }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {SENSOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              통신 방식
              <select
              value={registerForm.protocol}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, protocol: event.target.value }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {SENSOR_PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              공간
              <select
              value={selectedRegisterPlaceId}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  placeId: Number(event.target.value),
                  gatewayId: "",
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {(state.workspace?.spaces ?? []).map((space) => (
                <option key={space.spaceId} value={space.spaceId}>
                  {space.name}
                </option>
              ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              게이트웨이 *
              <select
              value={registerForm.gatewayId}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  gatewayId: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            >
              <option value="">게이트웨이 선택</option>
              {registerGatewayOptions.map((gateway) => (
                <option key={gateway.gatewayId} value={gateway.gatewayId}>
                  {gateway.gatewayId}
                </option>
              ))}
              </select>
            </label>
          </div>
          {actionError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{actionError}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeRegisterModal}
              disabled={actionSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button type="submit" disabled={actionSubmitting} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {actionSubmitting ? "등록 중..." : "센서 등록"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        open={isInstallModalOpen}
        title="센서 배치 변경"
        description="선택한 센서를 원하는 공간과 게이트웨이에 연결합니다."
        onClose={closeInstallModal}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!installForm.sensorId) {
              setActionError("설치할 센서를 선택해 주세요.");
              return;
            }
            if (!installForm.gatewayId) {
              setActionError("센서를 연결할 게이트웨이를 선택해 주세요.");
              return;
            }

            void (async () => {
              const ok = await executeAction(
                (headers) =>
                  installSensorDevice(
                    headers,
                    installForm.sensorId,
                    selectedInstallPlaceId,
                    installForm.gatewayId || null,
                  ),
                `${installForm.sensorId} 설치 정보를 반영했습니다.`,
              );

              if (ok) {
                closeInstallModal();
              }
            })();
          }}
        >
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            센서 *
            <select
              value={installForm.sensorId}
              onChange={(event) => {
                const nextSensorId = event.target.value;
                const selectedSensor = state.workspace?.sensors.find((sensor) => sensor.sensorId === nextSensorId);
                setInstallForm((current) => ({
                  ...current,
                  sensorId: nextSensorId,
                  placeId: selectedSensor?.placeId ?? current.placeId,
                  gatewayId: selectedSensor?.gatewayId ?? "",
                }));
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            >
              <option value="">센서 선택</option>
              {state.workspace?.sensors.map((sensor) => (
                <option key={sensor.sensorId} value={sensor.sensorId}>
                  {sensor.sensorId}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              공간 *
              <select
              value={selectedInstallPlaceId}
              onChange={(event) =>
                setInstallForm((current) => ({
                  ...current,
                  placeId: Number(event.target.value),
                  gatewayId: "",
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {(state.workspace?.spaces ?? []).map((space) => (
                <option key={space.spaceId} value={space.spaceId}>
                  {space.name}
                </option>
              ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              게이트웨이 *
              <select
              value={installForm.gatewayId}
              onChange={(event) =>
                setInstallForm((current) => ({
                  ...current,
                  gatewayId: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
              required
            >
              <option value="">게이트웨이 선택</option>
              {installGatewayOptions.map((gateway) => (
                <option key={gateway.gatewayId} value={gateway.gatewayId}>
                  {gateway.gatewayId}
                </option>
              ))}
              </select>
            </label>
          </div>
          {actionError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{actionError}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeInstallModal}
              disabled={actionSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button type="submit" disabled={actionSubmitting} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {actionSubmitting ? "적용 중..." : "배치 적용"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        open={isCommandModalOpen}
        title="센서 명령 전송"
        description={isBleCommandTarget
          ? "명령을 대기열에 등록하면 gateway scanner가 BLE GATT로 전달하고 ACK를 회수합니다."
          : "명령을 센서 대기열에 등록합니다. 실제 전달 방식과 ACK 지원 여부는 대상 프로토콜 연동에 따릅니다."}
        onClose={closeCommandModal}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!commandForm.sensorId) {
              setActionError("명령을 전송할 센서를 선택해 주세요.");
              return;
            }
            if (
              ["SET_THRESHOLD", "SET_SAMPLE_INTERVAL"].includes(commandForm.commandType)
              && !commandForm.commandPayload.trim()
            ) {
              setActionError("선택한 명령에 필요한 payload를 입력해 주세요.");
              return;
            }
            if (isBleCommandTarget && commandForm.commandType === "SET_THRESHOLD") {
              const parts = commandForm.commandPayload.split(",").map((part) => Number(part.trim()));
              if (
                parts.length !== 2
                || parts.some((part) => !Number.isInteger(part) || part < 40 || part > 4000)
                || parts[0] >= parts[1]
              ) {
                setActionError("BLE 거리 임계값은 40~4000mm 범위의 enterMm,exitMm 형식이며 enterMm가 더 작아야 합니다.");
                return;
              }
            }
            if (isBleCommandTarget && commandForm.commandType === "SET_SAMPLE_INTERVAL") {
              const interval = Number(commandForm.commandPayload.trim());
              if (!Number.isInteger(interval) || interval < 200 || interval > 60000) {
                setActionError("BLE 측정 간격은 200~60000 사이의 밀리초 정수로 입력해 주세요.");
                return;
              }
            }

            void (async () => {
              const ok = await executeAction(
                (headers) =>
                  createSensorCommand(headers, {
                    sensorId: commandForm.sensorId,
                    commandType: commandForm.commandType,
                    commandPayload: commandForm.commandPayload || null,
                  }),
                `${commandForm.sensorId}의 ${commandForm.commandType} 명령을 대기열에 등록했습니다.`,
              );

              if (ok) {
                closeCommandModal();
              }
            })();
          }}
        >
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            대상 센서 *
            <select
            value={commandForm.sensorId}
            onChange={(event) => setCommandForm({
              sensorId: event.target.value,
              commandType: SENSOR_COMMAND_TYPES[0],
              commandPayload: "",
            })}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
            required
          >
            <option value="">센서 선택</option>
            {state.workspace?.sensors.map((sensor) => (
              <option key={sensor.sensorId} value={sensor.sensorId}>
                {sensor.sensorId}
              </option>
            ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            명령 *
            <select
            value={commandForm.commandType}
            onChange={(event) => {
              setActionError(null);
              setCommandForm((current) => ({
                ...current,
                commandType: event.target.value,
                commandPayload: "",
              }));
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none dark:border-slate-700 dark:bg-slate-900"
          >
            {SENSOR_COMMAND_TYPES.map((command) => (
              <option key={command} value={command} disabled={isBleCommandTarget && command === "SYNC_TIME"}>
                {command}
              </option>
            ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            명령 값
            <textarea
            value={commandForm.commandPayload}
            disabled={!["SET_THRESHOLD", "SET_SAMPLE_INTERVAL"].includes(commandForm.commandType)}
            onChange={(event) =>
              setCommandForm((current) => ({
                ...current,
                commandPayload: event.target.value,
              }))
            }
            placeholder={
              commandForm.commandType === "SET_THRESHOLD"
                ? "enterMm,exitMm (예: 700,850)"
                : commandForm.commandType === "SET_SAMPLE_INTERVAL"
                  ? "milliseconds (예: 1000)"
                  : "이 명령은 payload가 필요하지 않습니다."
            }
            rows={4}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
            />
          </label>
          {actionError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{actionError}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCommandModal}
              disabled={actionSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button type="submit" disabled={actionSubmitting} className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60">
              {actionSubmitting ? "등록 중..." : "명령 대기열에 등록"}
            </button>
          </div>
        </form>
      </ModalFrame>
    </ShellContent>
  );
}

/** 단일 센서의 identity, 배치, 감지 상태와 최근 관측 정보를 표시한다. */
export function SensorDetailScreen({ sensorId }: { sensorId: string }) {
  const state = useWorkspaceLoader();
  const sensor = useMemo(
    () => state.workspace?.sensors.find((item) => item.sensorId === sensorId) ?? null,
    [sensorId, state.workspace?.sensors],
  );
  const space = useMemo(
    () => state.workspace?.spaces.find((item) => item.spaceId === sensor?.placeId) ?? null,
    [sensor?.placeId, state.workspace?.spaces],
  );

  const history = useMemo(() => {
    if (!space) {
      return [];
    }

    const telemetry = space.recentTelemetry.filter((item) => item.sensorId === sensor?.sensorId);
    return telemetry.slice(0, 8).map((item) => ({
      label: formatShortTime(item.measuredAt ?? item.receivedAt),
      value: item.occupied ? 100 : 0,
    }));
  }, [sensor?.sensorId, space]);

  const logs = useMemo(
    () => state.workspace?.logs.filter((item) => item.sensorId === sensor?.sensorId).slice(0, 8) ?? [],
    [sensor?.sensorId, state.workspace?.logs],
  );

  return (
    <ShellContent
      activeKey="sensors"
      title={sensor ? `${sensor.sensorId} 상세` : "센서 상세"}
      subtitle="센서별 감지 이력, 배터리, 상태 로그를 상세하게 확인합니다."
      state={state}
      toolbar={
        <Link
          href="/sensors"
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          센서 목록으로
        </Link>
      }
    >
      {sensor && space ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="감지 상태"
              value={detectionStatusLabel(sensor.detectionStatus)}
              hint={`${space.name} · ${textOrFallback(sensor.locationLabel, "위치 미지정")}`}
            />
            <MetricCard
              label="연결 게이트웨이"
              value={textOrFallback(sensor.gatewayId, "미배치")}
              hint={textOrFallback(sensor.positionCode ?? sensor.locationLabel, "위치 미지정")}
              tone="emerald"
            />
            <MetricCard
              label="배터리"
              value={sensor.batteryPercent !== null ? `${sensor.batteryPercent.toFixed(0)}%` : "확인 불가"}
              hint={sensor.batteryLabel}
              tone="orange"
            />
            <MetricCard
              label="마지막 관측"
              value={formatRelative(sensor.lastObservedAt)}
              hint={formatDateTime(sensor.lastObservedAt)}
              tone="rose"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">최근 감지 이력</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">최근 수신값을 사용 중 100%, 비어 있음 0%로 표시합니다.</p>
                </div>
                <StatusBadge tone={sensor.status === "ACTIVE" ? "success" : "warning"}>
                  {sensorLifecycleLabel(sensor.status)}
                </StatusBadge>
              </div>
              <div className="mt-5">
                <MiniBars points={history} />
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">센서 정보</h2>
                <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-500">공간</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{space.name}</dd>
                  <dt className="text-slate-500">게이트웨이</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{textOrFallback(sensor.gatewayId, "미등록")}</dd>
                  <dt className="text-slate-500">통신 방식</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{sensor.protocol}</dd>
                  <dt className="text-slate-500">펌웨어</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">{textOrFallback(sensor.firmwareVersion, "미등록")}</dd>
                  <dt className="text-slate-500">MAC 주소</dt>
                  <dd className="break-all font-mono text-slate-900 dark:text-white">{sensor.macAddress ?? "확인 불가"}</dd>
                </dl>
              </Panel>

              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">관련 이벤트</h2>
                <div className="mt-4 space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                      <p className="font-bold text-slate-900 dark:text-white">{log.eventType}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{log.details}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                    </div>
                  ))}
                  {logs.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">관련 이벤트가 없습니다.</p> : null}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="센서를 찾지 못했습니다."
          description="센서 목록으로 돌아가 다른 센서를 선택해 주세요."
        />
      )}
    </ShellContent>
  );
}

/** gateway 상태·부하·통신 품질을 비교하고 신규 gateway를 등록한다. */
export function GatewaysScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [gatewayForm, setGatewayForm] = useState({
    gatewayId: "",
    gatewayName: "",
    spaceId: "",
    gatewayRole: "EDGE",
    regionCode: "",
    locationLabel: "",
    ipAddress: "",
    sensorCapacity: "64",
    firmwareVersion: "",
    linkedBridge: "",
    description: "",
  });
  const deferredQuery = useDeferredValue(query);

  const gateways = useMemo(() => {
    const list = state.workspace?.gateways ?? [];
    if (!deferredQuery.trim()) {
      return list;
    }
    const keyword = deferredQuery.toLowerCase();
    return list.filter(
      (gateway) =>
        gateway.gatewayId.toLowerCase().includes(keyword) ||
        (gateway.gatewayName?.toLowerCase() ?? "").includes(keyword) ||
        gateway.spaceName.toLowerCase().includes(keyword) ||
        (gateway.linkedBridge?.toLowerCase() ?? "").includes(keyword) ||
        (gateway.ipAddress?.toLowerCase() ?? "").includes(keyword) ||
        (gateway.locationLabel?.toLowerCase() ?? "").includes(keyword) ||
        (gateway.regionCode?.toLowerCase() ?? "").includes(keyword),
    );
  }, [deferredQuery, state.workspace?.gateways]);
  const activeGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Active").length;
  const warningGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Warning").length;
  const offlineGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Offline").length;
  const topSensorGateways = gateways
    .filter((gateway) => gatewayLoadPercent(gateway) != null)
    .slice()
    .sort((left, right) => (gatewayLoadPercent(right) ?? 0) - (gatewayLoadPercent(left) ?? 0))
    .slice(0, 7);
  const recentGatewayLogs = (state.workspace?.logs ?? [])
    .filter((log) => Boolean(log.gatewayId))
    .slice(0, 5);
  const resetGatewayForm = useCallback(() => {
    setGatewayForm({
      gatewayId: "",
      gatewayName: "",
      spaceId: state.workspace?.spaces[0]?.spaceId?.toString() ?? "",
      gatewayRole: "EDGE",
      regionCode: "",
      locationLabel: "",
      ipAddress: "",
      sensorCapacity: "64",
      firmwareVersion: "",
      linkedBridge: "",
      description: "",
    });
    setCreateError(null);
  }, [state.workspace?.spaces]);
  const openCreateModal = useCallback(() => {
    resetGatewayForm();
    setCreateModalOpen(true);
  }, [resetGatewayForm]);
  const closeCreateModal = useCallback(() => {
    if (createSubmitting) {
      return;
    }
    setCreateModalOpen(false);
    setCreateError(null);
  }, [createSubmitting]);
  const submitCreateGateway = useCallback(async () => {
    setCreateError(null);

    if (!gatewayForm.gatewayId.trim() || !gatewayForm.gatewayName.trim() || !gatewayForm.spaceId) {
      setCreateError("gatewayId, gatewayName, 공간은 필수입니다.");
      return;
    }

    const sensorCapacity = Number(gatewayForm.sensorCapacity);
    const spaceId = Number(gatewayForm.spaceId);
    if (!Number.isInteger(sensorCapacity) || sensorCapacity < 1) {
      setCreateError("센서 수용량은 1 이상의 정수여야 합니다.");
      return;
    }
    if (!Number.isInteger(spaceId) || spaceId < 1) {
      setCreateError("공간을 올바르게 선택해 주세요.");
      return;
    }

    const payload: CreateGatewayInput = {
      gatewayId: gatewayForm.gatewayId.trim(),
      gatewayName: gatewayForm.gatewayName.trim(),
      spaceId,
      gatewayRole: gatewayForm.gatewayRole,
      regionCode: gatewayForm.regionCode.trim() || undefined,
      locationLabel: gatewayForm.locationLabel.trim() || undefined,
      ipAddress: gatewayForm.ipAddress.trim() || undefined,
      sensorCapacity,
      firmwareVersion: gatewayForm.firmwareVersion.trim() || undefined,
      description: gatewayForm.description.trim() || undefined,
      linkedBridge: gatewayForm.linkedBridge.trim() || undefined,
    };

    setCreateSubmitting(true);
    try {
      const headers = await state.resolveAuthHeaders();
      if (!headers) {
        setCreateError("인증 세션을 확인할 수 없습니다.");
        return;
      }
      await createGateway(headers, payload);
      await state.reload();
      setCreateModalOpen(false);
      resetGatewayForm();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "게이트웨이 생성에 실패했습니다.");
    } finally {
      setCreateSubmitting(false);
    }
  }, [gatewayForm, resetGatewayForm, state]);

  return (
    <ShellContent
      activeKey="gateways"
      title="게이트웨이 관리"
      subtitle="게이트웨이 연결 상태와 센서 수용량, 최근 통신 이벤트를 확인합니다."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "이름, ID, IP, 공간 또는 위치 검색")}
          {toolButton("게이트웨이 등록", openCreateModal, "primary", (state.workspace?.spaces.length ?? 0) === 0)}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard
              label="전체 게이트웨이"
              value={formatNumber(gateways.length)}
              hint="현재 관리자 공간에 등록된 장비 수"
            />
            <MetricCard
              label="정상"
              value={formatNumber(activeGatewayCount)}
              hint="최근 상태가 온라인인 장비"
              tone="emerald"
            />
            <MetricCard
              label="주의"
              value={formatNumber(warningGatewayCount)}
              hint="최근 하트비트는 유효하지만 WARNING 상태를 보고한 장비"
              tone="orange"
            />
            <MetricCard
              label="오프라인"
              value={formatNumber(offlineGatewayCount)}
              hint="하트비트 지연 또는 오프라인 보고"
              tone="rose"
            />
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  게이트웨이 목록
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  최근 상태
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">검색 결과 {gateways.length}개</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50/70 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-6 py-4">게이트웨이</th>
                    <th className="px-6 py-4">IP 주소</th>
                    <th className="px-6 py-4">센서 수용량</th>
                    <th className="px-6 py-4">지연 시간</th>
                    <th className="px-6 py-4 text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gateways.map((gateway) => (
                    <tr
                      key={gateway.gatewayId}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4">
                        <Link href={`/gateways/${gateway.gatewayId}`} className="flex items-center gap-3">
                          <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-300">
                            <Icon name="gateways" className="size-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {textOrFallback(gateway.gatewayName, gateway.gatewayId)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {textOrFallback(gateway.locationLabel, gateway.spaceName)}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">
                        {textOrFallback(gateway.ipAddress)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex w-32 flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>
                              {formatNumber(gateway.currentSensorLoad ?? gateway.connectedSensors.length)}/
                              {gateway.sensorCapacity != null ? formatNumber(gateway.sensorCapacity) : "확인 불가"}
                            </span>
                            <span className={cn((gatewayLoadPercent(gateway) ?? 0) > 100 ? "text-amber-500" : "text-blue-500")}>
                              {formatGatewayLoadPercent(gateway)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                (gatewayLoadPercent(gateway) ?? 0) > 100 ? "bg-amber-500" : "bg-blue-500",
                              )}
                              style={{ width: `${Math.min(gatewayLoadPercent(gateway) ?? 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("text-sm font-semibold", gateway.status === "Offline" ? "text-slate-500" : "text-slate-800 dark:text-slate-200")}>
                          {gateway.status === "Offline"
                            ? "응답 없음"
                            : gateway.latencyMs != null
                              ? `${gateway.latencyMs}ms`
                              : "확인 불가"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge tone={gatewayDisplayTone(gateway)}>
                          {gatewayDisplayLabel(gateway)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gateways.length === 0 ? (
              <div className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <p>
                  {query.trim()
                    ? "검색 조건에 맞는 게이트웨이가 없습니다."
                    : (state.workspace?.spaces.length ?? 0) === 0
                      ? "게이트웨이를 등록하려면 먼저 공간을 등록해 주세요."
                      : "등록된 게이트웨이가 없습니다."}
                </p>
                {!query.trim() && (state.workspace?.spaces.length ?? 0) === 0 ? (
                  <Link href="/areas" className="mt-3 inline-flex min-h-10 items-center font-bold text-blue-700 hover:underline dark:text-blue-300">
                    공간 관리로 이동
                  </Link>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">센서 수용량 사용률</h2>
              {topSensorGateways.length > 0 ? (
                <div className="mt-6 flex h-48 items-end justify-between gap-2 px-4">
                  {topSensorGateways.map((gateway) => (
                  <div key={gateway.gatewayId} className="relative flex h-full flex-1 flex-col justify-end">
                    <div className="relative h-full rounded-t-sm bg-blue-500/20">
                      <span className="absolute inset-x-0 top-1 z-10 text-center text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                        {formatGatewayLoadPercent(gateway)}
                      </span>
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-sm bg-blue-500"
                        style={{
                          height: `${Math.min(gatewayLoadPercent(gateway) ?? 0, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {(gateway.regionCode || gateway.gatewayId).slice(0, 8)}
                    </div>
                  </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                  등록된 센서 용량 정보가 없습니다.
                </p>
              )}
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">최근 게이트웨이 이벤트</h2>
              <div className="mt-5 space-y-3">
                {recentGatewayLogs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div
                      className={cn(
                        "mt-1 size-2 rounded-full",
                        log.severity === "critical"
                          ? "bg-rose-500"
                          : log.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-emerald-500",
                      )}
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {log.eventType}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatDateTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {recentGatewayLogs.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">게이트웨이 관련 최근 로그가 없습니다.</p>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="게이트웨이 데이터를 불러오지 못했습니다."
          description="공간별 센서가 로드되면 게이트웨이 연결 뷰도 함께 채워집니다."
        />
      )}
      <ModalFrame
        open={isCreateModalOpen}
        title="게이트웨이 등록"
        description="게이트웨이는 반드시 하나의 공간에 귀속됩니다. 등록 후 센서를 해당 gatewayId에 매핑할 수 있습니다."
        onClose={closeCreateModal}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              신규 게이트웨이는 기본 OFFLINE 상태로 등록되며, runtime heartbeat가 들어오면 상태가 갱신됩니다.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="submit"
                form="create-gateway-form"
                disabled={createSubmitting}
                className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                {createSubmitting ? "등록 중..." : "게이트웨이 등록"}
              </button>
            </div>
          </div>
        }
      >
        <form
          id="create-gateway-form"
          className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreateGateway();
          }}
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">게이트웨이 ID *</span>
              <input
                value={gatewayForm.gatewayId}
                onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayId: event.target.value }))}
                placeholder="GW-STORE-001"
                required
                maxLength={50}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">게이트웨이 이름 *</span>
              <input
                value={gatewayForm.gatewayName}
                onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayName: event.target.value }))}
                placeholder="강남점 엣지 게이트웨이 01"
                required
                maxLength={100}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">공간 *</span>
                <select
                  value={gatewayForm.spaceId}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, spaceId: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  required
                >
                  <option value="">공간 선택</option>
                  {(state.workspace?.spaces ?? []).map((space) => (
                    <option key={space.spaceId} value={space.spaceId}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">게이트웨이 역할</span>
                <select
                  value={gatewayForm.gatewayRole}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayRole: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  {GATEWAY_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">IP 주소</span>
                <input
                  value={gatewayForm.ipAddress}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, ipAddress: event.target.value }))}
                  placeholder="192.168.0.24"
                  maxLength={45}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">센서 수용량 *</span>
                <input
                  value={gatewayForm.sensorCapacity}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, sensorCapacity: event.target.value }))}
                  type="number"
                  min={1}
                  step={1}
                  required
                  placeholder="64"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4">
            <Panel className="border-blue-100 bg-blue-50 shadow-none dark:border-blue-500/10 dark:bg-blue-500/5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-500 dark:text-blue-300">
                런타임 정보
              </p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">지역 코드</span>
                  <input
                    value={gatewayForm.regionCode}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, regionCode: event.target.value }))}
                    placeholder="SEOUL-GANGNAM"
                    maxLength={50}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">설치 위치</span>
                  <input
                    value={gatewayForm.locationLabel}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, locationLabel: event.target.value }))}
                    placeholder="북측 통로 장비함"
                    maxLength={100}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">펌웨어 버전</span>
                  <input
                    value={gatewayForm.firmwareVersion}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, firmwareVersion: event.target.value }))}
                    placeholder="v1.0.0"
                    maxLength={50}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">연결 브리지</span>
                  <input
                    value={gatewayForm.linkedBridge}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, linkedBridge: event.target.value }))}
                    placeholder="ble://store-001"
                    maxLength={255}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              </div>
            </Panel>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">설명</span>
              <textarea
                value={gatewayForm.description}
                onChange={(event) => setGatewayForm((current) => ({ ...current, description: event.target.value }))}
                rows={6}
                placeholder="의자 센서 BLE 스캔과 cloud sync를 담당하는 게이트웨이 설명"
                maxLength={1000}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <p className="font-semibold text-slate-900 dark:text-white">등록 규칙</p>
              <ul className="mt-3 space-y-2">
                <li>게이트웨이는 반드시 한 공간에 귀속됩니다.</li>
                <li>신규 등록 직후 상태는 OFFLINE으로 시작합니다.</li>
                <li>이후 센서를 이 gatewayId에 연결하면 공간 내 센서 묶음으로 표시됩니다.</li>
              </ul>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {createError}
              </div>
            ) : null}
          </div>
        </form>
      </ModalFrame>
    </ShellContent>
  );
}

/** 단일 gateway의 runtime 상태와 해당 gateway에 연결된 센서를 표시한다. */
export function GatewayDetailScreen({ gatewayId }: { gatewayId: string }) {
  const state = useWorkspaceLoader();
  const gateway = useMemo(
    () => state.workspace?.gateways.find((item) => item.gatewayId === gatewayId) ?? null,
    [gatewayId, state.workspace?.gateways],
  );
  const batteryTrend = useMemo(
    () =>
      gateway?.connectedSensors
        .filter((sensor) => sensor.batteryPercent !== null)
        .slice(0, 8)
        .map((sensor) => ({
          label: sensor.sensorId,
          value: sensor.batteryPercent ?? 0,
        })) ?? [],
    [gateway?.connectedSensors],
  );
  const logs = useMemo(
    () => state.workspace?.logs.filter((item) => item.gatewayId === gateway?.gatewayId).slice(0, 8) ?? [],
    [gateway?.gatewayId, state.workspace?.logs],
  );

  return (
    <ShellContent
      activeKey="gateways"
      title={gateway ? `${gateway.gatewayId} 상세` : "게이트웨이 상세"}
      subtitle="게이트웨이와 연결된 센서 묶음을 세부 점검합니다."
      state={state}
      toolbar={
        <Link
          href="/gateways"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          게이트웨이 목록으로
        </Link>
      }
    >
      {gateway ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="연결 센서"
              value={formatNumber(gateway.connectedSensors.length)}
              hint={gateway.spaceName}
            />
            <MetricCard
              label="연결 브리지"
              value={textOrFallback(gateway.linkedBridge)}
              hint="등록된 게이트웨이 연결 경로"
              tone="orange"
            />
            <MetricCard
              label="펌웨어"
              value={textOrFallback(gateway.firmwareVersion)}
              hint="등록된 펌웨어 버전"
              tone="emerald"
            />
            <MetricCard
              label="게이트웨이 상태"
              value={gatewayDisplayLabel(gateway)}
              hint={`마지막 통신 ${formatDateTime(gateway.lastHeartbeatAt)}`}
              tone={
                gateway.status === "Online"
                  ? "emerald"
                  : gateway.status === "Warning"
                    ? "orange"
                    : gateway.status === "Offline"
                      ? "rose"
                      : undefined
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">연결 센서</h2>
              {gateway.connectedSensors.length > 0 ? (
                <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="pb-4 pr-4">센서 ID</th>
                      <th className="pb-4 pr-4">유형</th>
                      <th className="pb-4 pr-4">상태</th>
                      <th className="pb-4 pr-4">배터리</th>
                      <th className="pb-4 text-right">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gateway.connectedSensors.map((sensor) => (
                      <tr key={sensor.sensorId}>
                        <td className="py-4 pr-4 font-medium text-slate-900 dark:text-white">{sensor.sensorId}</td>
                        <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">{sensor.type}</td>
                        <td className="py-4 pr-4">
                          <StatusBadge tone={sensor.status === "ACTIVE" ? "success" : "warning"}>
                            {sensorLifecycleLabel(sensor.status)}
                          </StatusBadge>
                        </td>
                        <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">{sensor.batteryLabel}</td>
                        <td className="py-4 text-right">
                          <Link
                            href={`/sensors/${sensor.sensorId}`}
                            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
                          >
                            보기
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">이 게이트웨이에 연결된 센서가 없습니다.</p>
              )}
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">연결 센서 배터리</h2>
                {batteryTrend.length > 0 ? (
                  <div className="mt-5">
                    <MiniBars points={batteryTrend} />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">배터리 정보가 등록된 센서가 없습니다.</p>
                )}
              </Panel>

              <Panel>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">최근 활동</h2>
                {logs.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/35">
                        <p className="font-medium text-slate-900 dark:text-white">{log.eventType}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{log.details}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">이 게이트웨이의 최근 이벤트가 없습니다.</p>
                )}
              </Panel>
            </div>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="게이트웨이를 찾을 수 없습니다."
          description="게이트웨이 목록에서 다시 선택해 주세요."
        />
      )}
    </ShellContent>
  );
}

/** 현재 workspace와 센서 usage 응답으로 계산 가능한 운영 통계를 표시한다. */
export function AnalyticsScreen() {
  const state = useWorkspaceLoader();
  const [focusSpaceId, setFocusSpaceId] = useState<number | null>(null);
  const spaces = state.workspace?.spaces ?? [];
  const focusSpace = spaces.find((space) => space.spaceId === focusSpaceId) ?? spaces[0] ?? null;
  const { history, usage, error: historyError } = useSpaceHistoryState(state, focusSpace);
  const rankingSpaces = spaces
    .filter(hasAvailableOccupancy)
    .slice()
    .sort((left, right) => right.occupancyRate - left.occupancyRate)
    .slice(0, 5);
  const alertingSpaces = spaces.filter(
    (space) => space.occupancyRate >= 90
      || space.lowBatteryCount > 0
      || space.offlineCount > 0
      || space.sensors.some((sensor) => sensor.detectionStatus === "Unreliable"),
  );
  const peakHistoryPoint =
    history.reduce<{ label: string; value: number } | null>((current, point) => {
      if (!current || point.value > current.value) {
        return point;
      }
      return current;
    }, null) ?? null;
  const findings = [
    rankingSpaces[0]
      ? {
          tone: rankingSpaces[0].occupancyRate >= 90
            ? "critical" as const
            : rankingSpaces[0].occupancyRate >= 75
              ? "warning" as const
              : "info" as const,
          title: "가장 혼잡한 공간",
          message: `${rankingSpaces[0].name}의 신뢰 가능한 최근 점유율이 ${Math.round(
            rankingSpaces[0].occupancyRate,
          )}%로 가장 높습니다.`,
        }
      : null,
    alertingSpaces.find((space) => space.offlineCount > 0)
      ? {
          tone: "warning" as const,
          title: "장비 점검 필요",
          message: `${alertingSpaces.find((space) => space.offlineCount > 0)?.name}에 오프라인 센서가 있습니다.`,
        }
      : null,
    alertingSpaces.find((space) => space.lowBatteryCount > 0)
      ? {
          tone: "info" as const,
          title: "배터리 점검",
          message: `${alertingSpaces.find((space) => space.lowBatteryCount > 0)?.name}에 배터리 교체를 검토할 센서가 있습니다.`,
        }
      : null,
    alertingSpaces.find((space) => space.sensors.some((sensor) => sensor.detectionStatus === "Unreliable"))
      ? {
          tone: "warning" as const,
          title: "측정 신뢰도 점검",
          message: `${alertingSpaces.find(
            (space) => space.sensors.some((sensor) => sensor.detectionStatus === "Unreliable"),
          )?.name}에 최신 측정값의 신뢰도가 낮은 센서가 있습니다.`,
        }
      : null,
  ].filter(Boolean) as Array<{ tone: "critical" | "warning" | "info"; title: string; message: string }>;

  return (
    <ShellContent
      activeKey="analytics"
      title="사용 분석"
      subtitle="현재 공간 비교와 선택된 기준 공간의 실제 관측 데이터를 확인합니다."
      state={state}
      toolbar={
        spaces.length > 0 ? (
          <select
            aria-label="사용률 분석 기준 공간"
            value={focusSpace?.spaceId ?? ""}
            onChange={(event) => setFocusSpaceId(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {spaces.map((space) => (
              <option key={space.spaceId} value={space.spaceId}>{space.name}</option>
            ))}
          </select>
        ) : undefined
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="현재 사용 중"
              value={formatNumber(state.workspace.summary.occupiedNow)}
              hint={`현재 보고 가능한 센서 기준 ${formatPercent(state.workspace.summary.occupancyRate)}`}
            />
            <MetricCard
              label="기준 공간 최대 시간"
              value={formatHourLabel(peakHistoryPoint?.label)}
              hint={peakHistoryPoint ? `${focusSpace?.name ?? "기준 공간"} · 실측 ${Math.round(peakHistoryPoint.value)}%` : "관측 데이터 없음"}
              tone="orange"
            />
            <MetricCard
              label="관리 공간"
              value={formatNumber(spaces.length)}
              hint="현재 관리자 프로필에 등록된 영역 수"
              tone="rose"
            />
            <MetricCard
              label="점검 필요 공간"
              value={formatNumber(alertingSpaces.length)}
              hint="혼잡·배터리·센서 상태 기준"
              tone="emerald"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">시간대별 실측 사용률</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {focusSpace ? `${focusSpace.name}을 기준으로 표시합니다.` : "기준으로 삼을 공간이 없습니다."}
                </p>
              </div>
              <div className="mt-6">
                <MiniBars points={history} />
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                관측 커버리지 {usage ? `${usage.coveragePercent.toFixed(1)}%` : "확인 불가"} · 미수집 구간은
                빈자리로 추정하지 않습니다.
              </p>
              {historyError ? (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{historyError}</p>
              ) : null}
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">공간별 사용률 순위</h2>
              {rankingSpaces.length > 0 ? (
                <div className="mt-5 space-y-4">
                {rankingSpaces.map((space) => (
                  <div key={space.spaceId} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {space.name}
                        </span>
                        <span className="text-sm text-slate-500">
                          {Math.round(space.occupancyRate)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min(Math.max(space.occupancyRate, 0), 100)}%`,
                            opacity: 0.35 + Math.min(space.occupancyRate / 100, 0.65),
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {occupancyStateLabel(space)}
                    </span>
                  </div>
                ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">비교할 수 있는 신뢰 가능한 점유 데이터가 없습니다.</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  공간 상태 비교
                </h2>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="pb-3 pr-4">공간</th>
                      <th className="pb-3 pr-4">점유 현황</th>
                      <th className="pb-3 pr-4">센서</th>
                      <th className="pb-3 pr-4">배터리 점검</th>
                      <th className="pb-3">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {spaces.map((space) => (
                      <tr key={space.spaceId}>
                        <td className="py-4 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{space.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{textOrFallback(space.addressLabel)}</p>
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-700 dark:text-slate-300">
                          {hasAvailableOccupancy(space)
                            ? `${formatNumber(space.occupiedCount)}개 사용 중 (${Math.round(space.occupancyRate)}%)`
                            : "신뢰 가능한 최신값 없음"}
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatNumber(space.sensors.length)}
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatNumber(space.lowBatteryCount)}
                        </td>
                        <td className="py-4">
                          <StatusBadge tone={occupancyStateTone(space)}>{occupancyStateLabel(space)}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel className="flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">운영 점검 항목</h2>
              <div className="mt-5 space-y-4">
                {findings.length > 0 ? (
                  findings.map((finding, index) => (
                    <div
                      key={`${finding.title}-${index}`}
                      className={cn(
                        "rounded-xl border-l-4 bg-slate-50 p-3 dark:bg-slate-800/40",
                        finding.tone === "critical"
                          ? "border-rose-500"
                          : finding.tone === "warning"
                            ? "border-amber-500"
                            : "border-blue-500",
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-[0.18em]",
                          finding.tone === "critical"
                            ? "text-rose-600 dark:text-rose-300"
                            : finding.tone === "warning"
                              ? "text-amber-600 dark:text-amber-300"
                              : "text-blue-600 dark:text-blue-300",
                        )}
                      >
                        {finding.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {finding.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    현재 수집된 데이터 기준으로 별도 이상 징후가 없습니다.
                  </p>
                )}
              </div>
              <Link
                href="/logs"
                className="mt-auto pt-4 text-sm font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
              >
                전체 이벤트 로그 보기
              </Link>
            </Panel>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="분석 데이터를 표시할 수 없습니다."
          description="공간 데이터가 로드되면 비교 분석 화면이 활성화됩니다."
        />
      )}
    </ShellContent>
  );
}

/** 관리자 프로필별 임계값·보존 기간·알림 채널 설정을 조회하고 저장한다. */
export function SettingsScreen() {
  const state = useWorkspaceLoader();
  const { isReady, resolveAuthHeaders, workspace } = state;
  const [settings, setSettings] = useState<AdminConsoleSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warningBuffer, setWarningBuffer] = useState("85");
  const [overCapacity, setOverCapacity] = useState("150");
  const [sensorRetention, setSensorRetention] = useState("90 Days");
  const [errorRetention, setErrorRetention] = useState("30 Days");
  const [alertRetention, setAlertRetention] = useState("1 Year");
  const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(true);
  const [occupancyNotificationsEnabled, setOccupancyNotificationsEnabled] = useState(true);
  const [batteryNotificationsEnabled, setBatteryNotificationsEnabled] = useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySettings = useCallback((nextSettings: AdminConsoleSettings) => {
    setSettings(nextSettings);
    setOverCapacity(String(nextSettings.overcapacityLimit));
    setWarningBuffer(String(nextSettings.warningBufferPercent));
    setSensorRetention(nextSettings.sensorRawDataRetention);
    setErrorRetention(nextSettings.systemErrorRetention);
    setAlertRetention(nextSettings.alertHistoryRetention);
    setAllNotificationsEnabled(nextSettings.allNotificationsEnabled);
    setOccupancyNotificationsEnabled(nextSettings.occupancyNotificationsEnabled);
    setBatteryNotificationsEnabled(nextSettings.batteryNotificationsEnabled);
    setEmailNotificationsEnabled(nextSettings.emailNotificationsEnabled);
    setPushNotificationsEnabled(nextSettings.pushNotificationsEnabled);
    setSmsNotificationsEnabled(nextSettings.smsNotificationsEnabled);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isReady) {
      return;
    }

    void (async () => {
      setSettingsLoading(true);
      setError(null);

      try {
        const headers = await resolveAuthHeaders();
        if (cancelled) {
          return;
        }
        if (!headers) {
          throw new Error("관리자 설정 조회에 필요한 인증 세션이 없습니다.");
        }
        const nextSettings = await loadAdminConsoleSettings(headers);
        if (cancelled) {
          return;
        }
        applySettings(nextSettings);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "설정 데이터를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySettings, isReady, resolveAuthHeaders]);

  const saveSettings = useCallback(async () => {
    if (!isReady || !settings) {
      return;
    }

    const parsedOverCapacity = Number(overCapacity);
    const parsedWarningBuffer = Number(warningBuffer);
    if (!Number.isInteger(parsedOverCapacity) || parsedOverCapacity < 1) {
      setNotice(null);
      setError("초과 수용 인원 기준은 1 이상의 정수로 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(parsedWarningBuffer) || parsedWarningBuffer < 1 || parsedWarningBuffer > 100) {
      setNotice(null);
      setError("사전 경고 비율은 1~100 사이의 정수로 입력해 주세요.");
      return;
    }

    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const headers = await resolveAuthHeaders();
      if (!headers) {
        setError("인증 세션을 확인할 수 없습니다.");
        return;
      }
      const nextSettings = await updateAdminConsoleSettings(headers, {
        overcapacityLimit: parsedOverCapacity,
        warningBufferPercent: parsedWarningBuffer,
        sensorRawDataRetention: sensorRetention,
        systemErrorRetention: errorRetention,
        alertHistoryRetention: alertRetention,
        allNotificationsEnabled,
        occupancyNotificationsEnabled,
        batteryNotificationsEnabled,
        emailNotificationsEnabled,
        pushNotificationsEnabled,
        smsNotificationsEnabled,
      });
      applySettings(nextSettings);
      setNotice("관리자 설정을 저장했습니다.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "관리자 설정을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    alertRetention,
    allNotificationsEnabled,
    applySettings,
    batteryNotificationsEnabled,
    emailNotificationsEnabled,
    errorRetention,
    occupancyNotificationsEnabled,
    overCapacity,
    pushNotificationsEnabled,
    sensorRetention,
    smsNotificationsEnabled,
    isReady,
    resolveAuthHeaders,
    warningBuffer,
    settings,
  ]);

  const recentChanges =
    workspace?.logs.slice(0, 3).map((item) => ({
      label: item.eventType,
      relative: formatRelative(item.timestamp),
    })) ?? [];
  const retentionOptions = [
    {
      label: "센서 원시 데이터",
      value: sensorRetention,
      setValue: setSensorRetention,
    },
    {
      label: "시스템 오류 로그",
      value: errorRetention,
      setValue: setErrorRetention,
    },
    {
      label: "알림 이력",
      value: alertRetention,
      setValue: setAlertRetention,
    },
  ];
  const notificationOptions = [
    {
      label: "전체 운영 알림",
      description: "전체 운영 알림의 저장 선호값입니다.",
      checked: allNotificationsEnabled,
      setChecked: setAllNotificationsEnabled,
    },
    {
      label: "혼잡 알림",
      description: "향후 과밀 알림에 사용할 저장 선호값입니다.",
      checked: occupancyNotificationsEnabled,
      setChecked: setOccupancyNotificationsEnabled,
    },
    {
      label: "배터리 알림",
      description: "향후 배터리 알림에 사용할 저장 선호값입니다.",
      checked: batteryNotificationsEnabled,
      setChecked: setBatteryNotificationsEnabled,
    },
    {
      label: "이메일 알림",
      description: "향후 이메일 채널에 사용할 저장 선호값입니다.",
      checked: emailNotificationsEnabled,
      setChecked: setEmailNotificationsEnabled,
    },
    {
      label: "웹 푸시 알림",
      description: "향후 웹 푸시 채널에 사용할 저장 선호값입니다.",
      checked: pushNotificationsEnabled,
      setChecked: setPushNotificationsEnabled,
    },
    {
      label: "문자 알림",
      description: "향후 SMS 채널에 사용할 저장 선호값입니다.",
      checked: smsNotificationsEnabled,
      setChecked: setSmsNotificationsEnabled,
    },
  ];
  const restoreLoadedSettings = useCallback(() => {
    if (settings) {
      applySettings(settings);
      setNotice("저장된 설정값으로 편집 상태를 되돌렸습니다.");
      setError(null);
    }
  }, [applySettings, settings]);

  return (
    <ShellContent
      activeKey="settings"
      title="운영 설정"
      subtitle="관리자 프로필의 임계값과 보관·알림 선호값을 조회하고 저장합니다."
      state={state}
      toolbar={toolButton(
        settingsLoading ? "불러오는 중..." : saving ? "저장 중..." : "설정 저장",
        () => void saveSettings(),
        "primary",
        settingsLoading || saving || !settings,
      )}
    >
      {workspace ? (
        <div className="space-y-6">
          <NoticeStrip notice={notice} error={error} />
          {settingsLoading ? (
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">설정 불러오기</h2>
                <StatusBadge tone="info">진행 중</StatusBadge>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">관리자 설정을 불러오는 중입니다.</p>
            </Panel>
          ) : null}
          <Panel>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">저장된 혼잡 기준</h2>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              이 값은 관리자 선호값으로만 저장됩니다. 현재 경보 생성 로직에는 아직 적용되지 않습니다.
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">
                    혼잡 경보 기준
                  </label>
                  <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                    초과 수용 인원과 사전 경고 비율을 정수로 입력해 주세요.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="relative h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="absolute left-0 top-0 h-full rounded-full bg-blue-500" style={{ width: `${Math.min(Math.max(Number(warningBuffer) || 0, 0), 100)}%` }} />
                    </div>
                    <span className="min-w-12 text-right text-lg font-black text-blue-600 dark:text-blue-300">
                      {warningBuffer}%
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">초과 수용 인원</span>
                    <input type="number" min={1} step={1} disabled={!settings || settingsLoading} value={overCapacity} onChange={(event) => setOverCapacity(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">사전 경고 비율 (%)</span>
                    <input type="number" min={1} max={100} step={1} disabled={!settings || settingsLoading} value={warningBuffer} onChange={(event) => setWarningBuffer(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900" />
                  </label>
                </div>
                <div className="flex gap-3">
                  {toolButton("저장값으로 되돌리기", () => restoreLoadedSettings(), "default", !settings || saving)}
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/20 dark:bg-blue-500/10">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">현재 적용 범위</p>
                <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-300">
                  서버는 초과 수용 인원 {overCapacity || "-"}명, 사전 경고 {warningBuffer || "-"}%를 저장합니다.
                  실제 센서 판정이나 알림 발송에 적용하려면 별도의 서버 연동이 필요합니다.
                </p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">데이터 보관 기간</h2>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">저장 선호값이며, 이 값을 사용하는 자동 삭제 작업은 아직 연결되지 않았습니다.</p>
              <div className="mt-5 space-y-4">
                {retentionOptions.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/35">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">관리자 프로필 저장값</p>
                    </div>
                    <select disabled={!settings || settingsLoading} value={item.value} onChange={(event) => item.setValue(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-600 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-300">
                      {[["30 Days", "30일"], ["60 Days", "60일"], ["90 Days", "90일"], ["1 Year", "1년"], ["2 Years", "2년"]].map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">알림 채널</h2>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">채널 선호값만 저장되며 이메일·웹 푸시·문자 발송은 아직 연결되지 않았습니다.</p>
              <div className="mt-5 space-y-4">
                <div className="space-y-3">
                  {notificationOptions.map((item) => (
                    <label key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/35">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                      <input disabled={!settings || settingsLoading} type="checkbox" checked={item.checked} onChange={(event) => item.setChecked(event.target.checked)} className="size-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="flex flex-col gap-6 bg-blue-500/10 dark:bg-blue-500/10 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">현재 관리 범위</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                이 프로필에서 게이트웨이 {workspace.gateways.length}개, 센서 {workspace.sensors.length}개, 알림 {workspace.alerts.length}개를 조회하고 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm font-semibold text-blue-800 dark:text-blue-200">
              <div>
                <p className="text-xl font-black">{workspace.spaces.length}</p>
                <p className="text-xs">공간</p>
              </div>
              <div>
                <p className="text-xl font-black">{workspace.gateways.filter((gateway) => gateway.status === "Online").length}</p>
                <p className="text-xs">온라인</p>
              </div>
              <div>
                <p className="text-xl font-black">{workspace.sensors.filter((sensor) => sensor.status === "ACTIVE").length}</p>
                <p className="text-xs">활성 센서</p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">설정 대상 요약</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>관리 공간: {workspace.spaces.length}개</p>
                <p>관리 센서: {workspace.sensors.length}개</p>
                <p>현재 알림: {workspace.alerts.length}개</p>
                <p>관리 프로필: {settings?.managedByProfileId ?? "확인 불가"}</p>
                <p>권한: {settings?.role ?? "MANAGER"}</p>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">최근 운영 이벤트</h2>
              <div className="mt-4 space-y-4">
                {recentChanges.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="border-l border-slate-200 pl-4 dark:border-slate-700">
                    <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.relative}</p>
                  </div>
                ))}
                {recentChanges.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">변경 로그가 아직 없습니다.</p>
                ) : null}
              </div>
            </Panel>
          </div>

          <Panel className="border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/35">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">운영 안내</p>
                <p className="mt-2 font-bold text-slate-900 dark:text-white">이 화면에는 데이터 삭제 기능이 없습니다.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  현재 화면은 선호값만 저장합니다. 실제 알림 발송, 보관 데이터 삭제, 임계치 기반 처리에는 아직 연결되지 않았습니다.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      ) : (
        <EmptyPanel
          title="설정 화면을 준비할 수 없습니다."
          description="세션 또는 공간 데이터를 먼저 확인해 주세요."
        />
      )}
    </ShellContent>
  );
}

/** backend workspace가 구성한 운영 로그를 심각도·검색 조건으로 탐색한다. */
export function LogsScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const deferredQuery = useDeferredValue(query);

  const logs = useMemo(() => {
    const list = state.workspace?.logs ?? [];
    return list.filter((log) => {
      const matchSeverity = severity === "all" || log.severity === severity;
      const keyword = deferredQuery.trim().toLowerCase();
      const matchKeyword =
        keyword.length === 0 ||
        log.eventType.toLowerCase().includes(keyword) ||
        log.targetLabel.toLowerCase().includes(keyword) ||
        log.details.toLowerCase().includes(keyword);
      return matchSeverity && matchKeyword;
    });
  }, [deferredQuery, severity, state.workspace?.logs]);

  return (
    <ShellContent
      activeKey="logs"
      title="이벤트 로그"
      subtitle="현재 불러온 공간·센서·게이트웨이 이벤트를 심각도와 검색어로 확인합니다."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "장비 ID, 이벤트 또는 상세 내용 검색")}
          <select
            aria-label="심각도 필터"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | "all")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">
              전체 심각도
            </option>
            <option value="critical">
              긴급
            </option>
            <option value="warning">
              주의
            </option>
            <option value="info">
              정보
            </option>
            <option value="success">
              정상
            </option>
          </select>
        </>
      }
    >
      {state.workspace ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {logs.map((log) => (
              <Panel key={log.id} className={cn("overflow-hidden", severityCardStyle(log.severity))}>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "rounded-xl p-2 text-white",
                      log.severity === "critical"
                        ? "bg-rose-500"
                        : log.severity === "warning"
                          ? "bg-amber-500"
                          : log.severity === "success"
                            ? "bg-emerald-500"
                            : "bg-blue-500",
                    )}
                  >
                    <Icon name="alert" className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {severityLabel(log.severity)}
                        </span>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                          {log.targetLabel}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{formatRelative(log.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                      {log.eventType}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{log.details}</p>
                  </div>
                </div>
              </Panel>
            ))}
            {logs.length === 0 ? (
              <EmptyPanel
                title="조건에 맞는 이벤트가 없습니다."
                description="검색어 또는 심각도 필터를 변경해 주세요."
              />
            ) : null}
          </div>

          <div className="space-y-6">
            <Panel>
              <h2 className="font-bold text-slate-900 dark:text-white">로그 통계</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">현재 필터 결과 {logs.length}건 기준</p>
              <div className="mt-6 space-y-4">
                {(["critical", "warning", "info", "success"] as const).map((level) => {
                  const count = logs.filter((log) => log.severity === level).length;
                  const color =
                    level === "critical"
                      ? "bg-rose-500"
                      : level === "warning"
                        ? "bg-amber-500"
                        : level === "success"
                          ? "bg-emerald-500"
                          : "bg-blue-500";
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">{severityLabel(level)}</span>
                        <span className={cn("font-bold", level === "critical" ? "text-rose-500" : level === "warning" ? "text-amber-500" : level === "success" ? "text-emerald-500" : "text-blue-500")}>{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className={color} style={{ width: `${(count / Math.max(logs.length, 1)) * 100}%`, height: "100%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-bold text-slate-900 dark:text-white">장비 보고 상태</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-2 rounded-full",
                      state.workspace.sensors.length === 0
                        ? "bg-slate-400"
                        : state.workspace.sensors.every(
                            (sensor) => sensor.detectionStatus === "Occupied" || sensor.detectionStatus === "Vacant",
                          )
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                    )}
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    {state.workspace.sensors.filter(
                      (sensor) => sensor.detectionStatus === "Occupied" || sensor.detectionStatus === "Vacant",
                    ).length}/{state.workspace.sensors.length} 센서가 점유 상태 보고 중
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-2 rounded-full",
                      state.workspace.gateways.length === 0
                        ? "bg-slate-400"
                        : state.workspace.gateways.every((gateway) => gateway.status === "Online")
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                    )}
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    {state.workspace.gateways.filter((gateway) => gateway.status === "Online").length}/{state.workspace.gateways.length} 게이트웨이 온라인
                  </span>
                </div>
              </div>
            </Panel>

            <Panel className="bg-blue-500/10 dark:bg-blue-500/10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                분석 범위
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                이 화면은 서버에서 불러온 이벤트와 장비 상태만 요약합니다. 자동 이상 탐지나 고장 예측 기능은 구현되어 있지 않습니다.
              </p>
            </Panel>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="로그 데이터를 표시할 수 없습니다."
          description="센서와 게이트웨이 이벤트가 축적되면 감사 로그가 자동으로 채워집니다."
        />
      )}
    </ShellContent>
  );
}
