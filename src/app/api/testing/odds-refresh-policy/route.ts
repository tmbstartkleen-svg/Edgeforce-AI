import {adaptiveOddsPolicy} from '@/lib/providers/oddsRefreshPolicy';

export const dynamic='force-dynamic';

export async function GET(){
 const active=[
  {key:'americanfootball_nfl',title:'NFL',active:true},
  {key:'americanfootball_ncaaf',title:'NCAAF',active:true},
  {key:'baseball_mlb',title:'MLB',active:true},
  {key:'basketball_nba',title:'NBA',active:true},
  {key:'icehockey_nhl',title:'NHL',active:true},
  {key:'mma_mixed_martial_arts',title:'MMA',active:true},
  {key:'soccer_usa_mls',title:'MLS',active:true},
  {key:'tennis_atp_tokyo',title:'ATP Tokyo',active:true},
  {key:'cricket_test_match',title:'Test Match',active:true}
 ];

 const expanded=adaptiveOddsPolicy({
  remaining:497,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(['tennis_atp_tokyo']),
  activeSports:active,nearestStartMinutes:900,expansionMarkets:'h2h'
 });
 const urgent=adaptiveOddsPolicy({
  remaining:497,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(),
  activeSports:active,nearestStartMinutes:30,expansionMarkets:'h2h'
 });
 const rotated=adaptiveOddsPolicy({
  remaining:497,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(['tennis_atp_tokyo']),
  activeSports:active,nearestStartMinutes:900,expansionMarkets:'h2h',rotationOffset:3
 });
 const conserve=adaptiveOddsPolicy({
  remaining:55,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(),
  activeSports:active,nearestStartMinutes:900,expansionMarkets:'h2h'
 });
 const reserve=adaptiveOddsPolicy({
  remaining:40,reserve:25,configuredMaxSports:8,alreadyCovered:new Set(),
  activeSports:active,nearestStartMinutes:900,expansionMarkets:'h2h'
 });

 const ok=
  expanded.mode==='EXPANDED' &&
  expanded.selectedSports[0]==='americanfootball_nfl' &&
  expanded.selectedSports.length<=8 &&
  expanded.estimatedMaxCost<=11 &&
  rotated.selectedSports.join(',')!==expanded.selectedSports.join(',') &&
  urgent.refreshMinutes===60 &&
  urgent.selectedSports.length<=3 &&
  conserve.mode==='CONSERVE' &&
  conserve.selectedSports.length<=2 &&
  reserve.mode==='BOOTSTRAP_ONLY' &&
  reserve.selectedSports.length===0;

 return Response.json({ok,expanded,rotated,urgent,conserve,reserve},{headers:{'Cache-Control':'no-store'}});
}
