import type {Market} from './types';
import type {ArbitrageOpportunity, PositiveEvOpportunity} from './edgeScanner';

export const TEAM_AGENTS = [
 {id:'scout',name:'Scout',specialty:'All-sport and league coverage'},
 {id:'lines',name:'Lines',specialty:'Sharp books and provisional +EV'},
 {id:'props',name:'Props',specialty:'Player markets and statistics gaps'},
 {id:'arb',name:'Arb',specialty:'Matched-market arbitrage'},
 {id:'audit',name:'Audit',specialty:'Freshness, source integrity, and model scrutiny'},
 {id:'captain',name:'Captain',specialty:'Team coordination and your questions'}
] as const;

export type TeamAgentId = typeof TEAM_AGENTS[number]['id'];
export type TeamMessage = {
 agent:TeamAgentId;
 name:string;
 specialty:string;
 text:string;
 evidence:string[];
};
export type TeamResearchInput={
 question:string;
 markets:Market[];
 panelMarkets:Market[];
 source:string;
 degraded:boolean;
 providerName?:string;
 warnings:string[];
 opportunities:PositiveEvOpportunity[];
 arbitrage:ArbitrageOpportunity[];
 targetBook:string;
};
export type TeamResearchRound={
 messages:TeamMessage[];
 coverage:{sports:number;leagues:number;events:number;marketSelections:number;panelQuotes:number;bySport:Array<{sport:string;rows:number;leagues:number}>};
 evidenceState:'LIVE'|'STORED'|'DEMO'|'UNAVAILABLE';
 independentModelVerified:false;
 quoteFreshnessVerified:false;
 actionableBetRecommendations:false;
 questionForUser:string|null;
};

const STOP=new Set(['about','which','what','when','where','will','would','could','should','best','bet','bets','better','value','edge','edges','odds','probability','probabilities','tonight','today','tomorrow','games','game','match','matches','sports','sport','leagues','league','all','every','please','tell','show','give','the','and','for','from','with','have','does','this','these','those','research','analyze','analysis','percent','percentage','highest','lowest','winning','winner','win','play','moneyline','parlay','props','player','players','live','next','week','month']);
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function scopeTerms(question:string){
 return [...new Set(norm(question).split(/\s+/).filter(term=>term.length>=3&&!STOP.has(term)))].slice(0,12);
}
function matchTerms(haystack:string,terms:string[]){
 if(!terms.length)return true;
 const text=norm(haystack);
 return terms.some(term=>text.includes(term));
}
function label(offer:PositiveEvOpportunity){
 return `${offer.selection} (${offer.event}, ${offer.league}) at ${offer.book} ${offer.odds>0?'+':''}${offer.odds}; reference EV ${(offer.expectedValue*100).toFixed(1)}%, reference ${offer.reference}`;
}
function message(agent:TeamAgentId,text:string,evidence:string[]):TeamMessage{
 const persona=TEAM_AGENTS.find(x=>x.id===agent)!;
 return {agent,name:persona.name,specialty:persona.specialty,text,evidence};
}
function countCoverage(markets:Market[],panelMarkets:Market[]){
 const sportMap=new Map<string,{rows:number;leagues:Set<string>}>();
 const events=new Set<string>();
 const leagues=new Set<string>();
 for(const m of markets){
  const sport=m.sport||'Unknown';
  const entry=sportMap.get(sport)||{rows:0,leagues:new Set<string>()};
  entry.rows++;
  entry.leagues.add(m.league||'Unknown');
  sportMap.set(sport,entry);
  leagues.add(sport+'|'+m.league);
  events.add(sport+'|'+m.league+'|'+m.event+'|'+m.startTime);
 }
 return {
  sports:sportMap.size,leagues:leagues.size,events:events.size,
  marketSelections:markets.length,panelQuotes:panelMarkets.length,
  bySport:[...sportMap.entries()].map(([sport,entry])=>({sport,rows:entry.rows,leagues:entry.leagues.size})).sort((a,b)=>b.rows-a.rows||a.sport.localeCompare(b.sport))
 };
}
export function buildTeamResearch(input:TeamResearchInput):TeamResearchRound{
 const terms=scopeTerms(input.question);
 const scoped=input.markets.filter(m=>matchTerms([m.sport,m.league,m.event,m.home,m.away,m.selection,m.playerContext?.name||''].join(' '),terms));
 const proposals=input.opportunities.filter(x=>matchTerms([x.sport,x.league,x.event,x.selection].join(' '),terms));
 const arbs=input.arbitrage.filter(x=>matchTerms([x.sport,x.league,x.event].join(' '),terms));
 const coverage=countCoverage(input.markets,input.panelMarkets);
 const evidenceState=input.source==='live'?'LIVE':input.source==='stored'?'STORED':input.source==='demo'?'DEMO':'UNAVAILABLE';
 const scopedEvents=[...new Set(scoped.map(x=>x.event+' | '+x.league))];
 const bySport=coverage.bySport.slice(0,12).map(x=>`${x.sport}: ${x.rows} selections across ${x.leagues} leagues`).join('; ');
 const sharedEvidence=[`source=${input.source}`,`provider=${input.providerName||'unknown'}`,`targetBook=${input.targetBook}`];
 const messages:TeamMessage[]=[];
 messages.push(message('scout',
  `I checked the available feed, not a presumed DraftKings master schedule. It currently contains ${coverage.marketSelections} market selections across ${coverage.events} events, ${coverage.leagues} leagues and ${coverage.sports} sports. ${bySport||'No sports have usable data.'} ${terms.length?`For your search I matched ${scoped.length} selections across ${scopedEvents.length} events. `:' '} ${scopedEvents.length?`Examples: ${scopedEvents.slice(0,4).join('; ')}.`:'No matching events are in this feed.'}`,
  sharedEvidence));
 messages.push(message('lines',
  proposals.length
   ?`I found ${proposals.length} provisional cross-book pricing signals in the scanner's current comparison set. Top examples: ${[...proposals].sort((a,b)=>b.expectedValue-a.expectedValue).slice(0,3).map(label).join(' | ')}. These are market-derived reference estimates, NOT independently calibrated win probabilities or verified positive-EV bets.`
   :'No comparable provisional +EV signals matched the question. That can mean a missing quote panel or incomplete opposing prices; it is not proof that the events have no edge.',
  [`scannerQuotePanel=${input.panelMarkets.length}`,'independentModelVerified=false']));
 const props=scoped.filter(x=>Boolean(x.playerContext?.name)||/player|pitcher|batter|goalie/i.test(x.market));
 messages.push(message('props',
  `I found ${props.length} player-market selections in this scope. ${props.length?`Examples: ${props.slice(0,4).map(x=>`${x.selection} (${x.market})`).join('; ')}.`:'No sourced player props matched.'} Odds rows alone do not establish recent hit rates, projections, minutes or injury status; those require separate verified player-data coverage.`,
  [`playerMarketSelections=${props.length}`]));
 messages.push(message('arb',
  evidenceState==='LIVE'&&arbs.length
   ?`The live comparison set contains ${arbs.length} mathematically matched arbitrage candidates. Highest snapshot ROI: ${(Math.max(...arbs.map(x=>x.roi))*100).toFixed(2)}%. Quotes may move or be rejected; each leg, book eligibility, liquidity and bet limits must be rechecked manually before treating it as executable.`
   :`No currently executable arbitrage is verified here. Matched candidates: ${arbs.length}; source state: ${evidenceState}. Stored/demo quotes are never treated as executable arbitrage.`,
  [`matchedGroups=${arbs.length}`,`evidenceState=${evidenceState}`]));
 const oldestAge=scoped.length?Math.max(...scoped.map(x=>Number(x.sourceAgeMin)||0)):null;
 const problems=[
  evidenceState!=='LIVE'?`Feed status is ${evidenceState}, not verified live.`:'The feed reports live delivery but quote-level freshness is not independently certified.',
  input.degraded?'Provider is degraded.':null,
  oldestAge!==null&&oldestAge>10?`Some matching rows are ${oldestAge.toFixed(1)} minutes old.`:null,
  'Coverage can omit DraftKings markets, leagues or dates not licensed/supplied by the source.',
  'Reference-based EV cannot substitute for independently validated prediction probabilities.',
  ...input.warnings.slice(0,2)
 ].filter((x):x is string=>Boolean(x));
 messages.push(message('audit',problems.join(' '),[...sharedEvidence,`matchingRows=${scoped.length}`]));
 const questionForUser=terms.length&&!scoped.length
  ?'I could not match that event in the available feed. Which league, team, or event date should I check?'
  :!input.question.trim()
   ?'Which sport, game, player, or market should the team investigate?'
   :null;
 messages.push(message('captain',
  `Scout, Lines, Props, Arb and Audit have compared their findings. ${scoped.length?`We have ${scoped.length} relevant market selections to investigate further.`:'We do not have supported event-level evidence for this question in the current feed.'} I will not claim a guaranteed winner, verified edge, or recommend a stake from market-reference estimates. ${questionForUser||'Ask a follow-up about a particular matchup, player prop, source or comparison, and I will direct the specialists back to the evidence.'}`,
  ['shared specialist summaries','actionableBetRecommendations=false']));
 return {messages,coverage,evidenceState,independentModelVerified:false,quoteFreshnessVerified:false,actionableBetRecommendations:false,questionForUser};
}
