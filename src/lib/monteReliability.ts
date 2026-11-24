import { summarizeCalibration, type CalibrationPoint } from './calibration';

export type ReliabilityBin = {
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number | null;
  observedRate: number | null;
  absoluteGap: number | null;
};

export type ReliabilityReport = {
  sampleSize: number;
  brierScore: number | null;
  logLoss: number | null;
  expectedCalibrationError: number | null;
  maximumCalibrationError: number | null;
  bins: ReliabilityBin[];
  warnings: string[];
};

export type ChronologicalCalibrationPoint = CalibrationPoint & {
  gameId: string;
  modelTrainedThrough: string;
  forecastAt: string;
  settledAt: string;
};

export type ChronologicalReliabilityReport = ReliabilityReport & {
  status: 'blocked' | 'review_required';
  reasons: string[];
  distinctGames: number;
  chronologicalPoints: number;
};

/**
 * Diagnostic-only reliability report. Never fit or evaluate a calibrator
 * using the same outcomes; use chronological out-of-sample evaluation.
 */
export function buildReliabilityReport(points: CalibrationPoint[], binCount = 10): ReliabilityReport {
  if (!Number.isInteger(binCount) || binCount < 2 || binCount > 100) {
    throw new RangeError('binCount must be an integer between 2 and 100');
  }
  for (const point of points) {
    if (!Number.isFinite(point.predicted) || point.predicted < 0 || point.predicted > 1 ||
        (point.outcome !== 0 && point.outcome !== 1)) {
      throw new RangeError('Predictions must be finite probabilities in [0,1] and outcomes must be 0 or 1');
    }
  }
  const bins = Array.from({ length: binCount }, (_, i) => {
    const selected = points.filter(p => Math.min(binCount - 1, Math.floor(p.predicted * binCount)) === i);
    const count = selected.length;
    const meanPredicted = count ? selected.reduce((s, p) => s + p.predicted, 0) / count : null;
    const observedRate = count ? selected.reduce((s, p) => s + p.outcome, 0) / count : null;
    return {
      lower: i / binCount,
      upper: (i + 1) / binCount,
      count,
      meanPredicted,
      observedRate,
      absoluteGap: meanPredicted === null || observedRate === null ? null : Math.abs(meanPredicted - observedRate)
    };
  });
  const summary = points.length ? summarizeCalibration(points) : null;
  const ece = points.length ? bins.reduce((sum, b) => sum + b.count / points.length * (b.absoluteGap ?? 0), 0) : null;
  const maxError = points.length ? Math.max(...bins.map(b => b.absoluteGap ?? 0)) : null;
  const warnings: string[] = [];
  if (!points.length) warnings.push('No settled predictions: calibration is unavailable.');
  if (points.length > 0 && points.length < 200) warnings.push('Small sample: reliability estimates are unstable.');
  if (bins.some(b => b.count > 0 && b.count < 20)) warnings.push('Some occupied bins have fewer than 20 observations.');
  warnings.push('Monte Carlo confidence intervals reflect simulation sampling error, not model calibration or input uncertainty.');
  return {
    sampleSize: points.length,
    brierScore: summary?.brierScore ?? null,
    logLoss: summary?.logLoss ?? null,
    expectedCalibrationError: ece,
    maximumCalibrationError: maxError,
    bins,
    warnings
  };
}

/**
 * Fail-closed chronological evidence gate for Monte reliability.
 * Every evaluated prediction must have been generated after the model's
 * training cutoff and before the outcome settled. Passing this gate still
 * requires human review; it never authorizes wagering or live execution.
 */
export function buildChronologicalReliabilityReport(
  points: ChronologicalCalibrationPoint[],
  options: { binCount?: number; minimumSample?: number; minimumDistinctGames?: number } = {}
): ChronologicalReliabilityReport {
  const binCount = options.binCount ?? 10;
  const minimumSample = options.minimumSample ?? 200;
  const minimumDistinctGames = options.minimumDistinctGames ?? 50;
  if (!Number.isInteger(minimumSample) || minimumSample < 50 ||
      !Number.isInteger(minimumDistinctGames) || minimumDistinctGames < 20) {
    throw new RangeError('Chronological reliability thresholds are invalid');
  }

  const reasons: string[] = [];
  const valid: CalibrationPoint[] = [];
  const games = new Set<string>();

  for (const point of points) {
    if (!point.gameId || !point.gameId.trim()) {
      reasons.push('missing_game_identity');
      continue;
    }
    const trained = Date.parse(point.modelTrainedThrough);
    const forecast = Date.parse(point.forecastAt);
    const settled = Date.parse(point.settledAt);
    if (![trained, forecast, settled].every(Number.isFinite)) {
      reasons.push('invalid_chronology_timestamp');
      continue;
    }
    if (!(trained < forecast && forecast < settled)) {
      reasons.push('chronology_or_leakage_violation');
      continue;
    }
    if (!Number.isFinite(point.predicted) || point.predicted < 0 || point.predicted > 1 ||
        (point.outcome !== 0 && point.outcome !== 1)) {
      reasons.push('invalid_probability_or_outcome');
      continue;
    }
    valid.push({ predicted: point.predicted, outcome: point.outcome });
    games.add(point.gameId.trim());
  }

  if (valid.length !== points.length) reasons.push('invalid_chronological_rows');
  if (valid.length < minimumSample) reasons.push('insufficient_out_of_sample_predictions');
  if (games.size < minimumDistinctGames) reasons.push('insufficient_distinct_games');

  const report = buildReliabilityReport(valid, binCount);
  return {
    ...report,
    status: reasons.length ? 'blocked' : 'review_required',
    reasons: [...new Set(reasons)],
    distinctGames: games.size,
    chronologicalPoints: valid.length
  };
}
