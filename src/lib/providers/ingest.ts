import {fetchNormalizedOdds} from './odds';
import {saveMarketSnapshots,saveConsensusMarketSnapshots} from '../persistence';
import {latestStoredMarkets} from '../persistence';
import {demoMarkets} from '../demo';

export async function ingestOdds(){
 const live=await fetchNormalizedOdds();
 if(live.mode==='live'&&live.markets.length){
  await Promise.all([
   saveMarketSnapshots(live.markets,live.providerId||'consensus-panel',live.targetBook||'DraftKings').catch(()=>undefined),
   saveConsensusMarketSnapshots(live.markets,live.panelMarkets||[]).catch(()=>undefined)
  ]);
  return {...live,source:'live' as const};
 }
 const stored=await latestStoredMarkets().catch(()=>[]);
 const maxStoredAge=Math.max(1,Number(process.env.ODDS_STORED_MAX_AGE_MIN||90));
 const usableStored=stored.filter(x=>x.sourceAgeMin<=maxStoredAge);
 if(usableStored.length){
  return {
   ...live,
   source:'stored' as const,
   markets:usableStored,
   degraded:true,
   warnings:[...live.warnings,`Live odds unavailable; using stored markets no older than ${maxStoredAge} minutes`]
  };
 }
 const production=(process.env.DEPLOYMENT_ENV==='production'||process.env.VERCEL_ENV==='production');
 const allowDemo=process.env.ALLOW_DEMO_DATA==='true'||!production;
 if(!allowDemo){
  return {
   ...live,
   source:'unavailable' as const,
   markets:[] as typeof live.markets,
   degraded:true,
   warnings:[...live.warnings,stored.length
    ?'Stored odds were too stale; production demo fallback is disabled'
    :'No live or fresh stored odds are available; production demo fallback is disabled']
  };
 }
 return {
  ...live,
  source:'demo' as const,
  markets:demoMarkets,
  degraded:true,
  warnings:[...live.warnings,stored.length?'Stored odds were too stale; demo data shown':'No live or stored odds available; demo data shown']
 };
}
