import type {Market} from './types';
// @ts-expect-error TS5097: Node 22 strip-types runtime requires the explicit .ts extension.
import {runCorrelatedGameSimulation, type JointSimulationResult} from './correlatedGameSimulation.ts';

/**
 * Explicit, read-only bridge from an EdgeForce game selection to Monte.
 * Does not derive factor loadings from sportsbook prices or historical streaks.
 * Every input must be a separately verified model forecast with a declared loading.
 */
export type GameResearchSelection = {
  sport: 'NBA' | 'CBB' | 'NFL' | 'CFB';
  eventId: string;
  modelVersion: string;
  seed: number;
  trials: 500000 | 1000000;
  forecasts: Array<{
    market: Market;
    modelGeneratedAt: string;
    injuryCheckedAt: string;
    rosterCheckedAt: string;
    calibrationStatus: 'VALIDATED' | 'UNCALIBRATED';
    factorLoading: number | null;
    injurySource?: string;
    rosterSource?: string;
    calibrationEvidenceId?: string;
  }>;
};

export type GameResearchResponse =
  | {status: 'BLOCKED'; reasons: string[]; eventId: string}
  | {status: 'RESEARCH_ONLY'; eventId: string; result: JointSimulationResult; warnings: string[]};

const validTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export function runSelectedGameResearch(input: GameResearchSelection): GameResearchResponse {
  const reasons: string[] = [];
  if (!['NBA','CBB','NFL','CFB'].includes(input.sport)) reasons.push('UNSUPPORTED_SPORT');
  if (typeof input.eventId !== 'string' || !input.eventId.trim() || typeof input.modelVersion !== 'string' || !input.modelVersion.trim()) reasons.push('MISSING_EVENT_OR_MODEL');
  if (!Array.isArray(input.forecasts) || input.forecasts.length < 1 || input.forecasts.length > 20) {
    reasons.push('INVALID_FORECAST_COUNT');
  }
  if (!Number.isSafeInteger(input.seed) || input.seed === 0 || ![500000, 1000000].includes(input.trials)) reasons.push('INVALID_SIMULATION_CONFIGURATION');
  const ids = new Set<string>();
  const gameStarts = new Set<number>();
  const gameTeams = new Set<string>();
  for (const f of Array.isArray(input.forecasts) ? input.forecasts : []) {
    if (!f || typeof f !== 'object') { reasons.push('INVALID_FORECAST'); continue; }
    const m = f.market;
    if (!m || typeof m.id !== 'string' || !m.id.trim() || ids.has(m.id)) { reasons.push('INVALID_MARKET_ID'); continue; }
    ids.add(m.id);
    if (typeof m.sport !== 'string' || m.sport.toUpperCase() !== input.sport) reasons.push('SPORT_MISMATCH');
    if (m.sourceEventId !== input.eventId) reasons.push('EVENT_ID_MISMATCH');
    if (typeof m.home !== 'string' || !m.home.trim() || typeof m.away !== 'string' || !m.away.trim()) {
      reasons.push('MISSING_GAME_TEAMS');
    } else {
      const teams = [m.home.trim().toLowerCase(),m.away.trim().toLowerCase()];
      if (teams[0] === teams[1]) reasons.push('INVALID_GAME_TEAMS');
      gameTeams.add(teams.sort().join('|'));
    }
    if (!Number.isFinite(m.modelProb) || m.modelProb <= 0 || m.modelProb >= 1) reasons.push('INVALID_MODEL_PROBABILITY');
    if (f.factorLoading === null || !Number.isFinite(f.factorLoading) || Math.abs(f.factorLoading) > 1) reasons.push('MISSING_VERIFIED_CORRELATION');
    const generated = validTime(f.modelGeneratedAt);
    const injury = validTime(f.injuryCheckedAt);
    const roster = validTime(f.rosterCheckedAt);
    const start = validTime(m.startTime);
    if (start !== null) gameStarts.add(start);
    if (generated === null || injury === null || roster === null || start === null) reasons.push('MISSING_TIMESTAMPS');
    else {
      if (generated > start || injury > generated || roster > generated) reasons.push('INVALID_PREGAME_EVIDENCE_ORDER');
      const hour = 3600000;
      if (start - generated > 48 * hour || generated - injury > 24 * hour || generated - roster > 24 * hour) {
        reasons.push('STALE_PREGAME_EVIDENCE');
      }
    }
    if (f.calibrationStatus !== 'VALIDATED') reasons.push('UNCALIBRATED_MODEL');
    if (typeof f.injurySource !== 'string' || !f.injurySource.trim() || typeof f.rosterSource !== 'string' || !f.rosterSource.trim()) reasons.push('MISSING_SOURCE_PROVENANCE');
    if (typeof f.calibrationEvidenceId !== 'string' || !f.calibrationEvidenceId.trim()) reasons.push('MISSING_CALIBRATION_EVIDENCE');
  }
  if (gameStarts.size > 1) reasons.push('INCONSISTENT_EVENT_START');
  if (gameTeams.size > 1) reasons.push('INCONSISTENT_EVENT_TEAMS');
  if (reasons.length) return {status:'BLOCKED', eventId:input.eventId, reasons:[...new Set(reasons)]};
  const result = runCorrelatedGameSimulation({
    eventId:input.eventId, modelVersion:input.modelVersion, seed:input.seed, trials:input.trials,
    markets:input.forecasts.map(f => ({
      id:f.market.id, probability:f.market.modelProb, factorLoading:f.factorLoading as number
    }))
  });
  return {
    status:'RESEARCH_ONLY', eventId:input.eventId, result,
    warnings:['CALIBRATION_AND_SOURCE_ASSERTIONS_NOT_INDEPENDENTLY_VERIFIED','NOT_A_WAGERING_SIGNAL']
  };
}
