import {getSchedule} from '../backend/schedule';
import { playerUpdates, PLAYER_LEAGUES } from '../backend/player-updates';
export { FreeOdds } from './odds';
import { getCoverage, getCoverageEvents } from '../backend/coverage';
const leagues = ['E0','SP1','D1','I1','F1'];
const seasons = ['2122','2223','2324','2425','2526','2627'];
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (['/api/live-state','/api/live-state/refresh','/api/sports','/api/odds-budget'].includes(path)) {
      if (!env.FREE_ODDS) return json({error:'Free odds service not configured'},503);
      let sport=url.searchParams.get('sport')||'';
      if(path.endsWith('/refresh')) {
        if(request.method!=='POST')return json({error:'Use POST'},405);
        if(request.headers.get('Origin') && request.headers.get('Origin')!==url.origin)return json({error:'Origin not allowed'},403);
        const body=await request.text();if(body.length>1000)return json({error:'Request too large'},413);
        try { sport=JSON.parse(body||'{}').sport||''; }catch{return json({error:'Invalid request'},400);}
      } else if(request.method!=='GET')return json({error:'Method not allowed'},405);
      if(typeof sport!=='string'||(sport&&!/^[a-z0-9_]{1,100}$/.test(sport)))return json({error:'Invalid league'},400);
      const operation=path.endsWith('/refresh')?'refresh':path==='/api/sports'?'sports':path==='/api/odds-budget'?'budget':'state';
      try { return await env.FREE_ODDS.get(env.FREE_ODDS.idFromName('shared-free-budget-v1')).fetch(new Request('https://odds/'+operation+'?'+new URLSearchParams({sport}))); } catch { return json({error:'Free odds service unavailable; cached source must be rechecked'},502); }
    }
    if (request.method !== 'GET') return json({error:'Method not allowed'},405);
    try {
      if(path==='/api/schedule')return json(await getSchedule(url.origin,ctx));
      if(path==='/api/player-updates'){const league=url.searchParams.get('league')||'nba',team=url.searchParams.get('team')||'';if(!Object.hasOwn(PLAYER_LEAGUES,league)||(team&&!/^\d{1,9}$/.test(team)))return json({error:'Unsupported league or team'},400);return json(await playerUpdates(league,team,url.origin,ctx));}
      if (path === '/api/monitoring' || path === '/api/_healthcheck') return json({ok:true,checkedAt:new Date().toISOString(),release:'free-odds-v2',freeOddsEnabled:env.FREE_ODDS_ENABLED==='true',paidOddsEnabled:env.PAID_ODDS_ENABLED !== 'false',archiveWritesEnabled:env.D1_SPORTS_MARKET_ARCHIVE_ENABLED !== 'false',scheduledExecutionEnabled:env.ATLAS_SCHEDULE_EXECUTION_ENABLED !== 'false',billingVerified:false,storage:'Browser research; shared latest-odds cache and credit counter',learning:'On use, at most daily per league in this browser; five soccer leagues only',quota:'Account-wide Worker usage unavailable; requests can stop at the free quota. Static assets are served separately.'});
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
