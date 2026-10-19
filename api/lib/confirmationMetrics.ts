export const UNKNOWN_HOSPITAL_LABEL = 'Hospital sin dato';

export type ConfirmationDeltaInput = {
  hospital: string | null;
  burnPercentage: number;
  actualBurnPercentage: number | null;
  confirmedAt: string | null;
};

export type ConfirmationDeltaStats = {
  confirmedCount: number;
  avgDeltaTotal: number;
  meanAbsoluteDeviation: number;
};

export type HospitalConfirmationStats = ConfirmationDeltaStats & {
  hospital: string;
};

export type ConfirmationSummary = ConfirmationDeltaStats & {
  confirmationRate: number;
  byHospital: HospitalConfirmationStats[];
};

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isConfirmed<T extends ConfirmationDeltaInput>(row: T): row is T & { actualBurnPercentage: number; confirmedAt: string } {
  return row.confirmedAt !== null && row.actualBurnPercentage !== null;
}

/** Confirmed burn % minus estimated burn %, in percentage points. */
export function confirmationDelta(row: { burnPercentage: number; actualBurnPercentage: number }): number {
  return row.actualBurnPercentage - row.burnPercentage;
}

function hospitalLabel(hospital: string | null): string {
  const trimmed = hospital?.trim();
  return trimmed ? trimmed : UNKNOWN_HOSPITAL_LABEL;
}

function deltaStats(deltas: number[]): ConfirmationDeltaStats {
  if (deltas.length === 0) {
    return { confirmedCount: 0, avgDeltaTotal: 0, meanAbsoluteDeviation: 0 };
  }
  const signed = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  const absolute = deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length;
  return {
    confirmedCount: deltas.length,
    avgDeltaTotal: roundTo(signed, 2),
    meanAbsoluteDeviation: roundTo(absolute, 2),
  };
}

export function buildConfirmationSummary(rows: ConfirmationDeltaInput[]): ConfirmationSummary {
  const confirmed = rows.filter(isConfirmed);
  const byHospitalDeltas = new Map<string, number[]>();
  confirmed.forEach((row) => {
    const label = hospitalLabel(row.hospital);
    byHospitalDeltas.set(label, [...(byHospitalDeltas.get(label) || []), confirmationDelta(row)]);
  });

  const byHospital = [...byHospitalDeltas.entries()]
    .map(([hospital, deltas]) => ({ hospital, ...deltaStats(deltas) }))
    .sort((a, b) => b.confirmedCount - a.confirmedCount || a.hospital.localeCompare(b.hospital));

  return {
    ...deltaStats(confirmed.map(confirmationDelta)),
    confirmationRate: rows.length > 0 ? roundTo((confirmed.length / rows.length) * 100, 1) : 0,
    byHospital,
  };
}
