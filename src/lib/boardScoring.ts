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
    const dailyScore=row.simProbability;
    const weeklyScore=Math.max(0,Math.min(1,row.simProbability*.72+row.agreement*.18+freshness*.10));
    const probabilityGap=row.simProbability-row.marketProb;
    const calendarDay=new Date(row.startTime).toISOString().slice(0,10);
    return {...row,dailyScore,weeklyScore,probabilityGap,calendarDay};
  });
}

export function rankDaily(rows:Scanned[],limit=30){
  return scoreBoardRows(rows)
    .filter(x=>x.bucket==='TODAY'&&x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65)
    .sort((a,b)=>b.dailyScore-a.dailyScore||b.agreement-a.agreement)
    .slice(0,limit);
}

export function rankWeekly(rows:Scanned[],limit=30){
  const ranked=scoreBoardRows(rows)
    .filter(x=>x.grade!=='PASS'&&x.simulationMode!=='probability-fallback'&&x.simProbability>=.65)
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
