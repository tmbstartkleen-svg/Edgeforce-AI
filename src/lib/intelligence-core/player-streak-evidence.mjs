import { analyzePlayerStatStreak } from './player-streak-research.mjs';

/**
 * A fail-closed evidence gate around game-log streak analysis.
 * Inputs are independently obtained game logs; this module performs no HTTP requests.
 * No inferred athlete matching, forecast probability or live-bet recommendation.
 */
export function reviewPlayerStreakEvidence({
  playerId, games, stat, threshold, asOf, source = 'ESPN',
} = {}) {
  if (typeof playerId !== 'string' || !playerId.trim() ||
      !Array.isArray(games) || typeof asOf !== 'string' ||
      !Number.isFinite(Date.parse(asOf))) {
    throw new TypeError('INVALID_PLAYER_EVIDENCE_INPUT');
  }

  const cutoff = Date.parse(asOf);
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  for (const game of games) {
    const id = typeof game?.eventId === 'string' ? game.eventId.trim() : '';
    let reason = null;
    const date = Date.parse(game?.date ?? '');
    if (!id || !Number.isFinite(date)) reason = 'UNIDENTIFIED_OR_UNDATED';
    else if (game?.playerId !== playerId) reason = 'PLAYER_MISMATCH';
    else if (game?.completed !== true) reason = 'NOT_COMPLETED';
    else if (date > cutoff) reason = 'AFTER_AS_OF';
    else if (typeof game?.sourceUrl !== 'string' || !/^https:\/\//i.test(game.sourceUrl)) reason = 'MISSING_SOURCE';
    else if (seen.has(id)) reason = 'DUPLICATE_EVENT';
    else if (!game?.stats || typeof game.stats[stat] !== 'number' ||
             !Number.isFinite(game.stats[stat]) || game.stats[stat] < 0) reason = 'MISSING_STAT';
    if (reason) {
      rejected.push({ eventId: id || null, reason });
      continue;
    }
    seen.add(id);
    accepted.push(game);
  }

  const result = analyzePlayerStatStreak({ games: accepted, stat, threshold, source, asOf });
  const status = result.last5.complete ? 'OBSERVED_HISTORY_ONLY' : 'INSUFFICIENT_HISTORY';
  return {
    playerId, status, asOf, source,
    acceptedCount: accepted.length, rejectedCount: rejected.length,
    rejected, ...result,
    // Historical frequency is NOT an independent calibrated model forecast.
    modelProbability: null,
    executableSelection: false,
  };
}
