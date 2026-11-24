import type {StatGame} from './playerStatQuestions';

export type VerifiedPlayerContext = {
  gameTime:string;
  roster:{status:'active'|'inactive'|'questionable';source:string;verifiedAt:string};
  injury:{status:'available'|'out'|'questionable';source:string;verifiedAt:string};
  opponent:{team:string;source:string;verifiedAt:string};
  expectedMinutes:{value:number;source:string;verifiedAt:string};
};
export type ContextAssessment={ready:boolean;errors:string[];expectedMinutes:number|null};
const validTime=(s:string)=>Number.isFinite(Date.parse(s));
const fresh=(date:string,gameTime:string,maxHours:number)=>{
 const age=Date.parse(gameTime)-Date.parse(date);
 return Number.isFinite(age)&&age>=0&&age<=maxHours*3600000;
};
/** Explicit, source-attributed pregame context only. Does not infer missing inputs. */
export function assessVerifiedPlayerContext(context:VerifiedPlayerContext|null|undefined):ContextAssessment{
 const errors:string[]=[];
 if(!context)return {ready:false,errors:['No verified pregame player context supplied.'],expectedMinutes:null};
 if(!validTime(context.gameTime))errors.push('Invalid scheduled game time.');
 const checks=[
  ['Roster',context.roster,48],
  ['Injury',context.injury,24],
  ['Opponent',context.opponent,72],
  ['Expected minutes',context.expectedMinutes,24]
 ] as const;
 for(const [label,item,hours] of checks){
  if(!item||!item.source?.trim()||!validTime(item.verifiedAt)||!fresh(item.verifiedAt,context.gameTime,hours))
   errors.push(label+' source or freshness check failed.');
 }
 if(context.roster?.status!=='active')errors.push('Roster is not confirmed active.');
 if(context.injury?.status!=='available')errors.push('Player availability is not confirmed.');
 if(!context.opponent?.team?.trim())errors.push('Opponent not confirmed.');
 const minutes=context.expectedMinutes?.value;
 if(typeof minutes!=='number'||!Number.isFinite(minutes)||minutes<=0||minutes>60)errors.push('Expected minutes must be between 0 and 60.');
 return {ready:errors.length===0,errors,expectedMinutes:errors.length===0?minutes:null};
}
export function pregameHistory(games:StatGame[],gameTime:string):StatGame[]{
 const cutoff=Date.parse(gameTime);
 if(!Number.isFinite(cutoff))return [];
 return games.filter(g=>g.stat_date&&Number.isFinite(Date.parse(g.stat_date))&&Date.parse(g.stat_date)<cutoff&&(!/^\d{4}-\d{2}-\d{2}$/.test(g.stat_date)||g.stat_date<gameTime.slice(0,10)))
  .sort((a,b)=>Date.parse(b.stat_date||'')-Date.parse(a.stat_date||''));
}
