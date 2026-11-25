export type ActiveSport={key:string;group?:string;title?:string;active?:boolean;has_outrights?:boolean};

export type AdaptiveOddsPolicy={
 mode:'BOOTSTRAP_ONLY'|'CONSERVE'|'BALANCED'|'EXPANDED';
 reserve:number;
 remaining?:number;
 maxExpansionSports:number;
 selectedSports:string[];
 expansionMarkets:string;
 estimatedMaxCost:number;
 refreshMinutes:number;
 reasons:string[];
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const lower=(s:string|undefined)=>String(s||'').toLowerCase();
const uniqueCsv=(value:string|undefined)=>[...new Set(String(value||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))];

/** Conservative /odds cost: requested markets times regions, or groups of ten explicit books.
 * Bookmakers take precedence over regions. https://the-odds-api.com/liveapi/guides/v4/
 */
export function estimateOddsRequestCost(input:{markets?:string;regions?:string;bookmakers?:string}):number{
 const markets=Math.max(1,uniqueCsv(input.markets).length);
 const books=uniqueCsv(input.bookmakers).length;
 const regions=books?Math.ceil(books/10):Math.max(1,uniqueCsv(input.regions).length);
 return markets*regions;
}

function sportScore(s:ActiveSport){
 const key=lower(s.key),title=lower(s.title),group=lower(s.group);
 const exact:Record<string,number>={
  americanfootball_nfl:1000,
  americanfootball_ncaaf:990,
  baseball_mlb:980,
  basketball_nba:970,
  basketball_ncaab:960,
  basketball_wnba:950,
  icehockey_nhl:940,
  mma_mixed_martial_arts:930,
  soccer_usa_mls:920
 };
 if(exact[s.key])return exact[s.key];
 if(key.startsWith('tennis_'))return 900;
 if(key.startsWith('soccer_'))return 860;
 if(key.startsWith('basketball_'))return 820;
 if(key.startsWith('baseball_'))return 800;
 if(key.startsWith('icehockey_'))return 780;
 if(group.includes('football')||title.includes('football'))return 760;
 if(group.includes('rugby'))return 600;
 if(group.includes('cricket'))return 560;
 return 300;
}

export function chooseExpansionSports(
 sports:ActiveSport[],
 alreadyCovered:Set<string>,
 limit:number,
 rotationOffset=0
){
 const eligible=sports
  .filter(x=>x.active!==false&&!x.has_outrights&&!alreadyCovered.has(x.key))
  .sort((a,b)=>sportScore(b)-sportScore(a)||a.key.localeCompare(b.key));
 const target=Math.max(0,limit);
 if(target===0)return [];

 const coreCount=Math.min(eligible.length,Math.max(1,Math.ceil(target*.65)));
 const core=eligible.slice(0,coreCount);
 const tail=eligible.slice(coreCount);
 const rotateCount=Math.max(0,target-core.length);
 const rotated:ActiveSport[]=[];
 if(tail.length&&rotateCount){
  const offset=((rotationOffset%tail.length)+tail.length)%tail.length;
  for(let i=0;i<Math.min(rotateCount,tail.length);i++)rotated.push(tail[(offset+i)%tail.length]);
 }
 return [...core,...rotated].slice(0,target).map(x=>x.key);
}

export function adaptiveOddsPolicy(input:{
 remaining?:number;
 reserve:number;
 configuredMaxSports:number;
 alreadyCovered:Set<string>;
 activeSports:ActiveSport[];
 nearestStartMinutes?:number;
 expansionMarkets?:string;
 bootstrapMarkets?:string;
 regions?:string;
 bookmakers?:string;
 rotationOffset?:number;
}):AdaptiveOddsPolicy{
 const {remaining,reserve,configuredMaxSports,alreadyCovered,activeSports}=input;
 const headroom=typeof remaining==='number'&&Number.isSafeInteger(remaining)&&remaining>=0?remaining-reserve:undefined;
 const expansionMarkets=input.expansionMarkets||'h2h';
 const marketCost=estimateOddsRequestCost({markets:expansionMarkets,regions:input.regions,bookmakers:input.bookmakers});

 let mode:AdaptiveOddsPolicy['mode']='BALANCED';
 let maxExpansionSports=Math.max(0,configuredMaxSports);
 const reasons:string[]=[];

 if(remaining===undefined||!Number.isSafeInteger(remaining)||remaining<0){
  mode='BOOTSTRAP_ONLY';maxExpansionSports=0;reasons.push('remaining quota is unverified; paid expansion is disabled');
 }else if(headroom!==undefined&&headroom<=20){
  mode='BOOTSTRAP_ONLY';maxExpansionSports=0;reasons.push('quota headroom is near the configured reserve');
 }else if(headroom!==undefined&&headroom<75){
  mode='CONSERVE';maxExpansionSports=Math.min(maxExpansionSports,2);reasons.push('quota headroom is low');
 }else if(headroom!==undefined&&headroom<200){
  mode='BALANCED';maxExpansionSports=Math.min(maxExpansionSports,4);reasons.push('quota headroom is moderate');
 }else{
  mode='EXPANDED';maxExpansionSports=Math.min(maxExpansionSports,8);reasons.push('quota headroom supports wider coverage');
 }

 const nearest=input.nearestStartMinutes;
 let refreshMinutes=360;
 if(nearest!==undefined&&Number.isFinite(nearest)){
  if(nearest<=60){
   refreshMinutes=60;
   maxExpansionSports=Math.min(maxExpansionSports,3);
   reasons.push('an event begins within 60 minutes; refresh faster with a narrower expansion set');
  }else if(nearest<=180){
   refreshMinutes=120;
   maxExpansionSports=Math.min(maxExpansionSports,4);
   reasons.push('an event begins within 3 hours; refresh faster with controlled expansion');
  }else if(nearest<=720){
   refreshMinutes=240;
   maxExpansionSports=Math.min(maxExpansionSports,6);
   reasons.push('events are active within 12 hours');
  }else reasons.push('no immediate event-start pressure');
 }
 if(mode==='CONSERVE')refreshMinutes=Math.max(refreshMinutes,360);
 if(mode==='BOOTSTRAP_ONLY')refreshMinutes=Math.max(refreshMinutes,720);

 if(headroom!==undefined)maxExpansionSports=Math.min(maxExpansionSports,Math.max(0,Math.floor(headroom/marketCost)));

 const selectedSports=chooseExpansionSports(activeSports,alreadyCovered,maxExpansionSports,input.rotationOffset||0);
 return {
  mode,reserve,remaining,
  maxExpansionSports,
  selectedSports,
  expansionMarkets,
  estimatedMaxCost:estimateOddsRequestCost({markets:input.bootstrapMarkets||'h2h,spreads,totals',regions:input.regions,bookmakers:input.bookmakers})+selectedSports.length*marketCost,
  refreshMinutes:clamp(refreshMinutes,60,720),
  reasons
 };
}
