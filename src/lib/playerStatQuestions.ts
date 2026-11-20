export type StatGame = {stat_date?:string;opponent?:string|null;home_away?:string|null;stats?:Record<string,unknown>};
export type StatQuery = {stat:string;window:number;opponent?:string;venue?:'home'|'away'};
const aliases:Record<string,string[]> = {
 points:['points','pts'],rebounds:['rebounds','reb'],assists:['assists','ast'],
 steals:['steals','stl'],blocks:['blocks','blk'],threes:['threepointersmade','threepointfieldgoalsmade','3pm','threes'],
 passingyards:['passingyards'],rushingyards:['rushingyards'],receivingyards:['receivingyards'],
 receptions:['receptions'],goals:['goals'],shots:['shots','shotsongoal'],hits:['hits'],strikeouts:['strikeouts','pitchingstrikeouts']
};
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const value=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
export function parseStatQuestion(question:string):StatQuery|null{
 const q=question.toLowerCase();
 const tokens=q.match(/[a-z0-9]+/g)||[];
 const stat=Object.entries(aliases).find(([,names])=>names.some(n=>tokens.includes(n)))?.[0];
 if(!stat)return null;
 const windowMatch=q.match(/(?:last|past)\s+(\d{1,3})\s+games?/);
 const window=Math.min(50,Math.max(1,windowMatch?Number(windowMatch[1]):10));
 const venue=/\bat home\b|\bhome games?\b/.test(q)?'home':/\bon the road\b|\baway games?\b/.test(q)?'away':undefined;
 const opponent=q.match(/\b(?:against|versus|vs\.?)[ ]+([a-z0-9 .'-]+?)(?:\s+(?:in|over|during|at|last|past)\b|[?.!,]|$)/i)?.[1]?.trim();
 return {stat,window,venue,opponent:opponent||undefined};
}
export function answerStatQuestion(games:StatGame[],question:string){
 const parsed=parseStatQuestion(question);
 if(!parsed)return {status:'unsupported' as const,message:'Ask about points, rebounds, assists, steals, blocks, threes, yards, receptions, goals, shots, hits or strikeouts.'};
 const filtered=games.filter(g=>{
  const opponentMatch=!parsed.opponent||norm(g.opponent||'').includes(norm(parsed.opponent));
  const venueMatch=!parsed.venue||norm(g.home_away||'')===parsed.venue;
  return opponentMatch&&venueMatch;
 }).slice(0,parsed.window);
 const keys=aliases[parsed.stat]||[parsed.stat];
 const observations=filtered.map(g=>{
  const entry=Object.entries(g.stats||{}).find(([k])=>keys.includes(norm(k)));
  return entry?value(entry[1]):null;
 }).filter((v):v is number=>v!==null);
 if(!observations.length)return {status:'no_data' as const,message:'No matching recorded statistics. The result is unavailable, not zero.',sampleSize:0,query:parsed};
 const total=observations.reduce((a,b)=>a+b,0);
 return {status:'ok' as const,query:parsed,sampleSize:observations.length,matchingGames:filtered.length,average:total/observations.length,total,min:Math.min(...observations),max:Math.max(...observations),message:'Computed from recorded games only.'};
}
