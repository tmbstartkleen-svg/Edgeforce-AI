import {fetchSportScoreBackup} from '@/lib/providers/sportScore';
import {previewTennisD1Batches} from '@/lib/intelligence-core/tennis-d1-event-preview.mjs';

export const dynamic='force-dynamic';

/** Read-only, explicitly unverified tennis observations from an existing provider.
 * No D1 writes and no odds or DraftKings-inventory inference.
 */
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 try{
  const feed=await fetchSportScoreBackup();
  if(!feed.enabled)return Response.json({ok:false,reason:'SPORTSCORE_DISABLED',source:'sportscore',
   sourceApprovedForMarketRanking:false,draftKingsInventoryCertified:false},{status:503,headers});
  const observedAt=new Date().toISOString();
  const tennis=feed.games.filter(g=>g.sport.toLowerCase()==='tennis');
  const records=tennis.filter(g=>typeof g.startTime==='string'&&!Number.isNaN(Date.parse(g.startTime))).map(g=>({
   id:g.id,tournament:g.league||'Tennis - tournament unknown',startTime:g.startTime as string
  }));
  const preview=previewTennisD1Batches(records,{source:'sportscore',observedAt});
  return Response.json({ok:true,source:'sportscore',observedAt,tennisObserved:tennis.length,
   eligibleForPreview:records.length,excludedMissingStartTime:tennis.length-records.length,
   batches:preview.batches,previewOnly:true,providerTimestampVerified:false,
   sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,
   draftKingsInventoryCertified:false,attribution:feed.attribution,
   warnings:feed.warnings??[]},{headers});
 }catch{
  return Response.json({ok:false,reason:'TENNIS_SOURCE_UNAVAILABLE',source:'sportscore',
   sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false},{status:503,headers});
 }
}
