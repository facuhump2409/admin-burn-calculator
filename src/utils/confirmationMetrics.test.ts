import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_HOSPITAL_LABEL,
  buildConfirmationSummary,
  type ConfirmationDeltaInput,
} from '../../api/lib/confirmationMetrics';

function row(
  hospital: string | null,
  estimated: number,
  actual: number | null,
  confirmed = true,
): ConfirmationDeltaInput {
  return {
    hospital,
    burnPercentage: estimated,
    actualBurnPercentage: actual,
    confirmedAt: confirmed ? '2026-10-01T00:00:00.000Z' : null,
  };
}

describe('buildConfirmationSummary', () => {
  it('returns zeroed metrics when there are no confirmed cases', () => {
    const summary = buildConfirmationSummary([row('Garrahan', 10, null, false)]);
    expect(summary).toEqual({
      confirmedCount: 0,
      confirmationRate: 0,
      avgDeltaTotal: 0,
      meanAbsoluteDeviation: 0,
      byHospital: [],
    });
    expect(buildConfirmationSummary([]).confirmationRate).toBe(0);
  });

  it('keeps positive and negative deltas from canceling in the absolute deviation', () => {
    const summary = buildConfirmationSummary([row('Garrahan', 10, 15), row('Garrahan', 20, 15)]);
    expect(summary.avgDeltaTotal).toBe(0);
    expect(summary.meanAbsoluteDeviation).toBe(5);
    expect(summary.confirmedCount).toBe(2);
  });

  it('computes signed delta as confirmed minus estimated', () => {
    const summary = buildConfirmationSummary([row('Elizalde', 12.5, 10)]);
    expect(summary.avgDeltaTotal).toBe(-2.5);
    expect(summary.meanAbsoluteDeviation).toBe(2.5);
  });

  it('groups by hospital, labels unknown hospitals and ignores unconfirmed rows', () => {
    const summary = buildConfirmationSummary([
      row('Garrahan', 10, 12),
      row('Garrahan', 10, 6),
      row('Garrahan', 10, 30, false),
      row('Elizalde', 8, 9),
      row(null, 5, 2),
      row('  ', 5, 7),
    ]);

    expect(summary.confirmedCount).toBe(5);
    expect(summary.confirmationRate).toBe(83.3);
    expect(summary.avgDeltaTotal).toBe(-0.4);
    expect(summary.meanAbsoluteDeviation).toBe(2.4);
    expect(summary.byHospital).toEqual([
      { hospital: 'Garrahan', confirmedCount: 2, avgDeltaTotal: -1, meanAbsoluteDeviation: 3 },
      { hospital: UNKNOWN_HOSPITAL_LABEL, confirmedCount: 2, avgDeltaTotal: -0.5, meanAbsoluteDeviation: 2.5 },
      { hospital: 'Elizalde', confirmedCount: 1, avgDeltaTotal: 1, meanAbsoluteDeviation: 1 },
    ]);
  });
});
