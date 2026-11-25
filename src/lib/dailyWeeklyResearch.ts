export type ResearchScope='today'|'week';
export type ResearchSession='ALL'|'AM'|'PM';

export type ResearchRow={
 id:string;
 sport:string;
 league?:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 period?:string;
 bucket?:string;
 calendarDay?:string;
 odds?:number;
 simProbability?:number;
 modelProb?:number;
 expectedValue?:number;
 grade?:string;
 dynamicConfidence?:number;
 confidenceLabel?:string;
 freshness?:string;
 sourceAgeMin?:number;
 downgradeReasons?:string[];
};

export type ResearchContextChange={
 marketId?:string;
 event?:string;
 selection?:string;
 sport?:string;
 type?:string;
 severity?:'INFO'|'WATCH'|'ACTION'|string;
 reason?:string;
 detectedAt?:string;
};

export type ResearchQualification={
 forced?:boolean;
 allowedGrades?:string[];
 minimumSimProbability?:number;
 minimumDynamicConfidence?:number;
 fallbackMode?:string|null;
 fallbackReason?:string|null;
};

const normalize=(value:unknown)=>String(value??'').trim().toLowerCase();

export function eventSession(row:ResearchRow):'AM'|'PM'{
 const p=normalize(row.period);
 if(p==='am')return 'AM';
 if(p==='pm')return 'PM';
 const t=Date.parse(row.startTime);
 if(!Number.isFinite(t))return 'PM';
 return new Date(t).getHours()<12?'AM':'PM';
}

export function isTodayResearchRow(row:ResearchRow,now=new Date()):boolean{
 if(row.bucket==='TODAY')return true;
 const t=Date.parse(row.startTime);
 if(!Number.isFinite(t))return false;
 const d=new Date(t);
 return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
}

export function isStrictResearchRow(row:ResearchRow,qualification?:ResearchQualification|null):boolean{
 if(qualification?.forced)return false;
 const grades=qualification?.allowedGrades?.length?qualification.allowedGrades:['ELITE','STRONG'];
 return grades.includes(String(row.grade||'').toUpperCase());
}

export function contextForResearchRow(row:ResearchRow,changes:ResearchContextChange[]):ResearchContextChange[]{
 const id=normalize(row.id),event=normalize(row.event),selection=normalize(row.selection),sport=normalize(row.sport);
 return (Array.isArray(changes)?changes:[]).filter(change=>{
  if(id&&normalize(change.marketId)===id)return true;
  return Boolean(
   event&&normalize(change.event)===event&&
   (!change.selection||normalize(change.selection)===selection)&&
   (!change.sport||normalize(change.sport)===sport)
  );
 }).sort((a,b)=>Date.parse(String(b.detectedAt||''))-Date.parse(String(a.detectedAt||'')));
}

export function buildDailyWeeklyResearch(
 rows:ResearchRow[],
 changes:ResearchContextChange[],
 options:{scope?:ResearchScope;sport?:string;session?:ResearchSession;now?:Date;qualification?:ResearchQualification|null}={}
){
 const scope=options.scope??'today';
 const sport=options.sport??'ALL';
 const session=options.session??'ALL';
 const now=options.now??new Date();
 const qualification=options.qualification??null;
 const filtered=(Array.isArray(rows)?rows:[])
  .filter(row=>scope==='week'||isTodayResearchRow(row,now))
  .filter(row=>sport==='ALL'||row.sport===sport)
  .filter(row=>session==='ALL'||eventSession(row)===session)
  .sort((a,b)=>{
   const ta=Date.parse(a.startTime),tb=Date.parse(b.startTime);
   const aa=Number.isFinite(ta)?ta:Number.MAX_SAFE_INTEGER;
   const bb=Number.isFinite(tb)?tb:Number.MAX_SAFE_INTEGER;
   return aa-bb;
  });
 const enriched=filtered.map(row=>{
  const contextChanges=contextForResearchRow(row,changes);
  return {
   row,
   session:eventSession(row),
   strict:isStrictResearchRow(row,qualification),
   contextChanges,
   materialContextChange:contextChanges.some(x=>x.severity==='ACTION'||x.severity==='WATCH')
  };
 });
 return {
  rows:enriched,
  visible:enriched.length,
  strict:enriched.filter(x=>x.strict).length,
  fallback:enriched.filter(x=>!x.strict).length,
  contextFlagged:enriched.filter(x=>x.contextChanges.length>0).length,
  materialContextFlagged:enriched.filter(x=>x.materialContextChange).length
 };
}
