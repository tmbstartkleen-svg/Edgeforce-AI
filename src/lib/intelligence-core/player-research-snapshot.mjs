import { auditPlayerIntelligence } from './player-intelligence-evidence.mjs';
import { reviewPlayerStreakEvidence } from './player-streak-evidence.mjs';

/**
 * Read-only interface between sourced player game logs and the research board.
 * Does not fetch or place wagers. Only the requested athlete and event IDs qualify.
 * Upstream adapters must supply verified completed rows with stats, source URLs and observedAt.
 */
export function buildPlayerResearchSnapshot({
  playerId, sport, games, stat, threshold, asOf, providerId = 'espn',
  maxReportAgeMs = 86400000,
} = {}) {
  if (!sport || typeof sport !== 'string' || !Array.isArray(games) ||
      !Number.isFinite(maxReportAgeMs) || maxReportAgeMs < 0) {
    throw new TypeError('INVALID_RESEARCH_SNAPSHOT');
  }
  const now = Date.parse(asOf ?? '');
  if (!Number.isFinite(now)) throw new TypeError('INVALID_RESEARCH_AS_OF');
  const observations = games.map(g => ({
    kind: 'player-stat', providerId, upstreamId: g?.upstreamId,
    eventId: g?.eventId, athleteId: g?.playerId, observedAt: g?.observedAt,
  }));
  const audit = auditPlayerIntelligence(observations, { now, maxAgeMs: maxReportAgeMs });
  const auditReady = new Set();
  for (const g of games) {
    const observedAt = Date.parse(g?.observedAt ?? '');
    if (g?.playerId !== playerId || !g?.upstreamId || !g?.eventId ||
        !Number.isFinite(observedAt) || observedAt > now ||
        now - observedAt > maxReportAgeMs) continue;
    auditReady.add(g);
  }
  const streak = reviewPlayerStreakEvidence({
    playerId, stat, threshold, asOf, source: providerId,
    games: games.filter(g => auditReady.has(g)),
  });
  const reasons = [];
  if (audit.accepted !== games.length) reasons.push('INCOMPLETE_SOURCE_AUDIT');
  if (streak.acceptedCount < 5) reasons.push('INSUFFICIENT_VERIFIED_GAME_LOG');
  if (streak.rejectedCount > 0) reasons.push('INVALID_GAME_LOG_ROWS');
  return {
    sport, playerId, providerId, asOf, stat, threshold,
    status: reasons.length ? 'RESEARCH_INCOMPLETE' : 'HISTORICAL_RESEARCH_ONLY',
    reasons, audit, streak,
    modelProbability: null, expectedRoi: null,
    approvedForBetting: false, slipUrl: null,
  };
}
