import { buildHistory, LEAGUES, SEASONS, RESEARCH_VERSION, ResearchGame } from './research';
export type History = { league: string; season: string; games: ResearchGame[]; importedAt: string | null; source: string; version: string };
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('edgeline-free-learning', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('history', { keyPath: 'key' });
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error('Browser storage unavailable'));
  });
}
export async function histories(): Promise<History[]> {
  const d = await database();
  try { return await new Promise((resolve, reject) => { const r = d.transaction('history').objectStore('history').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  finally { d.close(); }
}
async function save(data: History) {
  const d = await database();
  try { await new Promise<void>((resolve, reject) => { const t = d.transaction('history', 'readwrite'); t.objectStore('history').put({ ...data, key: `${data.league}:${data.season}` }); t.oncomplete = () => resolve(); t.onerror = () => reject(new Error('Could not save learning data')); t.onabort = () => reject(new Error('Learning storage aborted')); }); }
  finally { d.close(); }
  window.dispatchEvent(new Event('edgeline-learning'));
}
async function network(path: string) {
  const r = await fetch(path, { signal: AbortSignal.timeout(25000) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
const pending = new Map<string, Promise<History>>();
async function history(league: string, season: string, update: boolean): Promise<History> {
  if (!Object.hasOwn(LEAGUES, league) || !SEASONS.includes(season)) throw new Error('Unsupported league or season');
  const key = `${league}:${season}`;
  const old = (await histories()).find(x => x.league === league && x.season === season && x.version === RESEARCH_VERSION);
  const empty: History = { league, season, games: [], importedAt: null, source: `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`, version: RESEARCH_VERSION };
  if (!update || (old?.importedAt && Date.now() - Date.parse(old.importedAt) < 86400000)) return old || empty;
  if (pending.has(key)) return pending.get(key)!;
  const job = (async () => {
    const { csv } = await network(`/api/research/csv?league=${league}&season=${season}`);
    // Forecasts for each day use ONLY results from earlier dates (buildHistory).
    const games = buildHistory(csv, league, season);
    if (!games.length || games.length > 800) throw new Error('No usable completed results or unexpected file size');
    const data = { ...empty, games, importedAt: new Date().toISOString() };
    await save(data); return data;
  })();
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}
export const api = {
  async get(path: string): Promise<{data: any}> {
    const u = new URL(path, window.location.origin);
    if (u.pathname === '/api/research/history') return {data: await history(u.searchParams.get('league') || '', u.searchParams.get('season') || '', false)};
    return { data: await network(path) };
  },
  async post(path: string, body?: any): Promise<{data: any}> {
    if (path === '/api/research/import') return {data: await history(body.league, body.season, true)};
    if (path === '/api/live-state/refresh') {
      const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(30000)});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Refresh failed');return {data};
    }
    throw new Error('Unsupported action');
  }
};
export async function updateLearning(progress: (text: string) => void) {
  const failures: string[] = [];
  for (const league of Object.keys(LEAGUES)) {
    progress(`Checking completed results: ${LEAGUES[league]}`);
    try { await history(league, '2627', true); } catch(e) { failures.push(`${league}: ${e instanceof Error ? e.message : 'Unavailable'}`); }
  }
  progress(failures.length ? failures.join(' · ') : 'Current-season results checked. Earlier-only forecasts recalculated; no live model promotion.');
}
