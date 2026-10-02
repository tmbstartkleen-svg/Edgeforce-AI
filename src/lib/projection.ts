import {db} from './db';
import type {Market} from './types';

const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases:Record<string,string[]>={
  passing_yards:['passing_yards','pass_yards','passingYards','PassYds','PY'],
  passing_tds:['passing_tds','pass_tds','passingTouchdowns','PassTD'],
  rushing_yards:['rushing_yards','rush_yards','rushingYards','RushYds'],
  receiving_yards:['receiving_yards','rec_yards','receivingYards','RecYds'],
  receptions:['receptions','recs','Rec'],
  points:['points','pts','Points'],
  rebounds:['rebounds','reb','Rebounds'],
  assists:['assists','ast','Assists'],
  threes:['three_pointers_made','threes','3pm','ThreePointersMade'],
  strikeouts:['strikeouts','so','Strikeouts'],
  hits:['hits','h','Hits'],
  total_bases:['total_bases','tb','TotalBases'],
  saves:['saves','sv','Saves'],
  shots_on_goal:['shots_on_goal','sog','ShotsOnGoal'],
  aces:['aces','Aces'],
  double_faults:['double_faults','DoubleFaults']
};

function statKey(m:Market){
  const s=key(`${m.prop||''} ${m.marketKey||''} ${m.selection||''}`);
  if(s.includes('passing yard'))return 'passing_yards';
  if(s.includes('passing td')||s.includes('pass touchdown'))return 'passing_tds';
  if(s.includes('rushing yard'))return 'rushing_yards';
  if(s.includes('receiving yard'))return 'receiving_yards';
  if(s.includes('reception'))return 'receptions';
  if(s.includes('rebound'))return 'rebounds';
  if(s.includes('assist'))return 'assists';
  if(s.includes('three')||s.includes('3 pointer'))return 'threes';
  if(s.includes('strikeout'))return 'strikeouts';
  if(s.includes('total base'))return 'total_bases';
  if(s.includes('save'))return 'saves';
  if(s.includes('shot on goal'))return 'shots_on_goal';
  if(s.includes('double fault'))return 'double_faults';
  if(s.includes('ace'))return 'aces';
  if(s.includes('point'))return 'points';
  if(s.includes(' hit'))return 'hits';
  return '';
}

function value(stats:Record<string,unknown>,name:string){
  for(const alias of aliases[name]||[name]){
    const v=stats[alias];
    if(typeof v==='number'&&Number.isFinite(v))return v;
    if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)))return Number(v);
  }
  return null;
}

function mean(xs:number[]){return xs.reduce((s,x)=>s+x,0)/Math.max(1,xs.length)}
function sd(xs:number[]){
  if(xs.length<2)return Math.max(1,Math.abs(xs[0]||1)*.2);
  const m=mean(xs);
  return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
}

export async function hydratePlayerProjections(markets:Market[]):Promise<Market[]>{
  const targets=markets.filter(m=>m.player&&typeof m.point==='number'&&m.market==='Player Prop');
  if(!targets.length)return markets;
  const sql=db();
  if(!sql)return markets.map(m=>({...m,projectionStatus:m.market==='Player Prop'?'missing-database':m.projectionStatus}));
  try{
    const rows=await sql`
      select a.full_name,pgs.stats,pgs.stat_date
      from player_game_stats pgs
      join athletes a on a.id=pgs.athlete_id
      order by pgs.stat_date desc
      limit 10000
    `;
    const byPlayer=new Map<string,Record<string,unknown>[]>();
    for(const row of rows as unknown as Array<{full_name:string;stats:Record<string,unknown>}>){
      const k=key(row.full_name);
      if(!byPlayer.has(k))byPlayer.set(k,[]);
      const bucket=byPlayer.get(k)!;
      if(bucket.length<24)bucket.push(row.stats||{});
    }
    return markets.map(m=>{
      if(!m.player||typeof m.point!=='number'||m.market!=='Player Prop')return m;
      const name=statKey(m);
      const history=(byPlayer.get(key(m.player))||[]).map(x=>value(x,name)).filter((x):x is number=>typeof x==='number').slice(0,20);
      if(!name||history.length<3)return {...m,projectionStatus:'insufficient-history'};
      const recent=history.slice(0,5);
      const projected=mean(history)*.55+mean(recent)*.45;
      const sigma=Math.max(.5,sd(history));
      const delta=(projected-m.point)/Math.max(1,sigma);
      return {
        ...m,
        projectionMean:projected,
        projectionStdDev:sigma,
        projectionSamples:history.length,
        projectionStatus:'historical',
        sportFeatures:{...(m.sportFeatures||{}),form:Math.max(-1,Math.min(1,delta/2))}
      };
    });
  }catch{
    return markets.map(m=>({...m,projectionStatus:m.market==='Player Prop'?'projection-query-failed':m.projectionStatus}));
  }
}
