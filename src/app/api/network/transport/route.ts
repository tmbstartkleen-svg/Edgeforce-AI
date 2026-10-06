import {configuredProviders} from '@/lib/providers/config';
import {fetchLiveScoreMesh} from '@/lib/liveScoreMesh';
import {fetchFanDuelOddsPulse} from '@/lib/providers/fanLineWire';

export const dynamic='force-dynamic';

export async function GET(){
 const [scores,pulse]=await Promise.all([
  fetchLiveScoreMesh().catch(()=>null),
  fetchFanDuelOddsPulse().catch(()=>null)
 ]);
 const providers=configuredProviders('ODDS').map(p=>({
  id:p.id,
  name:p.name,
  bookmaker:p.bookmaker,
  priority:p.priority,
  maxAgeMin:p.maxAgeMin,
  keyConfigured:Boolean(p.apiKey),
  transport:p.url.startsWith('sports-game-odds://')?'native-adapter':p.url.startsWith('the-odds-api://')?'native-adapter':'generic-http'
 }));
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  providerRequestCoalescing:true,
  oddsPanelCacheMs:Math.max(1000,Number(process.env.ODDS_PANEL_CACHE_MS||5000)),
  configuredOddsProviders:providers,
  liveScores:scores?{
   liveGames:scores.liveGames,
   refreshMs:scores.refreshMs,
   sourceMode:scores.sourceMode,
   sources:scores.sources,
   transport:scores.transport
  }:null,
  fanDuelPulse:pulse?{
   ok:pulse.ok,
   fresh:pulse.fresh,
   latencyMs:pulse.latencyMs,
   ageMs:pulse.ageMs,
   liveTotal:pulse.liveTotal,
   sequence:pulse.sequence
  }:null
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
