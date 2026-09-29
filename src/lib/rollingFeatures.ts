export type GameRow={date:string;opponent?:string;stats:Record<string,number>};

export function rollingAverage(rows:GameRow[],key:string,window=5){
  const vals=rows.slice(0,window).map(r=>r.stats[key]).filter((x):x is number=>Number.isFinite(x));
  return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
}

export function exponentialForm(rows:GameRow[],key:string,alpha=.35){
  const vals=rows.map(r=>r.stats[key]).filter((x):x is number=>Number.isFinite(x));
  if(!vals.length)return 0;
  let e=vals.at(-1) as number;
  for(let i=vals.length-2;i>=0;i--)e=alpha*vals[i]+(1-alpha)*e;
  return e;
}

export function opponentAdjusted(raw:number,opponentStrength:number,leagueAverage:number){
  if(!Number.isFinite(leagueAverage)||leagueAverage===0)return raw;
  const adj=opponentStrength/leagueAverage;
  return adj?raw/adj:raw;
}

export function rollingFeaturePack(rows:GameRow[],keys:string[],window=5){
  const out:Record<string,number>={};
  for(const key of keys){
    out[`${key}_avg_${window}`]=rollingAverage(rows,key,window);
    out[`${key}_ewm`]=exponentialForm(rows,key);
  }
  return out;
}
