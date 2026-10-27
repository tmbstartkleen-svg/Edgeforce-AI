import { getCoverage, getCoverageEvents } from '../backend/coverage';
const leagues = ['E0','SP1','D1','I1','F1'];
const seasons = ['2122','2223','2324','2425','2526','2627'];
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({error:'Method not allowed'},405);
    try {
      if (path === '/api/monitoring' || path === '/api/_healthcheck') return json({ok:true,checkedAt:new Date().toISOString(),release:'free-monitoring-v1',paidOddsEnabled:env.PAID_ODDS_ENABLED !== 'false',archiveWritesEnabled:env.D1_SPORTS_MARKET_ARCHIVE_ENABLED !== 'false',scheduledExecutionEnabled:env.ATLAS_SCHEDULE_EXECUTION_ENABLED !== 'false',billingVerified:false,storage:'Browser IndexedDB; no cloud database',learning:'On use, at most daily per league in this browser; five soccer leagues only',quota:'Account-wide Worker usage unavailable; requests can stop at the free quota. Static assets are served separately.'});
      if (path === '/api/live-state') return json({version:0,generatedAt:new Date().toISOString(),researchArchiveError:null,mode:'odds',events:[],quotes:[],feed:{fetchedAt:null,nextCheckAt:null,remaining:null,problem:'Automatic sportsbook collection is disabled in free mode. Use International coverage for public Kalshi and Polymarket snapshots.',refreshMessage:'No odds credits consumed.',manualRefreshesRemaining:0},coverage:{horizonDays:7,scheduledEvents:0,pricedEvents:0,simulationReadySelections:0},readiness:{prices:false,playerModels:false,injuries:false,weather:false,simulations:false}});
      if (path === '/api/research/current') return json({day:url.searchParams.get('day'),rows:[],settlement:'Sports archive writes disabled. No unsettled observations are used for learning.'});
      const q = url.searchParams;
      if (!['/api/coverage','/api/coverage/events','/api/research/csv'].includes(path)) return json({error:'Not found'},404);
      let canonical = path;
      if (path === '/api/research/csv') {
        if (!leagues.includes(q.get('league') || '') || !seasons.includes(q.get('season') || '')) return json({error:'Unsupported league or season'},400);
        canonical += `?league=${q.get('league')}&season=${q.get('season')}`;
      } else if (path.endsWith('/events')) canonical += '?' + new URLSearchParams({provider:q.get('provider')||'',id:q.get('id')||'',cursor:q.get('cursor')||''});
      const cache = (caches as any).default;
      const key = new Request(url.origin + canonical);
      const saved = await cache.match(key); if (saved) return saved;
      let data: any, ttl = 60;
      if (path === '/api/coverage') { data = {sources:await getCoverage()}; ttl = 900; }
      else if (path.endsWith('/events')) data = await getCoverageEvents(q.get('provider')||'',q.get('id')||'',q.get('cursor')||'');
      else {
        const r = await fetch(`https://www.football-data.co.uk/mmz4281/${q.get('season')}/${q.get('league')}.csv`,{signal:AbortSignal.timeout(18000)});
        if (!r.ok) return json({error:`Historical source unavailable (${r.status})`},502);
        const csv = await r.text();
        if (csv.length > 1500000 || !csv.includes('HomeTeam,AwayTeam')) return json({error:'Historical file failed validation'},502);
        data = {csv}; ttl = 86400;
      }
      if (data.error || data.sources?.some((s:any) => s.error)) ttl = 30;
      const response = Response.json(data,{headers:{'Cache-Control':`public, max-age=${ttl}`,'X-Content-Type-Options':'nosniff'}});
      ctx.waitUntil(cache.put(key,response.clone())); return response;
    } catch { return json({error:'Source request failed; retry later. No substitute prices were generated.'},502); }
  }
};
