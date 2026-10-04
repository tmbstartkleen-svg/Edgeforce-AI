import type {Scanned} from './scanner';

export type BoardRow=Scanned & {
  dailyScore:number;
  weeklyScore:number;
  probabilityGap:number;
  calendarDay:string;
};

export function scoreBoardRows(rows:Scanned[]):BoardRow[]{
  return rows.map(row=>{
    const freshness=row.freshness==='FRESH'?1:row.freshness==='AGING'?.7:.35;
    const consensusAgreement=row.consensus?.agreement??.7;
    const consensusDispersion=row.consensus?.dispersion??0;
    const depthBonus=row.consensus?Math.min(.012,Math.max(0,row.consensus.bookCount-1)*.003):0;
    const dynamicConfidence=row.dynamicConfidence??row.confidence;
    const regimePenalty=row.regime==='DISLOCATED'?.055:row.regime==='VOLATILE'?.025:row.regime==='THIN'?.035:0;
    const dailyScore=Math.max(0,Math.min(1,row.simProbability*.78+dynamicConfidence*.22-consensusDispersion*.30-regimePenalty+depthBonus));
    const weeklyScore=Math.max(0,Math.min(1,row.simProbability*.58+row.agreement*.13+dynamicConfidence*.13+freshness*.07+consensusAgreement*.09-consensusDispersion*.18-regimePenalty+depthBonus));
    const probabilityGap=row.simProbability-row.marketProb;
    const calendarDay=new Date(row.startTime).toISOString().slice(0,10);
    return {...row,dailyScore,weeklyScore,probabilityGap,calendarDay};
  });
}

export function qualifiesForTopBoard(row:Scanned){
  const confidence=row.dynamicConfidence??row.confidence;
  const contextReady=!row.contextQuality||row.contextQuality.recommendationReady;
  return (row.grade==='ELITE'||row.grade==='STRONG')
    &&row.freshness!=='STALE'
    &&row.simProbability>=.52
    &&confidence>=.50
    &&contextReady;
}

export function rankDaily(rows:Scanned[],limit=30){
  return scoreBoardRows(rows)
    .filter(x=>x.bucket==='TODAY'&&qualifiesForTopBoard(x))
    .sort((a,b)=>b.dailyScore-a.dailyScore||b.dynamicConfidence-a.dynamicConfidence||b.agreement-a.agreement)
    .slice(0,limit);
}

export function rankWeekly(rows:Scanned[],limit=30){
  const ranked=scoreBoardRows(rows)
    .filter(x=>qualifiesForTopBoard(x))
    .sort((a,b)=>b.weeklyScore-a.weeklyScore||b.dynamicConfidence-a.dynamicConfidence||b.dailyScore-a.dailyScore);

  const days=[...new Set(ranked.map(x=>x.calendarDay))].slice(0,8);
  const dayCap=Math.max(2,Math.ceil(limit/Math.max(1,days.length)));
  const counts=new Map<string,number>();
  const selected:BoardRow[]=[];

  for(const row of ranked){
    const n=counts.get(row.calendarDay)||0;
    if(n>=dayCap)continue;
    selected.push(row);
    counts.set(row.calendarDay,n+1);
    if(selected.length>=limit)return selected;
  }

  for(const row of ranked){
    if(selected.some(x=>x.id===row.id))continue;
    selected.push(row);
    if(selected.length>=limit)break;
  }
  return selected;
}
