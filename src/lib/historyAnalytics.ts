import type {HistoricalBet} from './betHistory';

export function analyzeHistory(history:HistoricalBet[]){
  const summarize=(rows:HistoricalBet[],key:string)=>{
    const hits=rows.filter(x=>x.result==='win').length;
    const staked=rows.reduce((s,x)=>s+x.stake,0);
    const returned=rows.reduce((s,x)=>s+x.paid,0);
    return {key,count:rows.length,hits,misses:rows.length-hits,hitRate:rows.length?hits/rows.length:0,staked,returned,net:returned-staked};
  };

  const sports=[...new Set(history.map(x=>x.sport))].map(key=>summarize(history.filter(x=>x.sport===key),key));
  const legCounts=[...new Set(history.map(x=>x.legCount))].sort((a,b)=>a-b).map(n=>summarize(history.filter(x=>x.legCount===n),String(n)));
  const known=history.flatMap(x=>x.legs).filter(x=>x.result!=='unknown');
  const markets=[...new Set(known.map(x=>x.marketType))].map(key=>{
    const rows=known.filter(x=>x.marketType===key);
    const hits=rows.filter(x=>x.result==='win').length;
    return {key,count:rows.length,hits,misses:rows.length-hits,hitRate:rows.length?hits/rows.length:0};
  });
  return {overall:summarize(history,'Overall'),sports,legCounts,markets,sampleSize:history.length};
}
