import type {ScheduleGame} from './gameSchedule';

/** A prior published, timestamped, read-only sportsbook quote. NEVER an executable offer. */
export type StoredGameQuote={
 home:string;away:string;sport:string;startTime:string;selection:string;market:string;
 odds:number;bookmaker:string;sourceTimestamp:string;ageMinutes:number;liveEligible?:boolean;
};
export type GameQuoteState='MATCHED'|'NOT_FOUND'|'STALE_ONLY'|'MATCH_UNVERIFIED';
const leagueAliases:Record<string,string>={
 nfl:'NFL',ncaaf:'NCAAF',ncaafb:'NCAAF','college football':'NCAAF',
 'ncaa football':'NCAAF',fbs:'NCAAF',fcs:'NCAAF',
 nba:'NBA',wnba:'WNBA',ncaab:'NCAAB','ncaa basketball':'NCAAB',
 'college basketball':'NCAAB',ncaaw:'NCAAW',mlb:'MLB',nhl:'NHL',
 mls:'MLS',epl:'EPL','english premier league':'EPL','premier league':'EPL',
 laliga:'LaLiga','la liga':'LaLiga',bundesliga:'Bundesliga','serie a':'Serie A',
 'ligue 1':'Ligue 1',ucl:'UCL','champions league':'UCL',ufc:'UFC'
};
export function strictLeagueMatch(a:string,b:string){
 const normalize=(x:string)=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const x=normalize(a),y=normalize(b);
 return Boolean(x&&y&&(leagueAliases[x]||x)===(leagueAliases[y]||y));
}

export function normalizeTeam(value:string){
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function teamMatch(a:string,b:string){
 const left=normalizeTeam(a),right=normalizeTeam(b);
 if(!left||!right)return false;
 if(left===right)return true;
 // Reject tiny ambiguous aliases (e.g. "LA", "US", "St").
 const short=left.length<right.length?left:right, long=left.length<right.length?right:left;
 return short.length>=7&&(long.startsWith(short+' ')||long.endsWith(' '+short));
}
function namesMatch(game:ScheduleGame,quote:StoredGameQuote){
 const direct=teamMatch(game.home,quote.home)&&teamMatch(game.away,quote.away);
 const cross=teamMatch(game.home,quote.away)||teamMatch(game.away,quote.home);
 return direct&&!cross;
}
function side(name:string,game:ScheduleGame){
 const home=teamMatch(name,game.home),away=teamMatch(name,game.away);
 return home&&!away?'HOME':away&&!home?'AWAY':null;
}
export function verifiedGameQuote(
 game:ScheduleGame,q:StoredGameQuote,now=Date.now()
):null|{selection:string;market:'h2h'|'spreads'|'totals';odds:number;bookmaker:string;origin:'stored';ageMinutes:number}{
 if(game.state!=='pre'||!strictLeagueMatch(game.sport,q.sport)||!namesMatch(game,q))return null;
 if(!Number.isFinite(q.odds)||!Number.isInteger(q.odds)||Math.abs(q.odds)<100||Math.abs(q.odds)>100000)return null;
 const start=Date.parse(q.startTime),gameStart=Date.parse(game.startTime),observed=Date.parse(q.sourceTimestamp);
 if(![start,gameStart,observed].every(Number.isFinite)||Math.abs(start-gameStart)>8*60000||
  start<=now||observed>now+60000||observed<now-10*60000||
  !Number.isFinite(q.ageMinutes)||q.ageMinutes<0||q.ageMinutes>10)return null;
 if(!q.bookmaker?.trim()||['unknown','provider'].includes(q.bookmaker.toLowerCase()))return null;
 // A known delayed/non-executable source remains informative only, never a trade approval.
 const market=q.market.toLowerCase();
 const selection=q.selection.trim();
 if(market==='h2h'||market==='moneyline'||market==='ml'){
  const matched=side(selection,game);
  if(!matched)return null;
  return {selection:matched==='HOME'?game.home:game.away,market:'h2h',odds:q.odds,bookmaker:q.bookmaker,origin:'stored',ageMinutes:q.ageMinutes};
 }
 if(market==='spreads'||market==='spread'){
  const match=selection.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)$/);
  if(!match||!side(match[1],game)||Math.abs(Number(match[2]))>100)return null;
  const chosen=side(match[1],game)==='HOME'?game.home:game.away;
  const line=Number(match[2]);
  return {selection:chosen+' '+(line>0?'+':'')+line,market:'spreads',odds:q.odds,bookmaker:q.bookmaker,origin:'stored',ageMinutes:q.ageMinutes};
 }
 if(market==='totals'||market==='total'){
  const match=selection.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)$/i);
  if(!match||Number(match[2])>600)return null;
  return {selection:(match[1].toLowerCase()==='over'?'Over ':'Under ')+Number(match[2]),market:'totals',odds:q.odds,bookmaker:q.bookmaker,origin:'stored',ageMinutes:q.ageMinutes};
 }
 return null;
}
export function enrichSchedulePrices(
 game:ScheduleGame,stored:StoredGameQuote[],now=Date.now()
){
 const related=stored.filter(q=>strictLeagueMatch(game.sport,q.sport)&&namesMatch(game,q)&&
  Number.isFinite(Date.parse(q.startTime))&&Math.abs(Date.parse(q.startTime)-Date.parse(game.startTime))<=8*60000);
 const valid=related.map(x=>verifiedGameQuote(game,x,now)).filter((x):x is NonNullable<typeof x>=>x!==null);
 const existing=game.quotes.filter(q=>Number.isInteger(q.odds)&&Math.abs(q.odds)>=100);
 const combined=new Map<string,(typeof valid)[number] | (typeof existing)[number]>();
 // Source-specific records are kept distinct, never treated as independent execution venues.
 for(const quote of existing)combined.set([quote.bookmaker,quote.market,quote.selection].join('|').toLowerCase(),quote);
 for(const quote of valid){const key=[quote.bookmaker,quote.market,quote.selection].join('|').toLowerCase();if(!combined.has(key))combined.set(key,quote)}
 return {...game,quotes:[...combined.values()].slice(0,32),
  extraQuoteCount:valid.length,
  quoteCoverage:combined.size?'MATCHED':related.length?'STALE_ONLY':'NOT_FOUND'} as const;
}
