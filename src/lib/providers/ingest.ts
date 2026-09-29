import {fetchNormalizedOdds} from './odds';
import {saveMarketSnapshots} from '../persistence';
import {latestStoredMarkets} from '../persistence';
import {demoMarkets} from '../demo';

export async function ingestOdds(){
 const live=await fetchNormalizedOdds();
 if(live.mode==='live'&&live.markets.length){
  await saveMarketSnapshots(live.markets,live.providerId||'authorized-provider','DraftKings').catch(()=>undefined);
  return {...live,source:'live' as const};
 }
 const stored=await latestStoredMarkets().catch(()=>[]);
 if(stored.length){
  return {...live,source:'stored' as const,markets:stored};
 }
 return {...live,source:'demo' as const,markets:demoMarkets};
}
