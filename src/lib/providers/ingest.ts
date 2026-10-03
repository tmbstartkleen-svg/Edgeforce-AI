import {fetchNormalizedOdds} from './odds';
import {saveMarketSnapshots,saveConsensusMarketSnapshots} from '../persistence';
import {latestStoredMarkets} from '../persistence';
import {demoMarkets} from '../demo';
import type {Market} from '../types';

export type IngestOddsOptions={
 forceLive?:boolean;
 storedReuseMaxAgeMin?:number;
};

function adaptiveStoredReuseAge(markets:Market[]){
 const override=Number(process.env.ODDS_REUSE_MAX_AGE_MIN);
 if(Number.isFinite(override)&&override>0)return override;
 const now=Date.now();
 const future=markets.map(x=>new Date(x.startTime).getTime()).filter(x=>Number.isFinite(x)&&x>=now);
 if(!future.length)return 360;
 const nearest=(Math.min(...future)-now)/60000;
 if(nearest<=60)return 60;
 if(nearest<=180)return 120;
 if(nearest<=720)return 240;
 return 360;
}

export async function ingestOdds(options:IngestOddsOptions={}){
 const stored=await latestStoredMarkets().catch(()=>[]);
 const reuseAge=options.storedReuseMaxAgeMin??adaptiveStoredReuseAge(stored);
 const reusableStored=stored.filter(x=>x.sourceAgeMin<=reuseAge);

 if(!options.forceLive&&reusableStored.length){
  return {
   mode:'stored' as const,
   providerId:'stored-live-snapshot',
   providerName:'Stored Live Snapshot',
   markets:reusableStored,
   panelMarkets:[] as Market[],
   rawCount:reusableStored.length,
   warnings:[`Reused ${reusableStored.length} persisted live market snapshots no older than ${reuseAge} minutes to protect provider quota`],
   attempts:[],
   quality:undefined,
   error:undefined,
   degraded:false,
   targetBook:process.env.TARGET_BOOKMAKER||'DraftKings',
   providerPanel:[],
   source:'stored' as const,
   reuseAgeMin:reuseAge
  };
 }

 const live=await fetchNormalizedOdds();
 if(live.mode==='live'&&live.markets.length){
  await Promise.all([
   saveMarketSnapshots(live.markets,live.providerId||'consensus-panel',live.targetBook||'DraftKings').catch(()=>undefined),
   saveConsensusMarketSnapshots(live.markets,live.panelMarkets||[]).catch(()=>undefined)
  ]);
  return {...live,source:'live' as const,reuseAgeMin:reuseAge};
 }

 const maxStoredAge=Math.max(1,Number(process.env.ODDS_STORED_MAX_AGE_MIN||90));
 const usableStored=stored.filter(x=>x.sourceAgeMin<=maxStoredAge);
 if(usableStored.length){
  return {
   ...live,
   source:'stored' as const,
   markets:usableStored,
   degraded:true,
   reuseAgeMin:reuseAge,
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
   reuseAgeMin:reuseAge,
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
  reuseAgeMin:reuseAge,
  warnings:[...live.warnings,stored.length?'Stored odds were too stale; demo data shown':'No live or stored odds available; demo data shown']
 };
}
