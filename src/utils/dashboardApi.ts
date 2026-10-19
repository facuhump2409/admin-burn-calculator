// Same-origin by default: the admin app and its API share admin.regladecuadrantes.com.
function apiBaseUrl(): string {
  return ((import.meta as any).env.VITE_API_URL || '').replace(/\/+$/, '');
}

export type DashboardFilters = {
  gender?: string;
  ageGroup?: string;
  airway?: string;
  agent?: string;
  severity?: string;
  formula?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  refresh?: boolean;
};

export type CountItem = {
  label: string;
  count: number;
};

export type FluidAverage = {
  label: string;
  totalIn24h: number;
  first8hMl: number;
  remaining16hMl: number;
  count: number;
};

export type AreaEvaluation = {
  areaKey: string;
  label: string;
  side: string | null;
  burnedPercentage: number;
  maxPercentage: number;
  selectedAreaPercentage: number;
};

export type ConfirmedAreaDelta = {
  areaKey: string;
  label: string;
  side: string | null;
  estimatedPercentage: number;
  actualPercentage: number;
  deltaPercentage: number;
};

export type HospitalConfirmationStats = {
  hospital: string;
  confirmedCount: number;
  avgDeltaTotal: number;
  meanAbsoluteDeviation: number;
};

export type ConfirmedRow = {
  id: string;
  createdAt: string;
  hospital: string | null;
  confirmedAt: string;
  estimatedBurnPercentage: number;
  actualBurnPercentage: number;
  deltaPercentage: number;
  areaDeltas: ConfirmedAreaDelta[];
};

export type DashboardRow = {
  id: string;
  createdAt: string;
  age: number;
  ageUnit: string | null;
  gender: string | null;
  location: string | null;
  accidentPlace: string | null;
  servicio: string | null;
  hospital: string | null;
  causalAgent: string | null;
  airwayCompromise: boolean | null;
  abuseSuspected: boolean | null;
  careSetting: 'internacion' | 'ambulatorio' | null;
  medicationBrand: string | null;
  burnPercentage: number;
  sctM2: number | null;
  scqM2: number | null;
  burnClassification: string | null;
  garcesTotalIndex: number | null;
  garcesSeverityGroup: string | null;
  formulaType: 'parkland' | 'galveston';
  totalIn24h: number | null;
  first8hMl: number | null;
  remaining16hMl: number | null;
};

export type DashboardData = {
  updatedAt: string;
  totalAvailable: number;
  totalFiltered: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalCases: number;
    averageAge: number;
    averageBurnPercentage: number;
    maxBurnPercentage: number;
    airwayCount: number;
    airwayRate: number;
    highSeverityCount: number;
    highSeverityRate: number;
    formulaCounts: {
      parkland: number;
      galveston: number;
    };
    careSetting: {
      internacionCount: number;
      ambulatorioCount: number;
      ambulatorioRate: number;
    };
    confirmation: {
      confirmedCount: number;
      confirmationRate: number;
      avgDeltaTotal: number;
      meanAbsoluteDeviation: number;
      byHospital: HospitalConfirmationStats[];
    };
  };
  filterOptions: {
    causalAgents: string[];
    genders: string[];
  };
  breakdowns: {
    gender: CountItem[];
    ageGroups: CountItem[];
    location: CountItem[];
    accidentPlace: CountItem[];
    servicio: CountItem[];
    hospital: CountItem[];
    causalAgent: CountItem[];
    careSetting: CountItem[];
    medicationBrand: CountItem[];
    airwayByAgent: CountItem[];
    severity: CountItem[];
    formula: CountItem[];
    burnBuckets: CountItem[];
    fluidAveragesBySeverity: FluidAverage[];
  };
  confirmedRows: ConfirmedRow[];
  rows: DashboardRow[];
};

function queryString(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export class DashboardApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DashboardApiError';
  }
}

async function parseError(response: Response, prefix: string): Promise<Error> {
  let suffix = String(response.status);
  try {
    const body = await response.json() as { error?: string };
    if (body.error) suffix = body.error;
  } catch {
    suffix = String(response.status);
  }
  return new DashboardApiError(`${prefix}_${suffix}`, response.status);
}

export async function loginAdmin(password: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/api/admin-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw await parseError(response, 'admin_login_failed');
  }
}

export async function fetchAdminSessionStatus(): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl()}/api/admin-session-status`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 204) return true;
  if (response.status === 401) return false;
  if (!response.ok) {
    throw await parseError(response, 'admin_session_status_failed');
  }
  throw new DashboardApiError(`admin_session_status_failed_${response.status}`, response.status);
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/api/admin-logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    throw await parseError(response, 'admin_logout_failed');
  }
}

export async function fetchDashboardData(
  filters: DashboardFilters = {},
): Promise<DashboardData> {
  const response = await fetch(`${apiBaseUrl()}/api/dashboard${queryString(filters)}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw await parseError(response, 'dashboard_fetch_failed');
  }

  return response.json() as Promise<DashboardData>;
}
