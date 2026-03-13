"use client";

import Link from "next/link";
import {
  startTransition,
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
  type Severity,
  type SpaceRecord,
  updateAdminConsoleSettings,
} from "@/app/lib/admin-console";
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
} from "@/app/components/admin/ui";

const SENSOR_TYPES = ["OCCUPANCY_DETECTION"];
const SENSOR_PROTOCOLS = ["MQTT", "HTTP"];
const SENSOR_COMMAND_TYPES = [
  "REBOOT",
  "SET_THRESHOLD",
  "SET_SAMPLE_INTERVAL",
  "SYNC_TIME",
  "FIRMWARE_UPDATE",
];
const ZONE_OPERATIONAL_STATUSES = ["ACTIVE", "STAGING", "MAINTENANCE", "CRITICAL", "CLOSED"];
const GATEWAY_ROLES = ["EDGE", "HUB"];

type WorkspaceState = ReturnType<typeof useWorkspaceLoader>;

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
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
    return "방금 전";
  }

  const target = new Date(value).getTime();
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
    return "N/A";
  }

  const date = new Date(value);
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

function formatOptionalNumber(value?: number | null, suffix = "") {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return `${formatNumber(value)}${suffix}`;
}

function severityTone(severity: Severity): "info" | "warning" | "critical" | "success" | "neutral" {
  if (severity === "critical") {
    return "critical";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "success") {
    return "success";
  }
  if (severity === "info") {
    return "info";
  }
  return "neutral";
}

function spaceTone(space: SpaceRecord) {
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

function searchField(
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
) {
  return (
    <label className="flex min-w-[280px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
      <Icon name="search" className="size-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          startTransition(() => onChange(nextValue));
        }}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
    </label>
  );
}

function toolButton(
  label: string,
  onClick?: () => void,
  tone: "default" | "primary" = "default",
  disabled = false,
) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "primary"
          ? "border-sky-500/20 bg-[#2b8cee] text-white hover:bg-[#2476ca]"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
      )}
    >
      {label}
    </button>
  );
}

function parsePositionCode(positionCode?: string) {
  if (!positionCode) {
    return null;
  }

  const match = /PX(\d{1,3})_PY(\d{1,3})/i.exec(positionCode);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.min(Math.max(x, 8), 92),
    y: Math.min(Math.max(y, 10), 90),
  };
}

function autoPosition(index: number, total: number) {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(total, 1))));
  const row = Math.floor(index / columns);
  const col = index % columns;
  const rows = Math.max(1, Math.ceil(total / columns));

  return {
    x: 14 + (col / Math.max(columns - 1, 1)) * 72,
    y: 18 + (row / Math.max(rows - 1, 1)) * 56,
  };
}

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

    const headers = await resolveAuthHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }

    try {
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

function useSpaceHistoryState(state: WorkspaceState, space: SpaceRecord | null) {
  const { isReady, resolveAuthHeaders } = state;
  const [history, setHistory] = useState<Array<{ label: string; value: number }>>([]);
  const toHistoryPoints = useCallback((rows: Array<{ occupancyPercentage?: number | null }>) => {
    return rows.map((row, index) => ({
      label: `${String(index).padStart(2, "0")}:00`,
      value: row.occupancyPercentage ?? 0,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isReady || !space) {
      return;
    }

    void (async () => {
      const headers = await resolveAuthHeaders();
      if (!headers || cancelled) {
        return;
      }

      const rows = await loadSpaceHistory(headers, space);
      if (cancelled) {
        return;
      }

      setHistory(toHistoryPoints(rows));
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, resolveAuthHeaders, space, toHistoryPoints]);

  const reloadHistory = useCallback(async () => {
    if (!isReady || !space) {
      return;
    }

    const headers = await resolveAuthHeaders();
    if (!headers) {
      return;
    }

    const rows = await loadSpaceHistory(headers, space);
    setHistory(toHistoryPoints(rows));
  }, [isReady, resolveAuthHeaders, space, toHistoryPoints]);

  const visibleHistory = useMemo(() => (space ? history : []), [history, space]);

  return { history: visibleHistory, reloadHistory };
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-200">
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
      toolbar={toolbar}
      onLogout={() => void state.signOut()}
    >
      {children}
    </AdminShell>
  );
}

function occupancyStateLabel(space: SpaceRecord) {
  if (space.occupancyRate >= 90) {
    return "Critical";
  }
  if (space.offlineCount > 0 || space.lowBatteryCount > 0 || space.occupancyRate >= 75) {
    return "Maintenance";
  }
  if (space.occupancyRate >= 45) {
    return "Active";
  }
  return "Available";
}

function occupancyStateTone(space: SpaceRecord) {
  if (space.occupancyRate >= 90) {
    return "critical" as const;
  }
  if (space.offlineCount > 0 || space.lowBatteryCount > 0 || space.occupancyRate >= 75) {
    return "warning" as const;
  }
  if (space.occupancyRate >= 45) {
    return "success" as const;
  }
  return "info" as const;
}

function formatHourLabel(label?: string) {
  if (!label) {
    return "N/A";
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
  return "neutral" as const;
}

function gatewayLoadPercent(gateway: GatewayRecord) {
  const capacity = gateway.sensorCapacity ?? gateway.connectedSensors.length ?? 0;
  const load = gateway.currentSensorLoad ?? gateway.connectedSensors.length;
  if (!capacity || capacity <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((load / capacity) * 100)));
}

function gatewayDisplayStatus(gateway: GatewayRecord) {
  if (gateway.status === "Offline") {
    return "Offline" as const;
  }
  if (gatewayLoadPercent(gateway) >= 90 || (gateway.packetLossPercent ?? 0) >= 5) {
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
  return "critical" as const;
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
  return "border-sky-200 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10";
}

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
  const gateways = state.workspace?.gateways ?? [];
  const alerts = state.workspace?.alerts ?? [];
  const logs = state.workspace?.logs ?? [];
  const peakZones = visibleSpaces
    .slice()
    .sort((left, right) => right.occupancyRate - left.occupancyRate)
    .slice(0, 4);
  const topLoadedGateways = useMemo(() => {
    const ranked = gateways
      .slice()
      .sort((left, right) => right.connectedSensors.length - left.connectedSensors.length)
      .slice(0, 5);
    const max = Math.max(...ranked.map((gateway) => gateway.connectedSensors.length), 1);
    return ranked.map((gateway) => ({
      gatewayId: gateway.gatewayId,
      connectedSensors: gateway.connectedSensors.length,
      height: Math.max(18, Math.round((gateway.connectedSensors.length / max) * 100)),
    }));
  }, [gateways]);
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").slice(0, 3);
  const warningAlerts = alerts.filter((alert) => alert.severity === "warning").length;

  return (
    <ShellContent
      activeKey="dashboard"
      title="Facility Overview"
      subtitle="Real-time aggregated occupancy and operational system health."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "Search facilities, sensors or logs...")}
          {toolButton("Export Report")}
        </>
      }
    >
      {state.workspace && state.workspace.spaces.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard
              label="Global Occupancy"
              value={formatPercent(state.workspace.summary.occupancyRate)}
              hint={`Currently ${formatNumber(state.workspace.summary.occupiedNow)} people in-facility`}
            />
            <MetricCard
              label="Active Gateways"
              value={`${formatNumber(gateways.filter((gateway) => gateway.status === "Online").length)}/${formatNumber(gateways.length)}`}
              hint={`${formatNumber(gateways.filter((gateway) => gateway.status !== "Online").length)} nodes currently unreachable`}
              tone="orange"
            />
            <MetricCard
              label="Pending Alerts"
              value={formatNumber(alerts.length)}
              hint={`${criticalAlerts.length} critical, ${warningAlerts} maintenance`}
              tone="rose"
            />
            <MetricCard
              label="Gateway Availability"
              value={formatPercent(state.workspace.summary.gatewayHealth)}
              hint="Registered gateways currently online"
              tone="emerald"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Occupancy Trend
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Total facility load over the last 24 hours
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Last 24 Hours
                </div>
              </div>
              <div className="mt-6">
                <MiniBars points={topSpace?.trend ?? []} />
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Peak Zones</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Areas under the highest live occupancy pressure
              </p>
              <div className="mt-6 space-y-5">
                {peakZones.map((space) => (
                  <Link key={space.spaceId} href={`/areas/${space.spaceId}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {space.name}
                      </span>
                      <span className="font-bold text-sky-600 dark:text-sky-300">
                        {Math.round(space.occupancyRate)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          space.occupancyRate >= 90
                            ? "bg-rose-500"
                            : space.occupancyRate >= 75
                              ? "bg-sky-500"
                              : "bg-slate-400",
                        )}
                        style={{ width: `${Math.max(space.occupancyRate, 8)}%` }}
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
                  View All Zones
                </Link>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Gateway Sensor Load
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Registered Only
                </span>
              </div>
              <div className="mt-6 grid h-[180px] grid-cols-5 items-end gap-4">
                {topLoadedGateways.map((gateway) => (
                  <div key={gateway.gatewayId} className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "w-full rounded-t-lg",
                        gateway.height >= 90
                          ? "border-t-2 border-rose-500 bg-rose-500/20 dark:bg-rose-500/12"
                          : "bg-sky-500/20 dark:bg-sky-500/12",
                      )}
                      style={{ height: `${gateway.height}%` }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {gateway.gatewayId}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                <Icon name="alert" className="size-4 shrink-0" />
                <p>
                  {topLoadedGateways
                    .slice()
                    .sort((left, right) => right.height - left.height)[0]?.gatewayId ?? "No gateway"}{" "}
                  gateway currently manages the most mapped sensors.
                </p>
              </div>
            </Panel>

            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  High Priority Alerts
                </h2>
                <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  {criticalAlerts.length} critical
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(criticalAlerts.length > 0 ? criticalAlerts : alerts.slice(0, 3)).map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-4 px-6 py-4",
                      alert.severity === "critical"
                        ? "bg-rose-50/70 dark:bg-rose-500/6"
                        : "",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl p-2",
                        alert.severity === "critical"
                          ? "bg-rose-500/15 text-rose-500"
                          : "bg-amber-500/15 text-amber-500",
                      )}
                    >
                      <Icon name="alert" className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {alert.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatRelative(alert.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 px-6 py-4 text-center dark:bg-slate-800/35">
                <Link
                  href="/logs"
                  className="text-sm font-bold text-sky-600 hover:underline dark:text-sky-300"
                >
                  See All Incident Reports
                </Link>
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Operational Snapshot
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Recent console activity across spaces and devices
                </p>
              </div>
              <StatusBadge tone="info">{logs.length} events</StatusBadge>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {logs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/35"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {log.severity}
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

  const activeCount = spaces.filter((space) => space.occupancyRate >= 45 && space.occupancyRate < 75).length;
  const maintenanceCount = spaces.filter((space) => space.occupancyRate >= 75 && space.occupancyRate < 90).length;
  const criticalCount = spaces.filter((space) => space.occupancyRate >= 90).length;

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

    const headers = await state.resolveAuthHeaders();
    if (!headers) {
      setCreateError("인증 세션을 확인할 수 없습니다.");
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
      title="Area Management"
      subtitle="Manage and monitor real-time occupancy and hardware health across your zones."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "Search areas...")}
          {toolButton("Filter")}
          {toolButton("New Zone", openCreateModal, "primary")}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800">
              <button className="border-b-2 border-sky-500 px-4 py-2 text-sm font-semibold text-sky-600 dark:text-sky-300">
                All Zones ({spaces.length})
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500">
                Active ({activeCount})
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500">
                Maintenance ({maintenanceCount})
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500">
                Critical ({criticalCount})
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {spaces.map((space) => {
              const gatewayCount =
                state.workspace?.gateways.filter((gateway) => gateway.spaceId === space.spaceId)
                  .length ?? 0;

              return (
                <Link key={space.spaceId} href={`/areas/${space.spaceId}`} className="block">
                  <Panel
                    className={cn(
                      "h-full transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_22px_48px_rgba(2,8,23,0.4)]",
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
                        <span className="text-slate-500 dark:text-slate-400">Occupancy</span>
                        <span
                          className={cn(
                            "font-bold",
                            space.occupancyRate >= 90
                              ? "text-rose-500"
                              : "text-slate-700 dark:text-slate-200",
                          )}
                        >
                          {space.occupancyRate >= 100
                            ? "Overloaded"
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
                                : "bg-sky-500",
                          )}
                          style={{ width: `${Math.max(Math.min(space.occupancyRate, 100), 5)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Gateway
                        </p>
                        <p className="mt-1 text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                          {gatewayCount > 0
                            ? state.workspace?.gateways.find((gateway) => gateway.spaceId === space.spaceId)
                                ?.gatewayId ?? "N/A"
                            : "미등록"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Sensors
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          {space.sensors.length} Active
                        </p>
                      </div>
                    </div>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="공간 데이터를 불러오지 못했습니다."
          description="백엔드 연결 상태와 로그인 세션을 확인해 주세요."
        />
      )}
      <ModalFrame
        open={isCreateModalOpen}
        title="Create New Zone"
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
                type="button"
                onClick={() => void submitCreateZone()}
                disabled={createSubmitting}
                className="rounded-xl border border-sky-500/20 bg-[#2b8cee] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2476ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSubmitting ? "Creating..." : "Create Zone"}
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Zone Name</span>
              <input
                value={zoneForm.name}
                onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Meeting Room Sigma"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Description</span>
              <textarea
                value={zoneForm.description}
                onChange={(event) => setZoneForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                placeholder="실시간 점유율과 장비 상태를 모니터링할 공간 설명"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Operational Status</span>
                <select
                  value={zoneForm.operationalStatus}
                  onChange={(event) => setZoneForm((current) => ({ ...current, operationalStatus: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  {ZONE_OPERATIONAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Address</span>
              <input
                value={zoneForm.address}
                onChange={(event) => setZoneForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="서울 강남구 테헤란로 101"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="grid gap-4">
            <Panel className="rounded-[22px] border border-sky-100 bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] shadow-none dark:border-sky-500/10 dark:bg-[linear-gradient(180deg,#101a28_0%,#0d1724_100%)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-500 dark:text-sky-300">
                Deployment Meta
              </p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Latitude</span>
                  <input
                    value={zoneForm.latitude}
                    onChange={(event) => setZoneForm((current) => ({ ...current, latitude: event.target.value }))}
                    inputMode="decimal"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Longitude</span>
                  <input
                    value={zoneForm.longitude}
                    onChange={(event) => setZoneForm((current) => ({ ...current, longitude: event.target.value }))}
                    inputMode="decimal"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Phone</span>
                  <input
                    value={zoneForm.phoneNumber}
                    onChange={(event) => setZoneForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                    placeholder="02-7000-1000"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Operating Hours</span>
                  <input
                    value={zoneForm.operatingHours}
                    onChange={(event) => setZoneForm((current) => ({ ...current, operatingHours: event.target.value }))}
                    placeholder="08:00-22:00"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Image URL</span>
                  <input
                    value={zoneForm.imageUrl}
                    onChange={(event) => setZoneForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    placeholder="/images/spaces/new-zone.jpg"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              </div>
            </Panel>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <p className="font-semibold text-slate-900 dark:text-white">생성 규칙</p>
              <ul className="mt-3 space-y-2">
                <li>새 zone은 현재 로그인한 관리자 소유로 생성됩니다.</li>
                <li>생성 직후 관리자 화면에는 보이지만, 공개 노출은 검증 전까지 제외됩니다.</li>
                <li>게이트웨이와 센서는 이후 해당 zone 안에서 별도로 연결합니다.</li>
              </ul>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {createError}
              </div>
            ) : null}
          </div>
        </div>
      </ModalFrame>
    </ShellContent>
  );
}

export function AreaDetailScreen({ spaceId }: { spaceId: number }) {
  const state = useWorkspaceLoader();
  const space = useMemo(
    () => state.workspace?.spaces.find((item) => item.spaceId === spaceId) ?? state.workspace?.spaces[0] ?? null,
    [spaceId, state.workspace?.spaces],
  );
  const gatewayCount = useMemo(
    () => state.workspace?.gateways.filter((gateway) => gateway.spaceId === space?.spaceId).length ?? 0,
    [space?.spaceId, state.workspace?.gateways],
  );
  const { history, reloadHistory } = useSpaceHistoryState(state, space);

  return (
    <ShellContent
      activeKey="areas"
      title={space ? `${space.name} Area Detail` : "Area Detail"}
      subtitle="공간별 점유율, 센서 위치, 최근 텔레메트리를 한 번에 검토합니다."
      state={state}
      toolbar={
        <>
          <Link
            href="/areas"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
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
              label="Current Occupancy"
              value={formatNumber(space.occupiedCount)}
              hint={`${formatPercent(space.occupancyRate)} · ${space.crowdLevel}`}
            />
            <MetricCard
              label="Active Sensors"
              value={formatNumber(space.activeSensorCount)}
              hint={`${formatNumber(space.offlineCount)} offline / maintenance`}
              tone="emerald"
            />
            <MetricCard
              label="Average Battery"
              value={space.avgBattery > 0 ? `${space.avgBattery.toFixed(0)}%` : "N/A"}
              hint={`${formatNumber(space.lowBatteryCount)} low battery nodes`}
              tone="orange"
            />
            <MetricCard
              label="Average Rating"
              value={space.averageRating > 0 ? space.averageRating.toFixed(1) : "0.0"}
              hint={`${formatNumber(space.reviewCount)} review signals`}
              tone="rose"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-200/80">
                    Zone Coverage
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Real-time Zone Plan
                  </h2>
                </div>
                <StatusBadge tone={spaceTone(space)}>{space.operationalStatus ?? occupancyStateLabel(space)}</StatusBadge>
              </div>
              <div className="relative mt-5 aspect-[16/10] overflow-hidden rounded-[28px] border border-white/8 bg-slate-900">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_30%),linear-gradient(145deg,rgba(2,6,23,0.95),rgba(15,23,42,0.98))]" />
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)",
                    backgroundSize: "58px 58px",
                  }}
                />
                <div className="pointer-events-none absolute left-5 top-5 flex max-w-[85%] flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100">
                    {textOrFallback(space.addressLabel, "주소 미등록")}
                  </span>
                  <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] text-indigo-100">
                    {space.operationalStatus ?? "ACTIVE"}
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
                    Sensors {space.sensors.length}
                  </span>
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100">
                    Gateways {gatewayCount}
                  </span>
                </div>

                {space.sensors.map((sensor, index) => {
                  const position = parsePositionCode(sensor.positionCode) ?? autoPosition(index, space.sensors.length);
                  return (
                    <Link
                      key={sensor.sensorId}
                      href={`/sensors/${sensor.sensorId}`}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-left shadow-lg transition hover:scale-[1.03]",
                        sensor.status === "ACTIVE"
                          ? "border-cyan-300/25 bg-white/92 text-slate-900"
                          : "border-orange-300/20 bg-orange-100/90 text-slate-900",
                      )}
                      style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    >
                      <p className="text-xs font-semibold">{sensor.sensorId}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{sensor.batteryLabel}</p>
                    </Link>
                  );
                })}
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-semibold text-white">Sensor Cluster</h2>
                <div className="mt-4 space-y-3">
                  {space.sensors.map((sensor) => (
                    <Link
                      key={sensor.sensorId}
                      href={`/sensors/${sensor.sensorId}`}
                      className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.06]"
                    >
                      <div>
                        <p className="font-medium text-white">{sensor.sensorId}</p>
                        <p className="mt-1 text-xs text-slate-400">{sensor.locationLabel}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge tone={sensor.status === "ACTIVE" ? "success" : "warning"}>
                          {sensor.status}
                        </StatusBadge>
                        <p className="mt-2 text-xs text-slate-500">{sensor.batteryLabel}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel>
                <h2 className="text-lg font-semibold text-white">Recent Telemetry</h2>
                <div className="mt-4 space-y-3">
                  {space.recentTelemetry.slice(0, 5).map((telemetry) => (
                    <div
                      key={telemetry.telemetryId}
                      className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4"
                    >
                      <p className="font-medium text-white">
                        {telemetry.sensorId} · {telemetry.occupied ? "Occupied" : "Vacant"}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {telemetry.distanceCm != null
                          ? `distance ${telemetry.distanceCm.toFixed(1)}cm`
                          : `pad ${telemetry.padLeftValue ?? "-"} / ${telemetry.padRightValue ?? "-"}`}
                        {" · "}quality {telemetry.qualityStatus ?? "N/A"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(telemetry.measuredAt)}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel>
            <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Occupancy History</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    최근 12개 시점 기준 혼잡도 변화를 표시합니다.
                  </p>
                </div>
              <StatusBadge tone={spaceTone(space)}>{formatPercent(space.occupancyRate)}</StatusBadge>
            </div>
            <div className="mt-5">
              <MiniBars points={history} />
            </div>
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

export function SensorsScreen() {
  const state = useWorkspaceLoader();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isInstallModalOpen, setInstallModalOpen] = useState(false);
  const [isCommandModalOpen, setCommandModalOpen] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    sensorId: "",
    macAddress: "",
    model: "ZQ-SENSOR-V2",
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

  const resetRegisterForm = useCallback(() => {
    setRegisterForm({
      sensorId: "",
      macAddress: "",
      model: "ZQ-SENSOR-V2",
      type: SENSOR_TYPES[0],
      protocol: SENSOR_PROTOCOLS[0],
      placeId: state.workspace?.spaces[0]?.spaceId ?? 0,
      gatewayId: "",
    });
  }, [state.workspace?.spaces]);

  const openRegisterModal = useCallback(() => {
    resetRegisterForm();
    setRegisterModalOpen(true);
  }, [resetRegisterForm]);

  const closeRegisterModal = useCallback(() => {
    setRegisterModalOpen(false);
  }, []);

  const openInstallModal = useCallback((sensor?: SensorRecord | null) => {
    setInstallForm({
      sensorId: sensor?.sensorId ?? "",
      placeId: sensor?.placeId ?? state.workspace?.spaces[0]?.spaceId ?? 0,
      gatewayId: sensor?.gatewayId ?? "",
    });
    setInstallModalOpen(true);
  }, [state.workspace?.spaces]);

  const closeInstallModal = useCallback(() => {
    setInstallModalOpen(false);
  }, []);

  const openCommandModal = useCallback((sensor?: SensorRecord | null) => {
    setCommandForm({
      sensorId: sensor?.sensorId ?? "",
      commandType: SENSOR_COMMAND_TYPES[0],
      commandPayload: "",
    });
    setCommandModalOpen(true);
  }, []);

  const closeCommandModal = useCallback(() => {
    setCommandModalOpen(false);
  }, []);

  const executeAction = useCallback(
    async (runner: (headers: Record<string, string>) => Promise<{ ok: boolean; message?: string }>, successMessage: string) => {
      setNotice(null);
      setActionError(null);

      const headers = await state.resolveAuthHeaders();
      if (!headers) {
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
    },
    [state],
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
  const inventorySubtitle = `${formatNumber(activeSensors)} sensors active across ${formatNumber(state.workspace?.gateways.length ?? 0)} registered gateways.`;

  return (
    <ShellContent
      activeKey="sensors"
      title="Sensor Inventory"
      subtitle={inventorySubtitle}
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "Search by gateway, space, or sensor ID...")}
          {toolButton("Export CSV")}
          {toolButton("Add Sensor", openRegisterModal, "primary")}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <NoticeStrip notice={notice} error={actionError ?? state.error} />

          <Panel className="rounded-[24px] bg-slate-50/80 dark:bg-slate-900/45">
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Status: All
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Type: All
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Filter
              </button>
            </div>
          </Panel>

          <div className="space-y-8">
            {gatewaySections.map(({ gateway, sensors: gatewaySensors }) => (
              <section key={gateway.gatewayId} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <Icon name="gateways" className="size-5 text-sky-500 dark:text-sky-300" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Gateway: <span className="text-sky-600 dark:text-sky-300">{gateway.gatewayId}</span>
                  </h3>
                  <StatusBadge tone={gatewayTone(gateway.status)}>{gateway.status}</StatusBadge>
                  <span className="ml-auto text-sm text-slate-400">
                    {gatewaySensors.length} Sensors Connected
                  </span>
                </div>

                <Panel className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                          <th className="px-6 py-4">Sensor ID</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Battery</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
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
                                      (sensor.batteryPercent ?? 0) <= 15
                                        ? "bg-rose-500"
                                        : (sensor.batteryPercent ?? 0) <= 40
                                          ? "bg-amber-500"
                                          : "bg-emerald-500",
                                    )}
                                    style={{ width: `${Math.max(sensor.batteryPercent ?? 0, 5)}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    (sensor.batteryPercent ?? 0) <= 15
                                      ? "text-rose-500"
                                      : (sensor.batteryPercent ?? 0) <= 40
                                        ? "text-amber-500"
                                        : "text-emerald-500",
                                  )}
                                >
                                  {sensor.batteryPercent !== null
                                    ? `${sensor.batteryPercent.toFixed(0)}%`
                                    : "N/A"}
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
                                {sensor.status === "ACTIVE" ? "Operational" : sensor.status}
                              </StatusBadge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Link
                                  href={`/sensors/${sensor.sensorId}`}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  Detail
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => openInstallModal(sensor)}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  Install
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCommandModal(sensor)}
                                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
                                >
                                  Command
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSensor(sensor)}
                                  className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
                                >
                                  Delete
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unassigned Sensors</h3>
                  <StatusBadge tone="warning">Needs Mapping</StatusBadge>
                  <span className="ml-auto text-sm text-slate-400">
                    {unassignedSensors.length} sensors
                  </span>
                </div>
                <Panel className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                          <th className="px-6 py-4">Sensor ID</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Space</th>
                          <th className="px-6 py-4">Battery</th>
                          <th className="px-6 py-4 text-right">Actions</th>
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
                                  className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-600"
                                >
                                  Install
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSensor(sensor)}
                                  className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
                                >
                                  Delete
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-900 dark:text-white">1-{sensors.length}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{sensors.length}</span> sensors
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
              >
                Prev
              </button>
              <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white">
                1
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="센서 데이터를 불러오지 못했습니다."
          description="센서 브리지 API 연결 상태를 먼저 확인해 주세요."
        />
      )}

      <ModalFrame
        open={isRegisterModalOpen}
        title="Add Sensor"
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
          <input
            value={registerForm.sensorId}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, sensorId: event.target.value }))
            }
            placeholder="sensorId"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            required
          />
          <input
            value={registerForm.macAddress}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, macAddress: event.target.value }))
            }
            placeholder="MAC address"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            required
          />
          <input
            value={registerForm.model}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, model: event.target.value }))
            }
            placeholder="model"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            required
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <select
              value={registerForm.type}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, type: event.target.value }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              {SENSOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={registerForm.protocol}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, protocol: event.target.value }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              {SENSOR_PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
            </select>
            <select
              value={selectedRegisterPlaceId}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  placeId: Number(event.target.value),
                  gatewayId: "",
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              {(state.workspace?.spaces ?? []).map((space) => (
                <option key={space.spaceId} value={space.spaceId}>
                  {space.name}
                </option>
              ))}
            </select>
            <select
              value={registerForm.gatewayId}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  gatewayId: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">게이트웨이 미지정</option>
              {registerGatewayOptions.map((gateway) => (
                <option key={gateway.gatewayId} value={gateway.gatewayId}>
                  {gateway.gatewayId}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeRegisterModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600">
              Add Sensor
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        open={isInstallModalOpen}
        title="Install / Reassign Sensor"
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            required
          >
            <option value="">센서 선택</option>
            {state.workspace?.sensors.map((sensor) => (
              <option key={sensor.sensorId} value={sensor.sensorId}>
                {sensor.sensorId}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedInstallPlaceId}
              onChange={(event) =>
                setInstallForm((current) => ({
                  ...current,
                  placeId: Number(event.target.value),
                  gatewayId: "",
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              {(state.workspace?.spaces ?? []).map((space) => (
                <option key={space.spaceId} value={space.spaceId}>
                  {space.name}
                </option>
              ))}
            </select>
            <select
              value={installForm.gatewayId}
              onChange={(event) =>
                setInstallForm((current) => ({
                  ...current,
                  gatewayId: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">게이트웨이 미지정</option>
              {installGatewayOptions.map((gateway) => (
                <option key={gateway.gatewayId} value={gateway.gatewayId}>
                  {gateway.gatewayId}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeInstallModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600">
              Apply Install Mapping
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        open={isCommandModalOpen}
        title="Send Command"
        description="선택한 센서에 운영 명령을 전송합니다."
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

            void (async () => {
              const ok = await executeAction(
                (headers) =>
                  createSensorCommand(headers, {
                    sensorId: commandForm.sensorId,
                    commandType: commandForm.commandType,
                    commandPayload: commandForm.commandPayload || null,
                  }),
                `${commandForm.sensorId}에 ${commandForm.commandType} 명령을 전송했습니다.`,
              );

              if (ok) {
                closeCommandModal();
              }
            })();
          }}
        >
          <select
            value={commandForm.sensorId}
            onChange={(event) =>
              setCommandForm((current) => ({ ...current, sensorId: event.target.value }))
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            required
          >
            <option value="">센서 선택</option>
            {state.workspace?.sensors.map((sensor) => (
              <option key={sensor.sensorId} value={sensor.sensorId}>
                {sensor.sensorId}
              </option>
            ))}
          </select>
          <select
            value={commandForm.commandType}
            onChange={(event) =>
              setCommandForm((current) => ({ ...current, commandType: event.target.value }))
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
          >
            {SENSOR_COMMAND_TYPES.map((command) => (
              <option key={command} value={command}>
                {command}
              </option>
            ))}
          </select>
          <textarea
            value={commandForm.commandPayload}
            onChange={(event) =>
              setCommandForm((current) => ({
                ...current,
                commandPayload: event.target.value,
              }))
            }
            placeholder='{"threshold": 80}'
            rows={4}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCommandModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600">
              Send Command
            </button>
          </div>
        </form>
      </ModalFrame>
    </ShellContent>
  );
}

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
    if (telemetry.length > 0) {
      return telemetry.slice(0, 8).map((item) => ({
        label: formatShortTime(item.measuredAt ?? item.receivedAt),
        value: item.occupied ? 100 : 0,
      }));
    }

    return space.trend.slice(0, 8);
  }, [sensor?.sensorId, space]);

  const logs = useMemo(
    () => state.workspace?.logs.filter((item) => item.sensorId === sensor?.sensorId).slice(0, 8) ?? [],
    [sensor?.sensorId, state.workspace?.logs],
  );

  return (
    <ShellContent
      activeKey="sensors"
      title={sensor ? `${sensor.sensorId} Sensor Detail` : "Sensor Detail"}
      subtitle="센서별 감지 이력, 배터리, 상태 로그를 상세하게 확인합니다."
      state={state}
      toolbar={
        <Link
          href="/sensors"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          센서 목록으로
        </Link>
      }
    >
      {sensor && space ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Detection Status"
              value={sensor.detectionStatus}
              hint={`${space.name} · ${textOrFallback(sensor.locationLabel, "위치 미지정")}`}
            />
            <MetricCard
              label="Gateway Mapping"
              value={textOrFallback(sensor.gatewayId, "Unassigned")}
              hint={textOrFallback(sensor.positionCode ?? sensor.locationLabel, "Position not set")}
              tone="emerald"
            />
            <MetricCard
              label="Battery Level"
              value={sensor.batteryPercent !== null ? `${sensor.batteryPercent.toFixed(0)}%` : "N/A"}
              hint={sensor.batteryLabel}
              tone="orange"
            />
            <MetricCard
              label="Last Heartbeat"
              value={formatRelative(sensor.lastHeartbeatAt)}
              hint={formatDateTime(sensor.lastHeartbeatAt)}
              tone="rose"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Occupancy Historical Data</h2>
                  <p className="mt-1 text-sm text-slate-400">최근 감지 패턴을 시계열로 표시합니다.</p>
                </div>
                <StatusBadge tone={sensor.status === "ACTIVE" ? "success" : "warning"}>
                  {sensor.status}
                </StatusBadge>
              </div>
              <div className="mt-5">
                <MiniBars points={history} />
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-semibold text-white">Sensor Profile</h2>
                <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-500">Space</dt>
                  <dd className="text-white">{space.name}</dd>
                  <dt className="text-slate-500">Gateway</dt>
                  <dd className="text-white">{textOrFallback(sensor.gatewayId, "미등록")}</dd>
                  <dt className="text-slate-500">Protocol</dt>
                  <dd className="text-white">{sensor.protocol}</dd>
                  <dt className="text-slate-500">Firmware</dt>
                  <dd className="text-white">{textOrFallback(sensor.firmwareVersion, "미등록")}</dd>
                  <dt className="text-slate-500">MAC Address</dt>
                  <dd className="text-white">{sensor.macAddress ?? "N/A"}</dd>
                </dl>
              </Panel>

              <Panel>
                <h2 className="text-lg font-semibold text-white">Event Logs</h2>
                <div className="mt-4 space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <p className="font-medium text-white">{log.eventType}</p>
                      <p className="mt-1 text-sm text-slate-300">{log.details}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                    </div>
                  ))}
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
        gateway.spaceName.toLowerCase().includes(keyword) ||
        (gateway.linkedBridge?.toLowerCase() ?? "").includes(keyword),
    );
  }, [deferredQuery, state.workspace?.gateways]);
  const activeGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Active").length;
  const warningGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Warning").length;
  const offlineGatewayCount = gateways.filter((gateway) => gatewayDisplayStatus(gateway) === "Offline").length;
  const topSensorGateways = gateways
    .slice()
    .sort((left, right) => gatewayLoadPercent(right) - gatewayLoadPercent(left))
    .slice(0, 7);
  const maxConnectedSensors = Math.max(
    ...topSensorGateways.map((gateway) => gatewayLoadPercent(gateway)),
    1,
  );
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

    const headers = await state.resolveAuthHeaders();
    if (!headers) {
      setCreateError("인증 세션을 확인할 수 없습니다.");
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
      await createGateway(headers, payload);
      await state.reload();
      setCreateModalOpen(false);
      resetGatewayForm();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "게이트웨이 생성에 실패했습니다.");
    } finally {
      setCreateSubmitting(false);
    }
  }, [createGateway, gatewayForm, resetGatewayForm, state]);

  return (
    <ShellContent
      activeKey="gateways"
      title="Gateway List"
      subtitle="Inspect infrastructure hubs, sensor load, and recent gateway incidents."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "Search gateways, IPs, or locations...")}
          {toolButton("New Gateway", openCreateModal, "primary", (state.workspace?.spaces.length ?? 0) === 0)}
        </>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard
              label="Total Gateways"
              value={formatNumber(gateways.length)}
              hint="Registered infrastructure nodes"
            />
            <MetricCard
              label="Active Status"
              value={formatNumber(activeGatewayCount)}
              hint="Currently responding normally"
              tone="emerald"
            />
            <MetricCard
              label="High Load Hubs"
              value={formatNumber(warningGatewayCount)}
              hint="Near capacity or degraded packet quality"
              tone="orange"
            />
            <MetricCard
              label="Critical Offline"
              value={formatNumber(offlineGatewayCount)}
              hint="Requires network intervention"
              tone="rose"
            />
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Infrastructure Gateways
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Real-time
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-800">
                  <button className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-sky-600 dark:bg-slate-800 dark:text-sky-300">
                    All
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-slate-500">Hubs</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-slate-500">Edges</button>
                </div>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  Filter
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50/70 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-6 py-4">Gateway Name</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Sensor Load</th>
                    <th className="px-6 py-4">Latency</th>
                    <th className="px-6 py-4 text-right">Status</th>
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
                          <div className="grid size-8 place-items-center rounded-lg bg-sky-500/10 text-sky-500 dark:bg-sky-400/10 dark:text-sky-300">
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
                              {formatNumber(gateway.sensorCapacity ?? gateway.connectedSensors.length)}
                            </span>
                            <span className={cn(gatewayLoadPercent(gateway) >= 90 ? "text-amber-500" : "text-sky-500")}>
                              {gatewayLoadPercent(gateway)}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                gatewayLoadPercent(gateway) >= 90 ? "bg-amber-500" : "bg-sky-500",
                              )}
                              style={{ width: `${Math.max(gatewayLoadPercent(gateway), 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              gateway.status === "Offline" ? "text-slate-500" : "text-slate-800 dark:text-slate-200",
                            )}
                          >
                            {gateway.status === "Offline"
                              ? "Timed Out"
                              : gateway.latencyMs != null
                                ? `${gateway.latencyMs}ms`
                                : "N/A"}
                          </span>
                          <div className={cn("flex gap-0.5", gateway.status === "Offline" && "opacity-30")}>
                            <div
                              className={cn(
                                "h-3 w-1 rounded-full",
                                gateway.status === "Offline"
                                  ? "bg-slate-400"
                                  : gateway.latencyMs != null && gateway.latencyMs >= 40
                                    ? "bg-amber-500"
                                    : "bg-sky-500",
                              )}
                            />
                            <div
                              className={cn(
                                "h-3 w-1 rounded-full",
                                gateway.status === "Offline"
                                  ? "bg-slate-400"
                                  : gateway.latencyMs != null && gateway.latencyMs >= 40
                                    ? "bg-amber-500"
                                    : "bg-sky-500/30",
                              )}
                            />
                            <div
                              className={cn(
                                "h-3 w-1 rounded-full",
                                gateway.status === "Offline"
                                  ? "bg-slate-400"
                                  : gateway.latencyMs != null && gateway.latencyMs >= 40
                                    ? "bg-amber-500/30"
                                    : "bg-sky-500/30",
                              )}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge tone={gatewayDisplayTone(gateway)}>
                          {gatewayDisplayStatus(gateway)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <p>Showing 1 to {gateways.length} of {gateways.length} gateways</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 disabled:opacity-50 dark:border-slate-800"
                >
                  <Icon name="arrow" className="size-3 rotate-180" />
                </button>
                <button className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-bold text-white">
                  1
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 disabled:opacity-50 dark:border-slate-800"
                >
                  <Icon name="arrow" className="size-3" />
                </button>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Network Load Distribution</h2>
              <div className="mt-6 flex h-48 items-end justify-between gap-2 px-4">
                {topSensorGateways.map((gateway) => (
                  <div key={gateway.gatewayId} className="relative flex flex-1 flex-col justify-end">
                    <div className="group relative h-full rounded-t-sm bg-sky-500/20">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-sm bg-sky-500"
                        style={{
                          height: `${Math.max(
                            18,
                            Math.round((gatewayLoadPercent(gateway) / maxConnectedSensors) * 100),
                          )}%`,
                        }}
                      />
                      <div className="absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                        {gatewayLoadPercent(gateway)}%
                      </div>
                    </div>
                    <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {(gateway.regionCode || gateway.gatewayId).slice(0, 8)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Incidents</h2>
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
        title="Register New Gateway"
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
                type="button"
                onClick={() => void submitCreateGateway()}
                disabled={createSubmitting}
                className="rounded-xl border border-sky-500/20 bg-[#2b8cee] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2476ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSubmitting ? "Creating..." : "Create Gateway"}
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gateway ID</span>
              <input
                value={gatewayForm.gatewayId}
                onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayId: event.target.value }))}
                placeholder="GW-STORE-001"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gateway Name</span>
              <input
                value={gatewayForm.gatewayName}
                onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayName: event.target.value }))}
                placeholder="Store Edge Gateway 01"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Space</span>
                <select
                  value={gatewayForm.spaceId}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, spaceId: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
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
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gateway Role</span>
                <select
                  value={gatewayForm.gatewayRole}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayRole: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
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
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">IP Address</span>
                <input
                  value={gatewayForm.ipAddress}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, ipAddress: event.target.value }))}
                  placeholder="192.168.0.24"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sensor Capacity</span>
                <input
                  value={gatewayForm.sensorCapacity}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, sensorCapacity: event.target.value }))}
                  inputMode="numeric"
                  placeholder="64"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4">
            <Panel className="rounded-[22px] border border-sky-100 bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] shadow-none dark:border-sky-500/10 dark:bg-[linear-gradient(180deg,#101a28_0%,#0d1724_100%)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-500 dark:text-sky-300">
                Runtime Meta
              </p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Region Code</span>
                  <input
                    value={gatewayForm.regionCode}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, regionCode: event.target.value }))}
                    placeholder="NORTH"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Location Label</span>
                  <input
                    value={gatewayForm.locationLabel}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, locationLabel: event.target.value }))}
                    placeholder="North aisle rack"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Firmware Version</span>
                  <input
                    value={gatewayForm.firmwareVersion}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, firmwareVersion: event.target.value }))}
                    placeholder="v1.0.0"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Linked Bridge</span>
                  <input
                    value={gatewayForm.linkedBridge}
                    onChange={(event) => setGatewayForm((current) => ({ ...current, linkedBridge: event.target.value }))}
                    placeholder="ble://store-001"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              </div>
            </Panel>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Description</span>
              <textarea
                value={gatewayForm.description}
                onChange={(event) => setGatewayForm((current) => ({ ...current, description: event.target.value }))}
                rows={6}
                placeholder="의자 센서 BLE 스캔과 cloud sync를 담당하는 게이트웨이 설명"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
              />
            </label>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
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
        </div>
      </ModalFrame>
    </ShellContent>
  );
}

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
      title={gateway ? `${gateway.gatewayId} Gateway Detail` : "Gateway Detail"}
      subtitle="게이트웨이와 연결된 센서 묶음을 세부 점검합니다."
      state={state}
      toolbar={
        <Link
          href="/gateways"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          게이트웨이 목록으로
        </Link>
      }
    >
      {gateway ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Connected Sensors"
              value={formatNumber(gateway.connectedSensors.length)}
              hint={gateway.spaceName}
            />
            <MetricCard
              label="Linked Bridge"
              value={textOrFallback(gateway.linkedBridge)}
              hint="Gateway registry mapping"
              tone="orange"
            />
            <MetricCard
              label="Firmware"
              value={textOrFallback(gateway.firmwareVersion)}
              hint="Registered firmware version"
              tone="emerald"
            />
            <MetricCard
              label="Gateway Status"
              value={gateway.status}
              hint={formatDateTime(gateway.lastHeartbeatAt)}
              tone={gateway.status === "Online" ? "emerald" : "rose"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel>
              <h2 className="text-lg font-semibold text-white">Assigned Sensors</h2>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="pb-4 pr-4">Sensor ID</th>
                      <th className="pb-4 pr-4">Type</th>
                      <th className="pb-4 pr-4">Status</th>
                      <th className="pb-4 pr-4">Battery</th>
                      <th className="pb-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {gateway.connectedSensors.map((sensor) => (
                      <tr key={sensor.sensorId}>
                        <td className="py-4 pr-4 font-medium text-white">{sensor.sensorId}</td>
                        <td className="py-4 pr-4 text-slate-300">{sensor.type}</td>
                        <td className="py-4 pr-4">
                          <StatusBadge tone={sensor.status === "ACTIVE" ? "success" : "warning"}>
                            {sensor.status}
                          </StatusBadge>
                        </td>
                        <td className="py-4 pr-4 text-slate-300">{sensor.batteryLabel}</td>
                        <td className="py-4 text-right">
                          <Link
                            href={`/sensors/${sensor.sensorId}`}
                            className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <h2 className="text-lg font-semibold text-white">Connected Sensor Battery</h2>
                {batteryTrend.length > 0 ? (
                  <div className="mt-5">
                    <MiniBars points={batteryTrend} />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">배터리 정보가 등록된 센서가 없습니다.</p>
                )}
              </Panel>

              <Panel>
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                <div className="mt-4 space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <p className="font-medium text-white">{log.eventType}</p>
                      <p className="mt-1 text-sm text-slate-300">{log.details}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                    </div>
                  ))}
                </div>
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

export function AnalyticsScreen() {
  const state = useWorkspaceLoader();
  const spaces = state.workspace?.spaces ?? [];
  const focusSpace = spaces[0] ?? null;
  const { history } = useSpaceHistoryState(state, focusSpace);
  const rankingSpaces = spaces
    .slice()
    .sort((left, right) => right.occupancyRate - left.occupancyRate)
    .slice(0, 5);
  const alertingSpaces = spaces.filter(
    (space) => space.occupancyRate >= 90 || space.lowBatteryCount > 0 || space.offlineCount > 0,
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
          tone: "critical" as const,
          title: "Highest Occupancy",
          message: `${rankingSpaces[0].name} is currently the busiest managed zone at ${Math.round(
            rankingSpaces[0].occupancyRate,
          )}%.`,
        }
      : null,
    alertingSpaces.find((space) => space.offlineCount > 0)
      ? {
          tone: "warning" as const,
          title: "Hardware Attention",
          message: `${alertingSpaces.find((space) => space.offlineCount > 0)?.name} has offline or maintenance sensors.`,
        }
      : null,
    alertingSpaces.find((space) => space.lowBatteryCount > 0)
      ? {
          tone: "info" as const,
          title: "Battery Watch",
          message: `${alertingSpaces.find((space) => space.lowBatteryCount > 0)?.name} has low-battery sensors pending replacement.`,
        }
      : null,
  ].filter(Boolean) as Array<{ tone: "critical" | "warning" | "info"; title: string; message: string }>;

  return (
    <ShellContent
      activeKey="analytics"
      title="Data Analytics"
      subtitle="Spatial utilization trends, comparative rankings, and predictive operational insights."
      state={state}
      toolbar={
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white">
            Today
          </button>
          <button className="px-4 py-2 text-sm font-medium text-slate-500">Week</button>
          <button className="px-4 py-2 text-sm font-medium text-slate-500">Month</button>
          <button className="px-4 py-2 text-sm font-medium text-slate-500">Custom</button>
        </div>
      }
    >
      {state.workspace ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Current Occupancy"
              value={formatNumber(state.workspace.summary.occupiedNow)}
              hint={`${formatPercent(state.workspace.summary.occupancyRate)} average live utilization`}
            />
            <MetricCard
              label="Peak Hour Today"
              value={formatHourLabel(peakHistoryPoint?.label)}
              hint={peakHistoryPoint ? `${Math.round(peakHistoryPoint.value)}% usage` : "No data"}
              tone="orange"
            />
            <MetricCard
              label="Monitored Zones"
              value={formatNumber(spaces.length)}
              hint="실시간 공간 상태가 수집되는 영역 수"
              tone="rose"
            />
            <MetricCard
              label="Alerting Spaces"
              value={formatNumber(alertingSpaces.length)}
              hint="Occupancy, battery, or sensor issues detected"
              tone="emerald"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Hourly Occupancy Trends
                </h2>
                <button className="text-sm font-medium text-sky-600 dark:text-sky-300">
                  Download CSV
                </button>
              </div>
              <div className="mt-6">
                <MiniBars points={history} />
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Zone Utilization Ranking
                </h2>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  Filter Zones
                </button>
              </div>
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
                          className="h-full rounded-full bg-sky-500"
                          style={{
                            width: `${Math.max(space.occupancyRate, 8)}%`,
                            opacity: 0.35 + Math.min(space.occupancyRate / 100, 0.65),
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {space.occupancyRate >= 75 ? "UP" : "STEADY"}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Space Snapshot Matrix
                </h2>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="pb-3 pr-4">Zone</th>
                      <th className="pb-3 pr-4">Occupancy</th>
                      <th className="pb-3 pr-4">Sensors</th>
                      <th className="pb-3 pr-4">Battery Watch</th>
                      <th className="pb-3">Status</th>
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
                          {formatNumber(space.occupiedCount)} occupants ({Math.round(space.occupancyRate)}%)
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Operational Findings</h2>
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
                            : "border-sky-500",
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-[0.18em]",
                          finding.tone === "critical"
                            ? "text-rose-600 dark:text-rose-300"
                            : finding.tone === "warning"
                              ? "text-amber-600 dark:text-amber-300"
                              : "text-sky-600 dark:text-sky-300",
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
                className="mt-auto pt-4 text-sm font-medium text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
              >
                View All System Logs
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

      const headers = await resolveAuthHeaders();
      if (!headers || cancelled) {
        setSettingsLoading(false);
        return;
      }

      try {
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
    if (!isReady) {
      return;
    }

    setSaving(true);
    setNotice(null);
    setError(null);

    const headers = await resolveAuthHeaders();
    if (!headers) {
      setSaving(false);
      return;
    }

    try {
      const nextSettings = await updateAdminConsoleSettings(headers, {
        overcapacityLimit: Number.parseInt(overCapacity, 10) || 0,
        warningBufferPercent: Number.parseInt(warningBuffer, 10) || 0,
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
  ]);

  const recentChanges =
    workspace?.logs.slice(0, 3).map((item) => ({
      label: item.eventType,
      relative: formatRelative(item.timestamp),
    })) ?? [];
  const retentionOptions = [
    {
      label: "Sensor Raw Data Logs",
      value: sensorRetention,
      setValue: setSensorRetention,
    },
    {
      label: "System Error Logs",
      value: errorRetention,
      setValue: setErrorRetention,
    },
    {
      label: "Alert History",
      value: alertRetention,
      setValue: setAlertRetention,
    },
  ];
  const notificationOptions = [
    {
      label: "All Notifications",
      description: "전체 운영 알림을 기본 활성화합니다.",
      checked: allNotificationsEnabled,
      setChecked: setAllNotificationsEnabled,
    },
    {
      label: "Occupancy Alerts",
      description: "과밀도와 임계치 도달 알림을 전송합니다.",
      checked: occupancyNotificationsEnabled,
      setChecked: setOccupancyNotificationsEnabled,
    },
    {
      label: "Battery Alerts",
      description: "배터리 임계치 미만 센서를 감시합니다.",
      checked: batteryNotificationsEnabled,
      setChecked: setBatteryNotificationsEnabled,
    },
    {
      label: "Email Notifications",
      description: "관리자 이메일 채널을 사용합니다.",
      checked: emailNotificationsEnabled,
      setChecked: setEmailNotificationsEnabled,
    },
    {
      label: "Push Notifications",
      description: "웹 푸시 알림을 사용합니다.",
      checked: pushNotificationsEnabled,
      setChecked: setPushNotificationsEnabled,
    },
    {
      label: "SMS Notifications",
      description: "긴급 SMS 채널을 사용합니다.",
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
      title="System Settings"
      subtitle="Configure thresholds, retention, notification channels, and template policies."
      state={state}
      toolbar={toolButton(
        settingsLoading || saving ? "Saving..." : "Save Settings",
        () => void saveSettings(),
        "primary",
        settingsLoading || saving,
      )}
    >
      {workspace ? (
        <div className="space-y-6">
          <NoticeStrip notice={notice} error={error} />
          {settingsLoading ? (
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings Snapshot</h2>
                <StatusBadge tone="info">Loading</StatusBadge>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">관리자 설정을 불러오는 중입니다.</p>
            </Panel>
          ) : null}
          <Panel>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Alert Thresholds</h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">
                    Occupancy Notification
                  </label>
                  <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                    Set the global occupancy level that triggers a system-wide alert.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="relative h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="absolute left-0 top-0 h-full rounded-full bg-sky-500" style={{ width: `${Math.min(Math.max(Number(warningBuffer) || 0, 0), 100)}%` }} />
                    </div>
                    <span className="min-w-12 text-right text-lg font-black text-sky-600 dark:text-sky-300">
                      {warningBuffer}%
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Occupancy Alert Limit</span>
                    <input value={overCapacity} onChange={(event) => setOverCapacity(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Warning Buffer (%)</span>
                    <input value={warningBuffer} onChange={(event) => setWarningBuffer(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-900" />
                  </label>
                </div>
                <div className="flex gap-3">
                  {toolButton("Save Thresholds", () => void saveSettings(), "primary", saving)}
                  {toolButton("Revert Changes", () => restoreLoadedSettings(), "default", !settings)}
                </div>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(43,140,238,0.16),transparent_40%)]" />
                <div className="relative flex h-full flex-col items-center justify-center text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Live Preview</p>
                  <p className="mt-3 max-w-xs text-sm text-slate-600 dark:text-slate-300">
                    Visualization of alert intensity based on the current {warningBuffer}% threshold.
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Data Retention</h2>
              <div className="mt-5 space-y-4">
                {retentionOptions.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/35">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Policy configuration</p>
                    </div>
                    <select value={item.value} onChange={(event) => item.setValue(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-sky-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-sky-300">
                      {["30 Days", "60 Days", "90 Days", "1 Year", "2 Years"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notification Channels</h2>
              <div className="mt-5 space-y-4">
                <div className="space-y-3">
                  {notificationOptions.map((item) => (
                    <label key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/35">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                      <input type="checkbox" checked={item.checked} onChange={(event) => item.setChecked(event.target.checked)} className="size-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
                    </label>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="flex flex-col gap-6 bg-sky-500/10 dark:bg-sky-500/10 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-bold text-sky-700 dark:text-sky-300">Managed Infrastructure</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {workspace.gateways.length} gateways, {workspace.sensors.length} sensors, {workspace.alerts.length} open alerts are currently under this profile.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm font-semibold text-sky-800 dark:text-sky-200">
              <div>
                <p className="text-xl font-black">{workspace.spaces.length}</p>
                <p className="text-xs uppercase tracking-[0.18em]">Spaces</p>
              </div>
              <div>
                <p className="text-xl font-black">{workspace.gateways.filter((gateway) => gateway.status === "Online").length}</p>
                <p className="text-xs uppercase tracking-[0.18em]">Online</p>
              </div>
              <div>
                <p className="text-xl font-black">{workspace.sensors.filter((sensor) => sensor.status === "ACTIVE").length}</p>
                <p className="text-xs uppercase tracking-[0.18em]">Active Sensors</p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configuration Summary</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>Tracked spaces: {workspace.spaces.length}</p>
                <p>Managed sensors: {workspace.sensors.length}</p>
                <p>Current alerts: {workspace.alerts.length}</p>
                <p>Admin profile: {settings?.managedByProfileId ?? "unknown"}</p>
                <p>Role: {settings?.role ?? "MANAGER"}</p>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Changes</h2>
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
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Operations Note</p>
                <p className="mt-2 font-bold text-slate-900 dark:text-white">Destructive admin actions are not exposed here.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  현재 화면에서는 실제로 저장 가능한 임계치, 보관 정책, 알림 채널만 관리합니다.
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
      title="Logs"
      subtitle="Review grouped event streams, severity mix, and recent device health signals."
      state={state}
      toolbar={
        <>
          {searchField(query, setQuery, "Filter by device ID, event, or details...")}
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | "all")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">
              Severity: All
            </option>
            <option value="critical">
              Critical
            </option>
            <option value="warning">
              Warning
            </option>
            <option value="info">
              Info
            </option>
            <option value="success">
              Success
            </option>
          </select>
        </>
      }
    >
      {state.workspace ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {logs.slice(0, 12).map((log) => (
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
                            : "bg-sky-500",
                    )}
                  >
                    <Icon name="alert" className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {log.severity}
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
          </div>

          <div className="space-y-6">
            <Panel>
              <h2 className="font-bold text-slate-900 dark:text-white">Log Statistics</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last 24 hours activity</p>
              <div className="mt-6 space-y-4">
                {(["critical", "warning", "info"] as const).map((level) => {
                  const count = logs.filter((log) => log.severity === level).length;
                  const color =
                    level === "critical" ? "bg-rose-500" : level === "warning" ? "bg-amber-500" : "bg-sky-500";
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize text-slate-500">{level}</span>
                        <span className={cn("font-bold", level === "critical" ? "text-rose-500" : level === "warning" ? "text-amber-500" : "text-sky-500")}>{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className={color} style={{ width: `${Math.max((count / Math.max(logs.length, 1)) * 100, 6)}%`, height: "100%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-bold text-slate-900 dark:text-white">Device Health</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-200">
                    {state.workspace.sensors.filter((sensor) => sensor.status === "ACTIVE").length}/{state.workspace.sensors.length} Sensors Online
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-200">
                    {state.workspace.gateways.filter((gateway) => gateway.status === "Online").length}/{state.workspace.gateways.length} Gateways Online
                  </span>
                </div>
              </div>
            </Panel>

            <Panel className="bg-sky-500/10 dark:bg-sky-500/10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                Smart Insight
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Anomalous repetition was detected in the most recent critical stream. Inspect the affected gateway uplink before packet loss cascades.
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
