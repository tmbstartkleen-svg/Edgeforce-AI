/**
 * Stage 3 player-prop identity reconciliation for supplied event/team rosters.
 * Matching a player's name is only a proposed join, NOT a verified sportsbook
 * identity. Team context, event, market/line and ambiguity are recorded.
 * No provider calls, writes or unverifiable player IDs are generated.
 */
export type AthleteDirectoryEntry={
 athleteId:string;displayName:string;teamId:string;eventId:string;
 sport:string;league:string;aliases?:string[];
};
export type ProvisionalProp={
 eventId:string;sport:string;league:string;athleteName:string;
 marketType:string;outcomeId:string;americanOdds:number;
 observedAt:string;startsAt:string;line:string;teamId?:string;
};
const str=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0;
const normalize=(x:string)=>x.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,' ').trim();
const id=(x:{eventId:string;sport:string;league:string})=>JSON.stringify(
 [normalize(x.eventId),normalize(x.sport),normalize(x.league)]);
const validId=(x:string)=>/^[a-z0-9][a-z0-9:_-]{1,127}$/i.test(x)&&!x.toLowerCase().startsWith('name:');
export function reconcilePlayerProps(
 props:ProvisionalProp[],directory:AthleteDirectoryEntry[],now=Date.now()
){
 if(!Array.isArray(props)||props.length>5000||!Array.isArray(directory)||
   directory.length>20000||!Number.isFinite(now))throw Error('INVALID_PROP_IDENTITY_BATCH');
 const athletes=new Map<string,AthleteDirectoryEntry[]>();
 const issues:Record<string,number>={};
 const issue=(key:string)=>{issues[key]=(issues[key]||0)+1;};
 for(const a of directory){
  if(!a||![a.athleteId,a.displayName,a.teamId,a.eventId,a.sport,a.league].every(str)||
    !validId(a.athleteId)|| (a.aliases!==undefined&&
     (!Array.isArray(a.aliases)||a.aliases.length>15||!a.aliases.every(str)))){
   issue('INVALID_ATHLETE');continue;
  }
  const k=id(a);
  athletes.set(k,[...(athletes.get(k)||[]),a]);
 }
 const candidates:Array<{eventId:string;marketType:string;athleteName:string;
  proposedAthleteId:string;teamId:string;line:string;outcomeId:string;
  americanOdds:number;status:'ROSTER_MATCH_UNVERIFIED'}>=[];
 const unresolved:Array<{eventId:string;marketType:string;athleteName:string;reason:string}>=[];
 for(const p of props){
  if(!p||![p.eventId,p.sport,p.league,p.athleteName,p.marketType,p.outcomeId,p.line].every(str)||
    !p.marketType.startsWith('player_')||!Number.isSafeInteger(p.americanOdds)||
    Math.abs(p.americanOdds)<100||Math.abs(p.americanOdds)>100000||
    (p.teamId!==undefined&&!str(p.teamId))){
   issue('INVALID_PLAYER_PROP');continue;
  }
  const observed=Date.parse(p.observedAt),starts=Date.parse(p.startsAt);
  if(!Number.isFinite(observed)||observed>now||now-observed>15*60*1000||
    !Number.isFinite(starts)||starts<=now){
   issue('STALE_OR_STARTED_PROP');continue;
  }
  const name=normalize(p.athleteName);
  const matches=(athletes.get(id(p))||[]).filter(a=>
   (!p.teamId||normalize(p.teamId)===normalize(a.teamId))&&
   [a.displayName,...(a.aliases||[])].some(n=>normalize(n)===name));
  const unique=new Map(matches.map(a=>[a.athleteId.toLowerCase(),a]));
  if(unique.size!==1){
   const reason=unique.size?'AMBIGUOUS_ATHLETE':'ATHLETE_NOT_FOUND';
   issue(reason);unresolved.push({eventId:p.eventId,marketType:p.marketType,
    athleteName:p.athleteName,reason});continue;
  }
  const athlete=[...unique.values()][0];
  candidates.push({eventId:p.eventId,marketType:p.marketType,
   athleteName:p.athleteName,proposedAthleteId:athlete.athleteId,
   teamId:athlete.teamId,line:p.line,outcomeId:p.outcomeId,
   americanOdds:p.americanOdds,status:'ROSTER_MATCH_UNVERIFIED'});
 }
 return {mode:'PROVISIONAL_PLAYER_IDENTITY_RECONCILIATION' as const,
  examinedProps:props.length,rosterEntries:directory.length,
  candidateCount:candidates.length,unresolvedCount:unresolved.length,
  candidates,unresolved,issues,
  rosterSourceAuthenticated:false,identityJoinCertified:false,
  pricedPropsCertified:0,releaseCertified:false,
  warning:'Even a unique roster name match is not a trusted player ID until independently verified against the bookmaker/provider identifiers and roster provenance.'};
}
