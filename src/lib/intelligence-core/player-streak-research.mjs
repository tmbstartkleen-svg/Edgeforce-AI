/**
 * Verified game-log streak arithmetic for Edgeforce research views.
 *
 * Only caller-verified, completed, dated game appearances may enter this
 * calculation. This utility never fetches ESPN or estimates missing stats.
 * Rows must already be resolved to the correct athlete and stat key.
 */
export function analyzePlayerStatStreak({games, stat, threshold, source = 'ESPN', asOf = null} = {}) {
  if (!Array.isArray(games) || !stat || typeof stat !== 'string' ||
      !Number.isFinite(threshold) || threshold < 0) {
    throw new TypeError('INVALID_STREAK_INPUT');
  }
  const warnings = [];
  const seen = new Set();
  const eligible = [];
  for (const game of games) {
    if (!game || typeof game !== 'object' || game.completed !== true) continue;
    const id = String(game.eventId ?? '').trim();
    const timestamp = Date.parse(game.date ?? '');
    if (!id || !Number.isFinite(timestamp)) {
      warnings.push('UNIDENTIFIED_OR_UNDATED_GAME_EXCLUDED');
      continue;
    }
    if (seen.has(id)) {
      warnings.push('DUPLICATE_GAME_EXCLUDED');
      continue;
    }
    seen.add(id);
    const raw = game.stats?.[stat];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      // A missing stat must NOT be interpreted as zero or a missed threshold.
      warnings.push('MISSING_STAT_EXCLUDED:' + id);
      continue;
    }
    eligible.push({eventId:id,date:new Date(timestamp).toISOString(),value:raw,
      opponent:game.opponent ?? null,sourceUrl:game.sourceUrl ?? null});
  }
  eligible.sort((a,b)=>b.date.localeCompare(a.date) || a.eventId.localeCompare(b.eventId));
  const sample = eligible.slice(0,10);
  const window = size => {
    const rows = sample.slice(0,size);
    return {requested:size,observed:rows.length,hits:rows.filter(r=>r.value>=threshold).length,
      hitRate:rows.length===size ? rows.filter(r=>r.value>=threshold).length/size : null,
      complete:rows.length===size,values:rows.map(r=>r.value)};
  };
  let consecutive=0;
  for (const row of eligible) { if(row.value>=threshold) consecutive++; else break; }
  if (eligible.length<10) warnings.push('FEWER_THAN_TEN_VERIFIED_GAMES');
  const total=eligible.reduce((sum,r)=>sum+r.value,0);
  return {stat,threshold,source,asOf,last5:window(5),last10:window(10),
    consecutive,verifiedGames:eligible.length,
    observedSampleAverage:eligible.length?total/eligible.length:null,
    // Not a season average, not a forecast, and not a modeled probability.
    seasonAverage:null,modelProbability:null,
    games:sample,warnings:[...new Set(warnings)]};
}
