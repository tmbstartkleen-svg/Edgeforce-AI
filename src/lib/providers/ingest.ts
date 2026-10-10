import {fetchNormalizedOdds} from './odds';
import {saveMarketSnapshots,saveConsensusMarketSnapshots} from '../persistence';
import {latestStoredMarkets} from '../persistence';
import {demoMarkets} from '../demo';
import type {Market} from '../types';

async function withDeadline<T>(promise:Promise<T>,ms:number,label:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   promise,
   new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms)})
  ]);
 }finally{
  if(timer)clearTimeout(timer);
 }
}

export type IngestOddsOptions={
 forceLive?:boolean;
 storedReuseMaxAgeMin?:number;
};

function adaptiveLiveRefreshMs(){
 const override=Number(process.env.ODDS_LIVE_REFRESH_MS);
 if(Number.isFinite(override)&&override>=1000)return override;
 const fastGeneric=Boolean(process.env.ODDS_PROVIDER_PRIMARY_URL||process.env.ODDS_PROVIDER_SECONDARY_URL||process.env.ODDS_PROVIDER_TERTIARY_URL);
 if(fastGeneric)return 15000;
 if(process.env.SPORTS_GAME_ODDS_API_KEY){
  const n=Number(process.env.SPORTS_GAME_ODDS_CACHE_MS||300000);
  return Math.max(60000,Number.isFinite(n)?n:300000);
 }
 if(process.env.THE_ODDS_API_KEY){
  const n=Number(process.env.THE_ODDS_API_CACHE_MS||600000);
  return Math.max(60000,Number.isFinite(n)?n:600000);
 }
 return 60000;
}

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
 const stored=await withDeadline(
  latestStoredMarkets(),
  Math.max(1000,Number(process.env.ODDS_STORED_READ_TIMEOUT_MS||1500)),
  'stored odds read'
 ).catch(()=>[]);
 const reuseAge=options.storedReuseMaxAgeMin??adaptiveStoredReuseAge(stored);
 const reusableStored=stored.filter(x=>x.sourceAgeMin<=reuseAge);
 const liveRefreshMs=adaptiveLiveRefreshMs();
 const freshestStoredAgeMs=stored.length
  ?Math.max(0,Math.min(...stored.map(x=>Number(x.sourceAgeMin)||0))*60000)
  :Number.POSITIVE_INFINITY;

 if(!options.forceLive&&reusableStored.length&&freshestStoredAgeMs<liveRefreshMs){
  return {
   mode:'stored' as const,
   providerId:'stored-live-snapshot',
   providerName:'Stored Live Snapshot',
   markets:reusableStored,
   panelMarkets:[] as Market[],
   rawCount:reusableStored.length,
   warnings:[`Reused ${reusableStored.length} persisted real market snapshots while the adaptive ${Math.round(liveRefreshMs/1000)}s provider refresh window is still fresh`],
   attempts:[],
   quality:undefined,
   error:undefined,
   degraded:false,
   targetBook:process.env.TARGET_BOOKMAKER||'DraftKings',
   providerPanel:[],
   source:'stored' as const,
   reuseAgeMin:reuseAge,
   liveRefreshMs,
   nextLiveRefreshMs:Math.max(0,liveRefreshMs-freshestStoredAgeMs)
  };
 }

 const live=await fetchNormalizedOdds();
 if(live.mode==='live'&&live.markets.length){
  await Promise.all([
   withDeadline(
    saveMarketSnapshots(live.markets,live.providerId||'consensus-panel',live.targetBook||'DraftKings'),
    1500,
    'market snapshot write'
   ).catch(()=>undefined),
   withDeadline(
    saveConsensusMarketSnapshots(live.markets,live.panelMarkets||[]),
    1500,
    'consensus snapshot write'
   ).catch(()=>undefined)
  ]);
  return {...live,source:'live' as const,reuseAgeMin:reuseAge,liveRefreshMs,nextLiveRefreshMs:liveRefreshMs};
 }

 const maxStoredAge=Math.max(1,Number(process.env.ODDS_STORED_MAX_AGE_MIN||360));
 const usableStored=stored.filter(x=>x.sourceAgeMin<=maxStoredAge);
 if(usableStored.length){
  return {
   ...live,
   source:'stored' as const,
   markets:usableStored,
   degraded:true,
   reuseAgeMin:reuseAge,
   liveRefreshMs,
   nextLiveRefreshMs:Math.max(0,liveRefreshMs-freshestStoredAgeMs),
   warnings:[...live.warnings,`Live odds unavailable; using stored markets no older than ${maxStoredAge} minutes`]
  };
 }
 const production=(process.env.DEPLOYMENT_ENV==='production'||process.env.VERCEL_ENV==='production');
 const allowDemo=process.env.ALLOW_DEMO_DATA==='true'||(!production&&process.env.ALLOW_DEMO_DATA!=='false');
 if(!allowDemo){
  return {
   ...live,
   source:'unavailable' as const,
   markets:[] as typeof live.markets,
   degraded:true,
   reuseAgeMin:reuseAge,
   liveRefreshMs,
   nextLiveRefreshMs:Math.max(0,liveRefreshMs-freshestStoredAgeMs),
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
  liveRefreshMs,
  nextLiveRefreshMs:Math.max(0,liveRefreshMs-freshestStoredAgeMs),
  warnings:[...live.warnings,stored.length?'Stored odds were too stale; demo data shown':'No live or stored odds available; demo data shown']
 };
}
