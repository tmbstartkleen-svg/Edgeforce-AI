/**
 * Normalize stored player-game records into the strict streak evidence format.
 * Does NOT fetch upstream data, infer game completion, or certify source authenticity.
 */
const finalStatuses = new Set(['final', 'finished', 'completed', 'post']);
const safeString = x => typeof x === 'string' ? x.trim() : '';
const record = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};

function safeSourceUrl(value, source) {
  if (typeof value !== 'string' || value.length > 600) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (source.startsWith('espn') && !['www.espn.com', 'espn.com', 'site.api.espn.com', 'site.web.api.espn.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeStoredPlayerGames(rows, playerId) {
  if (!Array.isArray(rows) || rows.length > 150 || typeof playerId !== 'string' || !playerId.trim())
    throw new TypeError('INVALID_STORED_PLAYER_GAMES');

  const games = [];
  const omitted = [];
  for (const row of rows) {
    const eventId = safeString(row?.eventId ?? row?.event_id);
    const source = safeString(row?.source).toLowerCase();
    const raw = record(row?.raw);
    const stats = record(row?.stats);
    const eventStatus = safeString(row?.eventStatus ?? row?.event_status).toLowerCase();
    const explicitFinal = raw.completed === true && (!eventStatus || finalStatuses.has(eventStatus));
    const completed = finalStatuses.has(eventStatus) || explicitFinal;
    const dateValue = row?.statDate ?? row?.stat_date;
    const parsed = Date.parse(dateValue instanceof Date ? dateValue.toISOString() : String(dateValue ?? ''));
    const date = Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    const storedAthleteId = safeString(row?.athleteId ?? row?.athlete_id);
    const rawAthleteId = safeString(raw.playerId ?? raw.player_id ?? raw.athleteId ?? raw.athlete_id);
    let sourceUrl = safeSourceUrl(raw.sourceUrl ?? raw.source_url, source);
    let sourceLinkType = sourceUrl ? 'ARCHIVED_SOURCE_LINK' : null;
    // A constructed ESPN event page is a reference, not independent proof
    // that the archived player stat itself was collected from that URL.
    if (!sourceUrl && source === 'espn-public-gamelog' && /^\d{6,14}$/.test(eventId)) {
      sourceUrl = 'https://www.espn.com/boxscore/_/gameId/' + eventId;
      sourceLinkType = 'CONSTRUCTED_EVENT_REFERENCE';
    }
    const reasons = [];
    if (!eventId || !date) reasons.push('MISSING_EVENT_OR_DATE');
    if (storedAthleteId !== playerId || (rawAthleteId && rawAthleteId !== playerId)) reasons.push('PLAYER_ID_MISMATCH');
    if (!completed) reasons.push('FINAL_STATUS_UNVERIFIED');
    if (!source || !sourceUrl) reasons.push('SOURCE_REFERENCE_MISSING');
    if (!Object.keys(stats).length) reasons.push('MISSING_STATS');
    if (reasons.length) {
      omitted.push({eventId:eventId || null,reasons});
      continue;
    }
    games.push({eventId,playerId,date,completed:true,stats,sourceUrl,source,
      sourceLinkType,completionEvidence:finalStatuses.has(eventStatus)?'EVENT_FINAL_STATUS':'ARCHIVED_COMPLETED_FLAG'});
  }
  return {games,omitted,archivedRows:rows.length,sourceAuthenticated:false};
}
