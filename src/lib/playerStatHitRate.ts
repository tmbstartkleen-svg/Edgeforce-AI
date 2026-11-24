import type {StatGame} from './playerStatQuestions';

export type HitRateResult={
 status:'ok'|'no_data'|'invalid';
 stat:string;line:number;side:'over'|'under';
 sampleSize:number;hits:number;pushes:number;misses:number;
 hitRate:number|null;observations:Array<{date:string|null;value:number;hit:boolean|null}>;
};
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
export function playerStatHitRate(games:StatGame[],stat:string,line:number,side:'over'|'under'='over',limit=10):HitRateResult{
 const empty=(status:HitRateResult['status']):HitRateResult=>({status,stat,line,side,sampleSize:0,hits:0,pushes:0,misses:0,hitRate:null,observations:[]});
 if(!Number.isFinite(line)||!Number.isInteger(limit)||limit<1||limit>250||!['over','under'].includes(side))return empty('invalid');
 const target=normalize(stat);
 const observations=games.slice(0,limit).flatMap(g=>{
  const found=Object.entries(g.stats||{}).find(([key])=>normalize(key)===target);
  const value=found?numeric(found[1]):null;
  if(value===null)return [];
  return [{date:g.stat_date||null,value,hit:value===line?null:side==='over'?value>line:value<line}];
 });
 if(!observations.length)return empty('no_data');
 const hits=observations.filter(o=>o.hit===true).length;
 const misses=observations.filter(o=>o.hit===false).length;
 const pushes=observations.length-hits-misses;
 const decisions=hits+misses;
 return {status:'ok',stat,line,side,sampleSize:observations.length,hits,misses,pushes,hitRate:decisions?hits/decisions:null,observations};
}
