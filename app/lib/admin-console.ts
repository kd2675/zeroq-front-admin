import {
  deleteJson,
  getAdminJson,
  getJson,
  postAdminJson,
  postJson,
  putAdminJson,
  putJson,
} from "@/app/lib/api";

type PagePayload<T> = {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

type SpaceApiItem = {
  id: number;
  name: string;
  description?: string;
  averageRating?: number;
  reviewCount?: number;
  imageUrl?: string;
  verified?: boolean;
  address?: string;
};

type SensorSnapshotApi = {
  placeId: number;
  occupiedCount: number;
  activeSensorCount: number;
  occupancyRate: number;
  crowdLevel: string;
  lastMeasuredAt?: string;
  lastCalculatedAt?: string;
  sourceWindowSeconds?: number;
};

type SensorDeviceApi = {
  id: number;
  sensorId: string;
  macAddress?: string;
  model: string;
  firmwareVersion?: string;
  type: string;
  protocol: string;
  status: string;
  placeId?: number;
  gatewayId?: string;
  positionCode?: string;
  batteryPercent?: number;
  occupancyThresholdCm?: number;
  calibrationOffsetCm?: number;
  lastHeartbeatAt?: string;
  lastSequenceNo?: number;
  metadataJson?: string;
  createDate?: string;
  updateDate?: string;
};

type TelemetryApi = {
  telemetryId: number;
  sensorId: string;
  placeId?: number;
  distanceCm?: number;
  occupied?: boolean;
  padLeftValue?: number;
  padRightValue?: number;
  qualityStatus?: string;
  measuredAt?: string;
  receivedAt?: string;
  batteryPercent?: number;
  confidence?: number;
};

type SpaceOverviewApi = {
  spaceId: number;
  spaceName: string;
  snapshot?: SensorSnapshotApi | null;
  sensors?: SensorDeviceApi[];
  recentTelemetry?: TelemetryApi[];
};

type OccupancyHistoryApi = {
  spaceId: number;
  spaceName: string;
  currentOccupancy: number;
  maxCapacity: number;
  occupancyPercentage: number;
  crowdLevel: string;
  lastUpdated?: string;
};

export type Severity = "info" | "warning" | "critical" | "success";

export type TrendPoint = {
  label: string;
  value: number;
};

export type SensorRecord = {
  id: number;
  sensorId: string;
  macAddress?: string;
  model: string;
  firmwareVersion?: string;
  type: string;
  protocol: string;
  status: string;
  placeId: number;
  positionCode?: string;
  batteryPercent: number | null;
  lastHeartbeatAt?: string;
  lastSequenceNo?: number;
  spaceName: string;
  occupancyRate: number;
  gatewayId?: string | null;
  detectionStatus: "Occupied" | "Vacant" | "Offline";
  signalStrength?: "Excellent" | "Good" | "Weak" | "Unknown" | null;
  locationLabel?: string | null;
  batteryLabel: string;
};

export type SpaceRecord = {
  spaceId: number;
  spaceCode?: string;
  name: string;
  description?: string;
  operationalStatus?: string;
  averageRating: number;
  reviewCount: number;
  verified: boolean;
  snapshot: SensorSnapshotApi | null;
  occupancyRate: number;
  occupiedCount: number;
  activeSensorCount: number;
  crowdLevel: string;
  sensors: SensorRecord[];
  recentTelemetry: TelemetryApi[];
  lowBatteryCount: number;
  offlineCount: number;
  avgBattery: number;
  trend: TrendPoint[];
  addressLabel: string;
};

export type GatewayRecord = {
  gatewayId: string;
  gatewayName?: string | null;
  gatewayRole?: string | null;
  regionCode?: string | null;
  spaceId: number;
  spaceName: string;
  locationLabel?: string | null;
  ipAddress?: string | null;
  sensorCapacity?: number | null;
  currentSensorLoad?: number | null;
  firmwareVersion?: string | null;
  signalStrength?: "Excellent" | "Good" | "Weak" | "Unknown" | null;
  throughputMbps?: number | null;
  status: "Online" | "Offline" | "Unknown";
  linkedBridge?: string | null;
  latencyMs?: number | null;
  packetLossPercent?: number | null;
  connectedSensors: SensorRecord[];
  lastHeartbeatAt?: string;
};

export type AlertRecord = {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string;
  createdAt: string;
  spaceId?: number;
  sensorId?: string;
  gatewayId?: string;
};

export type LogRecord = {
  id: string;
  timestamp: string;
  eventType: string;
  targetLabel: string;
  severity: Severity;
  details: string;
  spaceId?: number;
  sensorId?: string;
  gatewayId?: string;
};

export type DashboardSummary = {
  occupiedNow: number;
  occupancyRate: number;
  activeSensors: number;
  offlineSensors: number;
  gatewayHealth: number;
  peakRate: number;
};

export type AdminWorkspace = {
  spaces: SpaceRecord[];
  sensors: SensorRecord[];
  gateways: GatewayRecord[];
  alerts: AlertRecord[];
  logs: LogRecord[];
  summary: DashboardSummary;
  generatedAt: string;
};

export type AdminConsoleSettings = {
  overcapacityLimit: number;
  warningBufferPercent: number;
  sensorRawDataRetention: string;
  systemErrorRetention: string;
  alertHistoryRetention: string;
  allNotificationsEnabled: boolean;
  occupancyNotificationsEnabled: boolean;
  batteryNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  managedByProfileId: number;
  role: string;
};

export type UpdateAdminConsoleSettingsInput = {
  overcapacityLimit: number;
  warningBufferPercent: number;
  sensorRawDataRetention: string;
  systemErrorRetention: string;
  alertHistoryRetention: string;
  allNotificationsEnabled: boolean;
  occupancyNotificationsEnabled: boolean;
  batteryNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
};

export type SensorRegisterInput = {
  sensorId: string;
  macAddress: string;
  model: string;
  type: string;
  protocol: string;
  placeId: number;
  gatewayId?: string | null;
};

export type SensorCommandInput = {
  sensorId: string;
  commandType: string;
  commandPayload?: string | null;
};

export type CreateGatewayInput = {
  gatewayId: string;
  gatewayName: string;
  spaceId: number;
  gatewayRole?: string;
  regionCode?: string;
  locationLabel?: string;
  ipAddress?: string;
  sensorCapacity: number;
  firmwareVersion?: string;
  description?: string;
  linkedBridge?: string;
};

export type CreateZoneInput = {
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  operatingHours?: string;
  imageUrl?: string;
  operationalStatus?: string;
};

function createEmptyWorkspace(): AdminWorkspace {
  return {
    spaces: [],
    sensors: [],
    gateways: [],
    alerts: [],
    logs: [],
    summary: {
      occupiedNow: 0,
      occupancyRate: 0,
      activeSensors: 0,
      offlineSensors: 0,
      gatewayHealth: 0,
      peakRate: 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function loadAdminWorkspace(
  headers: Record<string, string>,
): Promise<AdminWorkspace> {
  const adminResult = await getAdminJson<AdminWorkspace>(
    "/api/zeroq/v1/admin/workspace",
    headers,
  );
  if (adminResult.ok && adminResult.data) {
    return adminResult.data;
  }
  if (adminResult.ok) {
    return createEmptyWorkspace();
  }
  if (adminResult.status === 401 || adminResult.status === 403) {
    throw new Error(adminResult.message ?? "관리자 권한이 없거나 세션이 만료되었습니다.");
  }
  if (adminResult.status >= 500) {
    throw new Error(adminResult.message ?? "관리자 워크스페이스 서버 오류가 발생했습니다.");
  }
  if (adminResult.status === 0) {
    throw new Error(adminResult.message ?? "관리자 서버에 연결하지 못했습니다.");
  }
  throw new Error(adminResult.message ?? "관리자 워크스페이스를 불러오지 못했습니다.");
}

export async function loadAdminConsoleSettings(
  headers: Record<string, string>,
): Promise<AdminConsoleSettings> {
  const result = await getAdminJson<AdminConsoleSettings>(
    "/api/zeroq/v1/admin/settings",
    headers,
  );

  if (result.ok && result.data) {
    return result.data;
  }

  throw new Error(result.message ?? "관리자 설정을 불러오지 못했습니다.");
}

export async function createZone(
  headers: Record<string, string>,
  payload: CreateZoneInput,
): Promise<SpaceApiItem> {
  const result = await postAdminJson<SpaceApiItem>("/api/zeroq/v1/spaces", payload, headers);
  if (result.ok && result.data) {
    return result.data;
  }
  throw new Error(result.message ?? "공간을 생성하지 못했습니다.");
}

export async function createGateway(
  headers: Record<string, string>,
  payload: CreateGatewayInput,
) {
  const result = await postAdminJson("/api/zeroq/v1/gateways", payload, headers);
  if (result.ok && result.data) {
    return result.data;
  }
  throw new Error(result.message ?? "게이트웨이를 생성하지 못했습니다.");
}

export async function updateAdminConsoleSettings(
  headers: Record<string, string>,
  payload: UpdateAdminConsoleSettingsInput,
): Promise<AdminConsoleSettings> {
  const result = await putAdminJson<AdminConsoleSettings>(
    "/api/zeroq/v1/admin/settings",
    payload,
    headers,
  );

  if (result.ok && result.data) {
    return result.data;
  }

  throw new Error(result.message ?? "관리자 설정을 저장하지 못했습니다.");
}

export async function loadSpaceHistory(
  headers: Record<string, string>,
  _space: SpaceRecord,
): Promise<OccupancyHistoryApi[]> {
  const result = await getJson<PagePayload<OccupancyHistoryApi>>(
    `/api/zeroq/v1/occupancy/spaces/${_space.spaceId}/history?page=0&size=12`,
    headers,
  );

  return result.ok && result.data?.content?.length ? result.data.content : [];
}

export async function registerSensorDevice(
  headers: Record<string, string>,
  payload: SensorRegisterInput,
) {
  return postJson<SensorDeviceApi>("/api/zeroq/v1/space-sensors/devices", payload, headers);
}

export async function installSensorDevice(
  headers: Record<string, string>,
  sensorId: string,
  placeId: number,
  gatewayId?: string | null,
) {
  return putJson<SensorDeviceApi>(
    `/api/zeroq/v1/space-sensors/devices/${sensorId}/install`,
    { placeId, gatewayId },
    headers,
  );
}

export async function deleteSensorDevice(
  headers: Record<string, string>,
  sensorId: string,
) {
  return deleteJson<null>(`/api/zeroq/v1/space-sensors/devices/${sensorId}`, headers);
}

export async function createSensorCommand(
  headers: Record<string, string>,
  payload: SensorCommandInput,
) {
  return postJson("/api/zeroq/v1/space-sensors/commands", payload, headers);
}
