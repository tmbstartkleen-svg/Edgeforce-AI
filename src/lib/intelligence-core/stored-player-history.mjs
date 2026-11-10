/**
 * Read-only bridge from the existing /api/player/:id history response.
 * Provenance is not inferred from a source label. Incomplete rows remain visible
 * to the evidence gate but cannot be accepted as trusted game-log records.
 */
export function normalizeStoredPlayerHistory(payload, playerId) {
 if (!payload || typeof payload !== 'object' || !Array.isArray(payload.history)) {
  throw new TypeError('INVALID_PLAYER_HISTORY_RESPONSE');
 }
 if (payload.source !== 'database') {
  return { status: 'NO_VERIFIED_DATABASE_HISTORY', rows: [], warnings: ['DEMO_DATA_NOT_ELIGIBLE'] };
 }
 const rows = payload.history.slice(0, 50).map((raw) => {
  const item = raw && typeof raw === 'object' ? raw : {};
  const stats = item.stats && typeof item.stats === 'object' && !Array.isArray(item.stats)
   ? Object.fromEntries(Object.entries(item.stats).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)))
   : {};
  const eventId = String(item.event_id ?? '').trim();
  const date = typeof item.stat_date === 'string' ? item.stat_date : item.stat_date ?? null;
  return {
   playerId, eventId, upstreamId: typeof item.source === 'string' ? item.source : '',
   date, completed: item.completed === true, stats,
   // The old schema does not certify when the row was first observed, or its URL.
   observedAt: typeof item.observed_at === 'string' ? item.observed_at : null,
   sourceUrl: typeof item.source_url === 'string' ? item.source_url : null,
  };
 });
 const ready = rows.filter(r=>r.completed && r.observedAt && r.sourceUrl).length;
 return { status: ready ? 'PROVENANCE_REVIEW_REQUIRED' : 'MISSING_PROVENANCE',
  rows, warnings: ready < rows.length ? ['SOME_ROWS_MISSING_VERIFIED_COMPLETION_AND_PROVENANCE'] : [] };
}
