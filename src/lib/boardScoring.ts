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
    const dailyScore=Math.max(0,Math.min(1,row.simProbability-consensusDispersion*.30+depthBonus));
    const weeklyScore=Math.max(0,Math.min(1,row.simProbability*.68+row.agreement*.16+freshness*.08+consensusAgreement*.08-consensusDispersion*.18+depthBonus));
    const probabilityGap=row.simProbability-row.marketProb;
    const calendarDay=new Date(row.startTime).toISOString().slice(0,10);
    return {...row,dailyScore,weeklyScore,probabilityGap,calendarDay};
  });
}

export function rankDaily(rows:Scanned[],limit=30){
  return scoreBoardRows(rows)
    .filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS')
    .sort((a,b)=>b.dailyScore-a.dailyScore||b.agreement-a.agreement)
    .slice(0,limit);
}

export function rankWeekly(rows:Scanned[],limit=30){
  const ranked=scoreBoardRows(rows)
    .filter(x=>x.grade!=='PASS')
    .sort((a,b)=>b.weeklyScore-a.weeklyScore||b.dailyScore-a.dailyScore);

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
