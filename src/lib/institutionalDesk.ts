/**
 * V195 Institutional Edge Desk.
 * Deterministic, zero-request decision support based only on validated board evidence.
 * An entry window is conditional on quote freshness, uncertainty, venue and risk gates.
 * It is never an order-routing or guaranteed-return instruction.
 */
export type DeskMarket={
 id:string; sport:string; league:string; event:string; selection:string; market:string;
 startTime:string; odds:number; marketProb:number; simProbability:number;
 simCi:[number,number]; simulationRuns:number; dynamicConfidence:number;
 grade:'ELITE'|'STRONG'|'WATCH'|'PASS'; freshness:'FRESH'|'AGING'|'STALE';
 sourceAgeMin:number; sourceTimestamp?:string; sourceBook?:string;
 regime?:string; reliabilityMode?:string; reliabilityCriticalOpen?:boolean;
 intelligenceStackReady?:boolean;
 contextQuality?:{recommendationReady?:boolean;score?:number};
 bestExecutionVenue?:{
  venue:string;type:'SPORTSBOOK'|'PREDICTION_EXCHANGE';marketProbability:number;
  americanOdds?:number;expectedValue:number;feeAdjusted:boolean;
 };
 bestPredictionVenue?:{status?:string;volume?:number;liquidity?:number};
};

export type DeskWindow='TODAY'|'TOMORROW'|'LATER';
export type DeskStatus='ENTRY_WINDOW'|'MONITOR'|'PASS';
export type DeskDecision={
 id:string;sport:string;league:string;event:string;selection:string;market:string;
 startTime:string;window:DeskWindow;status:DeskStatus;score:number;
 venue:string;venueType:'SPORTSBOOK'|'PREDICTION_EXCHANGE';odds:number;
 fairProbability:number;marketProbability:number;conservativeProbability:number;
 edge:number;expectedValue:number;confidence:number;simulationRuns:number;
 entryPriceProbability:number;entryMinAmericanOdds:number;
 minutesToStart:number;reasons:string[];flags:string[];
};
export type InstitutionalDesk={
 generatedAt:string;boardHealthy:boolean;boardAgeSeconds:number|null;
 ready:number;monitor:number;passed:number;totalAnalyzed:number;
 today:DeskDecision[];tomorrow:DeskDecision[];later:DeskDecision[];
 methodology:string[];
};

const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));
function validProbability(p:number){return Number.isFinite(p)&&p>0&&p<1;}
function americanFromProbability(p:number){
 if(!validProbability(p))return 0;
 return Math.round(p>=.5?-100*p/(1-p):100*(1-p)/p);
}
function decimalOdds(odds:number){
 return odds>0?1+odds/100:1+100/Math.abs(odds);
}
function dayKey(value:Date,timeZone:string){
 return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
function calendarWindow(start:Date,now:Date,timeZone:string):DeskWindow{
 const today=dayKey(now,timeZone);
 const tomorrow=new Date(now.getTime()+86400000);
 const day=dayKey(start,timeZone);
 return day===today?'TODAY':day===dayKey(tomorrow,timeZone)?'TOMORROW':'LATER';
}
function rank(a:DeskDecision,b:DeskDecision){
 const priority={ENTRY_WINDOW:0,MONITOR:1,PASS:2};
 return priority[a.status]-priority[b.status]||b.score-a.score||a.minutesToStart-b.minutesToStart;
}

export function buildInstitutionalDesk(input:{
 rows:readonly DeskMarket[];
 source:string;
 providerDegraded?:boolean;
 generatedAt?:string;
 now?:Date;
 timeZone?:string;
}):InstitutionalDesk{
 const now=input.now??new Date();
 const timeZone=input.timeZone??'America/New_York';
 const ageMs=Date.parse(input.generatedAt||'');
 const boardAgeSeconds=Number.isFinite(ageMs)?Math.max(0,(now.getTime()-ageMs)/1000):null;
 const boardHealthy=input.source==='live'&&!input.providerDegraded&&boardAgeSeconds!==null&&boardAgeSeconds<=45;
 const all:DeskDecision[]=[];
 const windows:Record<DeskWindow,DeskDecision[]>={TODAY:[],TOMORROW:[],LATER:[]};

 for(const row of input.rows){
  const start=new Date(row.startTime);
  const minutesToStart=(start.getTime()-now.getTime())/60000;
  if(!Number.isFinite(minutesToStart)||minutesToStart<=0||minutesToStart>7*1440)continue;
  const window=calendarWindow(start,now,timeZone);
  const execution=row.bestExecutionVenue;
  const venueType=execution?.type??'SPORTSBOOK';
  const odds=venueType==='SPORTSBOOK'?(execution?.americanOdds??row.odds):row.odds;
  const price=execution?.marketProbability??row.marketProb;
  const fair=row.simProbability;
  const lower=row.simCi?.[0];
  const flags:string[]=[];
  if(!boardHealthy)flags.push('Board source is stale, degraded or not live');
  if(row.freshness!=='FRESH'||!Number.isFinite(row.sourceAgeMin)||row.sourceAgeMin>5)flags.push('Quote is not fresh');
  if(!row.sourceTimestamp)flags.push('Quote lacks an independently verifiable timestamp');
  if(row.sourceTimestamp){
   const stamp=Date.parse(row.sourceTimestamp);
   if(!Number.isFinite(stamp)||now.getTime()-stamp>5*60000||stamp-now.getTime()>60000)flags.push('Quote timestamp needs verification');
  }
  if(row.grade==='PASS'||row.grade==='WATCH')flags.push('Model has not cleared strong-grade validation');
  if(row.dynamicConfidence<.68)flags.push('Insufficient model confidence');
  if(row.regime==='DISLOCATED'||row.regime==='VOLATILE')flags.push('Unstable market regime');
  if(row.reliabilityMode&&row.reliabilityMode!=='NORMAL'||row.reliabilityCriticalOpen)flags.push('Model reliability guard is active');
  if(row.intelligenceStackReady===false)flags.push('Model intelligence inputs are incomplete');
  if(row.contextQuality?.recommendationReady===false)flags.push('Injury, lineup or context verification incomplete');
  if(!validProbability(price)||!validProbability(fair)||!Number.isFinite(lower)||lower<=0||lower>fair)flags.push('Probability interval or price is invalid');
  if(venueType==='PREDICTION_EXCHANGE'&&(!execution?.feeAdjusted||row.bestPredictionVenue?.status!=='MATCHED'))flags.push('Exchange fees or contract matching unverified');
  if(venueType==='SPORTSBOOK'&&(!Number.isFinite(odds)||odds===0))flags.push('Executable sportsbook odds unavailable');
  const edge=validProbability(price)&&validProbability(fair)?fair-price:0;
  const expectedValue=venueType==='SPORTSBOOK'&&Number.isFinite(odds)&&odds!==0
   ?fair*decimalOdds(odds)-1
   :Number(execution?.expectedValue??0);
  const entryPriceProbability=validProbability(fair)?clamp(fair-.02,.01,.99):0;
  if(edge<.025||expectedValue<.025)flags.push('Price advantage below 2.5% minimum');
  if(validProbability(price)&&price>entryPriceProbability)flags.push('Offered price exceeds entry ceiling');
  if(!Number.isFinite(lower)||lower<=price+.005)flags.push('Conservative model interval does not clear price');
  const venue=execution?.venue||row.sourceBook||'Unknown venue';
  if(venue==='Unknown venue')flags.push('No identified execution venue');

  const score=Math.round(clamp(
   clamp(expectedValue,0,.15)/.15*42+
   clamp(Number(row.dynamicConfidence)||0,0,1)*25+
   clamp(Number(lower)-price,0,.10)/.10*23+
   (row.grade==='ELITE'?10:row.grade==='STRONG'?7:0),
   0,100
  ));
  const eligible=flags.length===0;
  // Future games are tracked, not called immediate entries.
  const hardBlocked=!boardHealthy||row.grade==='PASS'||row.freshness==='STALE'||
   edge<=0||expectedValue<=0||!validProbability(price)||!validProbability(fair)||
   row.reliabilityMode==='PROTECTIVE'||row.reliabilityCriticalOpen;
  const status:DeskStatus=eligible&&minutesToStart<=360?'ENTRY_WINDOW':
   hardBlocked?'PASS':'MONITOR';
  const reasons=[
   'Fair model '+(fair*100).toFixed(1)+'%; market '+(price*100).toFixed(1)+'%',
   'Estimated EV '+(expectedValue*100).toFixed(1)+'%; uncertainty floor '+(Number(lower)*100).toFixed(1)+'%',
   status==='ENTRY_WINDOW'?'Recheck live odds and limits immediately before any manual action':
    status==='MONITOR'?'Reprice when fresh context, market or model evidence changes':'No eligible entry from this board'
  ];
  const decision:DeskDecision={
   id:row.id,sport:row.sport,league:row.league,event:row.event,
   selection:row.selection,market:row.market,startTime:row.startTime,window,status,
   score,venue,venueType,odds,fairProbability:fair,marketProbability:price,
   conservativeProbability:Number.isFinite(lower)?lower:0,edge,expectedValue,
   confidence:row.dynamicConfidence,simulationRuns:row.simulationRuns,
   entryPriceProbability,entryMinAmericanOdds:americanFromProbability(entryPriceProbability),
   minutesToStart,reasons,flags
  };
  all.push(decision);
  windows[window].push(decision);
 }
 for(const group of Object.values(windows))group.sort(rank);
 return {
  generatedAt:now.toISOString(),boardHealthy,boardAgeSeconds,
  ready:all.filter(x=>x.status==='ENTRY_WINDOW').length,
  monitor:all.filter(x=>x.status==='MONITOR').length,
  passed:all.filter(x=>x.status==='PASS').length,
  totalAnalyzed:all.length,
  today:windows.TODAY.slice(0,12),
  tomorrow:windows.TOMORROW.slice(0,12),
  later:windows.LATER.slice(0,20),
  methodology:[
   'Only actual fresh live quotes and model-calibrated intervals can open an entry window.',
   'Expected value, conservative interval and execution price outweigh raw simulation percentage.',
   'Future days are monitored. A 100,000-run simulation is not assumed unless the row reports that run count.',
   'The desk does not place wagers, assert fills or promise profit. Passing is a valid outcome.'
  ]
 };
}
