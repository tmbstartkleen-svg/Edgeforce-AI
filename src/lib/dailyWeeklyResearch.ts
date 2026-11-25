export type ResearchScope='today'|'week';
export type ResearchSession='ALL'|'AM'|'PM';
export const RESEARCH_TIME_ZONE='America/New_York';

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
 sourceTimestamp?:string;
 downgradeReasons?:string[];
 contextQuality?:{recommendationReady?:boolean};
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
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const probability=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const calendarFormatter=new Intl.DateTimeFormat('en-US',{
 timeZone:RESEARCH_TIME_ZONE,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'
});

function startTimestamp(value:unknown):number{
 // An unzoned time cannot be interpreted consistently across client devices.
 return typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
}

function calendarAt(timestamp:number){
 if(!Number.isFinite(timestamp))return null;
 const parts=calendarFormatter.formatToParts(new Date(timestamp));
 const part=(type:string)=>Number(parts.find(x=>x.type===type)?.value);
 return {day:Date.UTC(part('year'),part('month')-1,part('day'))/86400000,hour:part('hour')};
}

export function formatResearchRoi(value:unknown):string{
 // live-board expectedValue is fractional return per unit staked, including values above 1.
 return typeof value==='number'&&Number.isFinite(value)?(value*100).toFixed(1)+'%':'—';
}

export function isResearchRow(value:unknown):value is ResearchRow{
 if(!value||typeof value!=='object')return false;
 const row=value as Record<string,unknown>;
 return ['id','sport','event','selection','market'].every(key=>nonempty(row[key]))&&typeof row.startTime==='string';
}

export function hasResearchQualification(qualification?:ResearchQualification|null):qualification is ResearchQualification{
 return Boolean(qualification&&qualification.forced===false&&
  Array.isArray(qualification.allowedGrades)&&qualification.allowedGrades.length>0&&qualification.allowedGrades.every(nonempty)&&
  probability(qualification.minimumSimProbability)&&qualification.minimumSimProbability>0&&
  probability(qualification.minimumDynamicConfidence)&&qualification.minimumDynamicConfidence>0);
}

export function eventSession(row:ResearchRow):'AM'|'PM'|'UNKNOWN'{
 const calendar=calendarAt(startTimestamp(row.startTime));
 return calendar?(calendar.hour<12?'AM':'PM'):'UNKNOWN';
}

export function isTodayResearchRow(row:ResearchRow,now=new Date()):boolean{
 const event=calendarAt(startTimestamp(row.startTime)),today=calendarAt(now.getTime());
 return Boolean(event&&today&&event.day===today.day);
}

export function isStrictResearchRow(row:ResearchRow,qualification?:ResearchQualification|null,sourceAgeMin=row.sourceAgeMin):boolean{
 if(!hasResearchQualification(qualification)||!isResearchRow(row)||!Number.isFinite(startTimestamp(row.startTime)))return false;
 return typeof row.grade==='string'&&qualification.allowedGrades!.includes(row.grade)&&
  probability(row.simProbability)&&row.simProbability>=qualification.minimumSimProbability!&&
  probability(row.dynamicConfidence)&&row.dynamicConfidence>=qualification.minimumDynamicConfidence!&&
  typeof row.odds==='number'&&Number.isSafeInteger(row.odds)&&Math.abs(row.odds)>=100&&
  ['FRESH','AGING'].includes(row.freshness||'')&&
  typeof sourceAgeMin==='number'&&Number.isFinite(sourceAgeMin)&&sourceAgeMin>=0&&sourceAgeMin<=20&&
  (!row.contextQuality||row.contextQuality.recommendationReady===true);
}

export function researchSourceAge(row:ResearchRow,snapshotAt:string|undefined,now:Date):number|undefined{
 const snapshot=startTimestamp(snapshotAt),source=startTimestamp(row.sourceTimestamp),current=now.getTime();
 if(!Number.isFinite(snapshot)||!Number.isFinite(current)||snapshot>current+30000||
  !Number.isFinite(source)||source>current||
  typeof row.sourceAgeMin!=='number'||!Number.isFinite(row.sourceAgeMin)||row.sourceAgeMin<0)return undefined;
 // Source ages can be measured before a cached/delayed response gets generatedAt.
 // A missing provider timestamp cannot establish when that reported age was measured.
 // Keep the older age if the reported value is more conservative than the timestamp.
 return Math.max((current-source)/60000,row.sourceAgeMin+Math.max(0,current-snapshot)/60000);
}

export function contextForResearchRow(row:ResearchRow,changes:ResearchContextChange[]):ResearchContextChange[]{
 const id=normalize(row.id),event=normalize(row.event),selection=normalize(row.selection),sport=normalize(row.sport);
 return (Array.isArray(changes)?changes:[]).filter(change=>{
  if(!change||typeof change!=='object')return false;
  // A different explicit market identity must not fall back to a text match.
  if(nonempty(change.marketId))return Boolean(id&&normalize(change.marketId)===id);
  return Boolean(
   event&&normalize(change.event)===event&&
   (!change.selection||normalize(change.selection)===selection)&&
   (!change.sport||normalize(change.sport)===sport)
  );
 }).sort((a,b)=>{
  const time=(value?:string)=>Number.isFinite(startTimestamp(value))?startTimestamp(value):-Infinity;
  return time(b.detectedAt)-time(a.detectedAt)||0;
 });
}

export function buildDailyWeeklyResearch(
 rows:ResearchRow[],
 changes:ResearchContextChange[],
 options:{scope?:ResearchScope;sport?:string;session?:ResearchSession;now?:Date;snapshotAt?:string;qualification?:ResearchQualification|null}={}
){
 const scope=options.scope??'today';
 const sport=options.sport??'ALL';
 const session=options.session??'ALL';
 const now=options.now??new Date();
 const today=calendarAt(now.getTime());
 const qualification=options.qualification??null;
 const supplied=(Array.isArray(rows)?rows:[]).filter(isResearchRow);
 const unknownStartTimes=supplied.filter(row=>!Number.isFinite(startTimestamp(row.startTime))).length;
 const filtered=supplied
  .filter(row=>{
   const timestamp=startTimestamp(row.startTime),event=calendarAt(timestamp);
   return Boolean(event&&today&&timestamp>now.getTime()&&event.day>=today.day&&event.day<today.day+(scope==='today'?1:7));
  })
  .filter(row=>sport==='ALL'||row.sport===sport)
  .filter(row=>session==='ALL'||eventSession(row)===session)
  .sort((a,b)=>{
   const ta=startTimestamp(a.startTime),tb=startTimestamp(b.startTime);
   const aa=Number.isFinite(ta)?ta:Number.MAX_SAFE_INTEGER;
   const bb=Number.isFinite(tb)?tb:Number.MAX_SAFE_INTEGER;
   return aa-bb;
  });
 const enriched=filtered.map(row=>{
  const contextChanges=contextForResearchRow(row,changes);
  const sourceAgeMin=researchSourceAge(row,options.snapshotAt,now);
  return {
   row,
   session:eventSession(row),
   // Missing snapshot/provider time leaves source age unverified rather than resetting it to zero.
   strict:sourceAgeMin!==undefined&&isStrictResearchRow(row,qualification,sourceAgeMin),
   sourceAgeMin,
   freshness:sourceAgeMin===undefined?'UNVERIFIED':row.freshness==='STALE'||sourceAgeMin>20?'STALE':
    ['FRESH','AGING'].includes(row.freshness||'')?(sourceAgeMin>5?'AGING':row.freshness):'UNVERIFIED',
   contextChanges,
   materialContextChange:contextChanges.some(x=>x.severity==='ACTION'||x.severity==='WATCH')
  };
 });
 return {
  rows:enriched,
  unknownStartTimes,
  visible:enriched.length,
  strict:enriched.filter(x=>x.strict).length,
  fallback:enriched.filter(x=>!x.strict).length,
  contextFlagged:enriched.filter(x=>x.contextChanges.length>0).length,
  materialContextFlagged:enriched.filter(x=>x.materialContextChange).length
 };
}
