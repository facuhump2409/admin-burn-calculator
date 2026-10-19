import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { applyCorsCredentials, handleCorsPreflight } from './lib/cors.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_PREFIX,
  createRedis,
  parseNamedCookie,
  validatePrefixedSession,
} from './lib/session.js';
import { buildConfirmationSummary, confirmationDelta } from './lib/confirmationMetrics.js';

type DashboardRowsCache = {
  dayKey: string;
  rows: DashboardRow[];
};

let dashboardRowsCache: DashboardRowsCache | null = null;

type DashboardRow = {
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
  burnAreaEvaluation: AreaEvaluation[];
  actualBurnPercentage: number | null;
  actualBurnAreaEvaluation: AreaEvaluation[] | null;
  confirmedAt: string | null;
};

type AreaEvaluation = {
  areaKey: string;
  label: string;
  side: string | null;
  burnedPercentage: number;
  maxPercentage: number;
  selectedAreaPercentage: number;
};

type ConfirmedAreaDelta = {
  areaKey: string;
  label: string;
  side: string | null;
  estimatedPercentage: number;
  actualPercentage: number;
  deltaPercentage: number;
};

type ConfirmedRow = {
  id: string;
  createdAt: string;
  hospital: string | null;
  confirmedAt: string;
  estimatedBurnPercentage: number;
  actualBurnPercentage: number;
  deltaPercentage: number;
  areaDeltas: ConfirmedAreaDelta[];
};

type Filters = {
  gender: string;
  ageGroup: string;
  airway: string;
  agent: string;
  severity: string;
  formula: string;
  search: string;
  page: number;
  pageSize: number;
};

type CountItem = {
  label: string;
  count: number;
};

type FluidAverage = {
  label: string;
  totalIn24h: number;
  first8hMl: number;
  remaining16hMl: number;
  count: number;
};

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function positiveInt(value: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseFilters(req: VercelRequest): Filters {
  return {
    gender: firstQueryValue(req.query.gender),
    ageGroup: firstQueryValue(req.query.ageGroup),
    airway: firstQueryValue(req.query.airway),
    agent: firstQueryValue(req.query.agent),
    severity: firstQueryValue(req.query.severity),
    formula: firstQueryValue(req.query.formula),
    search: firstQueryValue(req.query.search).trim().toLowerCase(),
    page: positiveInt(firstQueryValue(req.query.page), 1, 10000),
    pageSize: positiveInt(firstQueryValue(req.query.pageSize), 12, 100),
  };
}

function cacheDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function shouldRefreshCache(req: VercelRequest): boolean {
  return firstQueryValue(req.query.refresh) === 'true';
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function ageGroup(age: number): string {
  if (age < 1) return '0-1';
  if (age < 3) return '1-3';
  if (age < 6) return '3-6';
  if (age < 10) return '6-9';
  return '10+';
}

function compactSeverity(group: string | null, totalIndex: number | null): string {
  const normalized = (group || '').toLowerCase();
  if (normalized.includes('leve')) return 'Leve';
  if (normalized.includes('moderado')) return 'Moderado';
  if (normalized.includes('grave')) return 'Grave';
  if (normalized.includes('crítico') || normalized.includes('critico')) {
    return 'Crítico';
  }
  if (normalized.includes('sobrevida')) return 'Crítico';
  if (totalIndex === null) return 'Sin clasificar';
  if (totalIndex <= 40) return 'Leve';
  if (totalIndex <= 70) return 'Moderado';
  if (totalIndex <= 100) return 'Grave';
  return 'Crítico';
}

function matchesSeverity(row: DashboardRow, severity: string): boolean {
  if (!severity || severity === 'ALL') return true;
  return compactSeverity(row.garcesSeverityGroup, row.garcesTotalIndex) === severity;
}

function matchesFormula(row: DashboardRow, formula: string): boolean {
  if (!formula || formula === 'ALL') return true;
  return row.formulaType === formula.toLowerCase();
}

function matchesAirway(row: DashboardRow, airway: string): boolean {
  if (!airway || airway === 'ALL') return true;
  if (airway === 'true' || airway === 'Si' || airway === 'Sí') {
    return row.airwayCompromise === true;
  }
  if (airway === 'false' || airway === 'No') {
    return row.airwayCompromise === false;
  }
  return true;
}

function searchableText(row: DashboardRow): string {
  return [
    row.id,
    row.gender,
    row.location,
    row.accidentPlace,
    row.servicio,
    row.hospital,
    row.causalAgent,
    row.careSetting,
    row.medicationBrand,
    row.garcesSeverityGroup,
    row.formulaType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function applyFilters(rows: DashboardRow[], filters: Filters): DashboardRow[] {
  return rows.filter((row) => {
    if (filters.gender && filters.gender !== 'ALL' && row.gender !== filters.gender) {
      return false;
    }
    if (filters.ageGroup && filters.ageGroup !== 'ALL' && ageGroup(row.age) !== filters.ageGroup) {
      return false;
    }
    if (!matchesAirway(row, filters.airway)) return false;
    if (filters.agent && filters.agent !== 'ALL' && row.causalAgent !== filters.agent) {
      return false;
    }
    if (!matchesSeverity(row, filters.severity)) return false;
    if (!matchesFormula(row, filters.formula)) return false;
    if (filters.search && !searchableText(row).includes(filters.search)) {
      return false;
    }
    return true;
  });
}

function countBy(rows: DashboardRow[], labelFor: (row: DashboardRow) => string | null): CountItem[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = labelFor(row) || 'Sin dato';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function burnBucket(value: number): string {
  if (value < 10) return '0-9%';
  if (value < 20) return '10-19%';
  if (value < 30) return '20-29%';
  if (value < 40) return '30-39%';
  if (value < 50) return '40-49%';
  return '50%+';
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function fluidAveragesBySeverity(rows: DashboardRow[]): FluidAverage[] {
  const groups = new Map<string, DashboardRow[]>();
  rows.forEach((row) => {
    const severity = compactSeverity(row.garcesSeverityGroup, row.garcesTotalIndex);
    groups.set(severity, [...(groups.get(severity) || []), row]);
  });

  return [...groups.entries()].map(([label, groupRows]) => ({
    label,
    totalIn24h: mean(groupRows.map((row) => row.totalIn24h).filter((v): v is number => v !== null)),
    first8hMl: mean(groupRows.map((row) => row.first8hMl).filter((v): v is number => v !== null)),
    remaining16hMl: mean(groupRows.map((row) => row.remaining16hMl).filter((v): v is number => v !== null)),
    count: groupRows.length,
  }));
}

function formulaCounts(rows: DashboardRow[]): { parkland: number; galveston: number } {
  return {
    parkland: rows.filter((row) => row.formulaType === 'parkland').length,
    galveston: rows.filter((row) => row.formulaType === 'galveston').length,
  };
}

function confirmedRowsOf(rows: DashboardRow[]): DashboardRow[] {
  return rows.filter((row) => row.confirmedAt !== null && row.actualBurnPercentage !== null);
}

function buildAreaDeltas(row: DashboardRow): ConfirmedAreaDelta[] {
  const actualByKey = new Map((row.actualBurnAreaEvaluation || []).map((area) => [area.areaKey, area]));
  return row.burnAreaEvaluation
    .map((estimated) => {
      const actual = actualByKey.get(estimated.areaKey);
      if (!actual) return null;
      return {
        areaKey: estimated.areaKey,
        label: estimated.label,
        side: estimated.side,
        estimatedPercentage: estimated.burnedPercentage,
        actualPercentage: actual.burnedPercentage,
        deltaPercentage: Math.round((actual.burnedPercentage - estimated.burnedPercentage) * 100) / 100,
      };
    })
    .filter((item): item is ConfirmedAreaDelta => item !== null);
}

function buildConfirmedRows(rows: DashboardRow[]): ConfirmedRow[] {
  return confirmedRowsOf(rows)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      hospital: row.hospital,
      confirmedAt: row.confirmedAt as string,
      estimatedBurnPercentage: row.burnPercentage,
      actualBurnPercentage: row.actualBurnPercentage as number,
      deltaPercentage:
        Math.round(
          confirmationDelta({ burnPercentage: row.burnPercentage, actualBurnPercentage: row.actualBurnPercentage as number }) * 100,
        ) / 100,
      areaDeltas: buildAreaDeltas(row),
    }))
    .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());
}

function buildPayload(allRows: DashboardRow[], filteredRows: DashboardRow[], filters: Filters) {
  const total = filteredRows.length;
  const airwayCount = filteredRows.filter((row) => row.airwayCompromise === true).length;
  const highSeverityCount = filteredRows.filter((row) => {
    const severity = compactSeverity(row.garcesSeverityGroup, row.garcesTotalIndex);
    return severity === 'Grave' || severity === 'Crítico';
  }).length;
  const formulas = formulaCounts(filteredRows);
  const internacionCount = filteredRows.filter((row) => row.careSetting === 'internacion').length;
  const ambulatorioCount = filteredRows.filter((row) => row.careSetting === 'ambulatorio').length;
  const careSettingResolved = internacionCount + ambulatorioCount;
  const start = (filters.page - 1) * filters.pageSize;
  const pageRows = filteredRows.slice(start, start + filters.pageSize);

  return {
    updatedAt: new Date().toISOString(),
    totalAvailable: allRows.length,
    totalFiltered: total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(Math.ceil(total / filters.pageSize), 1),
    summary: {
      totalCases: total,
      averageAge: mean(filteredRows.map((row) => row.age)),
      averageBurnPercentage: mean(filteredRows.map((row) => row.burnPercentage)),
      maxBurnPercentage: Math.max(0, ...filteredRows.map((row) => row.burnPercentage)),
      airwayCount,
      airwayRate: total > 0 ? Math.round((airwayCount / total) * 1000) / 10 : 0,
      highSeverityCount,
      highSeverityRate: total > 0 ? Math.round((highSeverityCount / total) * 1000) / 10 : 0,
      formulaCounts: formulas,
      careSetting: {
        internacionCount,
        ambulatorioCount,
        ambulatorioRate:
          careSettingResolved > 0 ? Math.round((ambulatorioCount / careSettingResolved) * 1000) / 10 : 0,
      },
      confirmation: buildConfirmationSummary(filteredRows),
    },
    filterOptions: {
      causalAgents: countBy(allRows, (row) => row.causalAgent).map((item) => item.label),
      genders: countBy(allRows, (row) => row.gender).map((item) => item.label),
    },
    breakdowns: {
      gender: countBy(filteredRows, (row) => row.gender),
      ageGroups: countBy(filteredRows, (row) => ageGroup(row.age)),
      location: countBy(filteredRows, (row) => row.location),
      accidentPlace: countBy(filteredRows, (row) => row.accidentPlace),
      servicio: countBy(filteredRows, (row) => row.servicio),
      hospital: countBy(filteredRows, (row) => row.hospital),
      causalAgent: countBy(filteredRows, (row) => row.causalAgent),
      careSetting: countBy(filteredRows, (row) => row.careSetting),
      medicationBrand: countBy(
        filteredRows.filter((row) => row.careSetting === 'ambulatorio'),
        (row) => row.medicationBrand,
      ),
      airwayByAgent: countBy(
        filteredRows.filter((row) => row.airwayCompromise === true),
        (row) => row.causalAgent,
      ),
      severity: countBy(filteredRows, (row) =>
        compactSeverity(row.garcesSeverityGroup, row.garcesTotalIndex),
      ),
      formula: [
        { label: 'Parkland', count: formulas.parkland },
        { label: 'Galveston', count: formulas.galveston },
      ],
      burnBuckets: countBy(filteredRows, (row) => burnBucket(row.burnPercentage)),
      fluidAveragesBySeverity: fluidAveragesBySeverity(filteredRows),
    },
    confirmedRows: buildConfirmedRows(filteredRows),
    rows: pageRows,
  };
}

async function ensureDashboardColumns(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS burn_simulations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      schema_version INTEGER NOT NULL,
      formula_type TEXT NOT NULL,
      age_years NUMERIC NOT NULL,
      age_unit TEXT,
      gender TEXT,
      weight_kg NUMERIC NOT NULL,
      location TEXT,
      accident_place TEXT,
      servicio TEXT,
      accident_time TEXT,
      causal_agent TEXT,
      airway_compromise BOOLEAN,
      burn_percentage NUMERIC(7, 2) NOT NULL,
      sct_m2 NUMERIC NOT NULL,
      scq_m2 NUMERIC NOT NULL,
      burn_classification TEXT,
      garces_total_index NUMERIC,
      garces_severity_group TEXT,
      burn_area_evaluation JSONB NOT NULL DEFAULT '[]'::jsonb,
      formula_result JSONB NOT NULL DEFAULT '{}'::jsonb,
      base_resuscitation_24h INTEGER,
      maintenance_24h INTEGER,
      total_in_24h INTEGER,
      first_8h_ml INTEGER,
      remaining_16h_ml INTEGER,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS formula_type TEXT NOT NULL DEFAULT 'parkland'`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS age_years NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS age_unit TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS gender TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS weight_kg NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS location TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS accident_place TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS servicio TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS accident_time TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS causal_agent TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS airway_compromise BOOLEAN`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS burn_percentage NUMERIC(7, 2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS sct_m2 NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS scq_m2 NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS burn_classification TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS garces_total_index NUMERIC`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS garces_severity_group TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS burn_area_evaluation JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS formula_result JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS base_resuscitation_24h INTEGER`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS maintenance_24h INTEGER`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS total_in_24h INTEGER`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS first_8h_ml INTEGER`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS remaining_16h_ml INTEGER`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS hospital TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS abuse_suspected BOOLEAN`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS care_setting TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS medication_brand TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmation_token_expires_at TIMESTAMPTZ`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmation_token_used_at TIMESTAMPTZ`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS actual_burn_percentage NUMERIC(7, 2)`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS actual_burn_area_evaluation JSONB`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmed_by_name TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmed_by_role TEXT`;
  await sql`ALTER TABLE burn_simulations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`;
  await sql`
    CREATE INDEX IF NOT EXISTS burn_simulations_created_at_idx
    ON burn_simulations (created_at DESC)
  `;
}

async function fetchRows(sql: NeonQueryFunction<false, false>): Promise<DashboardRow[]> {
  const rows = await sql`
    SELECT
      id::text,
      created_at,
      formula_type,
      age_years,
      age_unit,
      COALESCE(gender, payload->'patient'->>'gender') AS gender,
      weight_kg,
      location,
      accident_place,
      servicio,
      hospital,
      causal_agent,
      airway_compromise,
      abuse_suspected,
      care_setting,
      medication_brand,
      burn_percentage,
      sct_m2,
      scq_m2,
      burn_classification,
      garces_total_index,
      garces_severity_group,
      total_in_24h,
      first_8h_ml,
      remaining_16h_ml,
      burn_area_evaluation,
      actual_burn_percentage,
      actual_burn_area_evaluation,
      confirmed_at
    FROM burn_simulations
    ORDER BY created_at DESC
  `;

  return rows.map((row) => ({
    id: String(row.id),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    age: numberOrNull(row.age_years) || 0,
    ageUnit: textOrNull(row.age_unit),
    gender: textOrNull(row.gender),
    location: textOrNull(row.location),
    accidentPlace: textOrNull(row.accident_place),
    servicio: textOrNull(row.servicio),
    hospital: textOrNull(row.hospital),
    causalAgent: textOrNull(row.causal_agent),
    airwayCompromise:
      typeof row.airway_compromise === 'boolean' ? row.airway_compromise : null,
    abuseSuspected:
      typeof row.abuse_suspected === 'boolean' ? row.abuse_suspected : null,
    careSetting:
      row.care_setting === 'internacion' || row.care_setting === 'ambulatorio' ? row.care_setting : null,
    medicationBrand: textOrNull(row.medication_brand),
    burnPercentage: numberOrNull(row.burn_percentage) || 0,
    sctM2: numberOrNull(row.sct_m2),
    scqM2: numberOrNull(row.scq_m2),
    burnClassification: textOrNull(row.burn_classification),
    garcesTotalIndex: numberOrNull(row.garces_total_index),
    garcesSeverityGroup: textOrNull(row.garces_severity_group),
    formulaType: row.formula_type === 'galveston' ? 'galveston' : 'parkland',
    totalIn24h: numberOrNull(row.total_in_24h),
    first8hMl: numberOrNull(row.first_8h_ml),
    remaining16hMl: numberOrNull(row.remaining_16h_ml),
    burnAreaEvaluation: Array.isArray(row.burn_area_evaluation) ? row.burn_area_evaluation : [],
    actualBurnPercentage: numberOrNull(row.actual_burn_percentage),
    actualBurnAreaEvaluation: Array.isArray(row.actual_burn_area_evaluation)
      ? row.actual_burn_area_evaluation
      : null,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string | Date).toISOString() : null,
  }));
}

async function getCachedRows(
  sql: NeonQueryFunction<false, false>,
  forceRefresh: boolean,
): Promise<DashboardRow[]> {
  const dayKey = cacheDayKey();
  if (!forceRefresh && dashboardRowsCache?.dayKey === dayKey) {
    return dashboardRowsCache.rows;
  }

  const rows = await fetchRows(sql);
  dashboardRowsCache = { dayKey, rows };
  return rows;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleCorsPreflight(req, res)) return;
  applyCorsCredentials(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const redis = createRedis();
  const sid = parseNamedCookie(req.headers.cookie, ADMIN_SESSION_COOKIE_NAME);
  const sessionOk = await validatePrefixedSession(redis, ADMIN_SESSION_PREFIX, sid);
  if (!sessionOk) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const conn = databaseUrl();
  if (!conn) {
    res.status(500).json({ error: 'database_not_configured' });
    return;
  }

  const sql = neon(conn);
  await ensureDashboardColumns(sql);

  const allRows = await getCachedRows(sql, shouldRefreshCache(req));
  const filters = parseFilters(req);
  const filteredRows = applyFilters(allRows, filters);

  res.status(200).json(buildPayload(allRows, filteredRows, filters));
}
