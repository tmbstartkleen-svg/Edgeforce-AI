import {fetchV22Odds} from './v22Odds';
import {saveMarketSnapshots,latestStoredMarkets} from '../persistence';
import {demoMarkets} from '../demo';
import {assessFeedIntegrity} from '../feedIntegrity';

export async function ingestOdds(){
 const live=await fetchV22Odds();
 if(live.mode==='live'&&live.markets.length){
  const assessed=assessFeedIntegrity(live.markets,'live',live.mode,live.validation);
  if(assessed.markets.length){
   await saveMarketSnapshots(assessed.markets,live.providerId||'authorized-provider','DraftKings').catch(()=>undefined);
  }
  if(assessed.integrity.officialEligible){
   return {...live,source:'live' as const,markets:assessed.markets,integrity:assessed.integrity};
  }
 }

 const stored=await latestStoredMarkets().catch(()=>[]);
 if(stored.length){
  const assessed=assessFeedIntegrity(stored,'stored','fallback');
  if(assessed.markets.length){
   return {...live,source:'stored' as const,mode:'failed' as const,markets:assessed.markets,integrity:assessed.integrity};
  }
 }

 const assessedDemo=assessFeedIntegrity(demoMarkets,'demo','fallback');
 return {...live,source:'demo' as const,mode:'failed' as const,markets:assessedDemo.markets,integrity:assessedDemo.integrity};
}
