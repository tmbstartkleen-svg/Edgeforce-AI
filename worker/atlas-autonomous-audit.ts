// Build 410: opt-in, alarm-driven source-health audits. No paid APIs or wagering.
export type AuditConfig={enabled:boolean; intervalMinutes:number; nextRunAt:number|null; updatedAt:string};
export type AuditTask={id:string;createdAt:string;status:'QUEUED'|'RUNNING'|'RETRY'|'COMPLETED'|'FAILED'|'CANCELLED';attempts:number;dueAt:number;error?:string;summary?:string};
export type AuditAlert={id:string;createdAt:string;kind:'EMPTY'|'STALE'|'FAILED';message:string};
type Store={get<T>(k:string):Promise<T|undefined>;put<T>(k:string,v:T):Promise<void>;setAlarm(at:number):Promise<void>;deleteAlarm():Promise<void>};
type D1={prepare(sql:string):{all<T>():Promise<{results:T[]}>}};
export type AuditEnv={INTELLIGENCE_DB?:D1};
const CONFIG='atlas.audit.config.v1',JOBS='atlas.audit.jobs.v1',ALERTS='atlas.audit.alerts.v1';
const DEFAULT:AuditConfig={enabled:false,intervalMinutes:60,nextRunAt:null,updatedAt:'not-configured'};
const MAX_JOBS=60,MAX_ALERTS=35,MAX_ATTEMPTS=3;
export class AtlasAuditController{
 constructor(private storage:Store,private env:AuditEnv){}
 async snapshot(){return {config:await this.storage.get<AuditConfig>(CONFIG)||DEFAULT,jobs:await this.storage.get<AuditTask[]>(JOBS)||[],alerts:await this.storage.get<AuditAlert[]>(ALERTS)||[],mode:'READ_ONLY_D1_METADATA',costlyCalls:false,externalAlerts:false};}
 private async arm(){const s=await this.snapshot();const candidates=s.jobs.filter(j=>j.status==='QUEUED'||j.status==='RETRY').map(j=>j.dueAt);if(s.config.enabled&&s.config.nextRunAt!==null)candidates.push(s.config.nextRunAt);if(candidates.length)await this.storage.setAlarm(Math.max(Date.now()+1000,Math.min(...candidates)));else await this.storage.deleteAlarm();}
 async configure(enabled:boolean,intervalMinutes:number){if(![60,180,360].includes(intervalMinutes))throw Error('BAD_INTERVAL');const config:AuditConfig={enabled,intervalMinutes,nextRunAt:enabled?Date.now()+15000:null,updatedAt:new Date().toISOString()};await this.storage.put(CONFIG,config);if(!enabled){const old=await this.storage.get<AuditTask[]>(JOBS)||[];await this.storage.put(JOBS,old.map(j=>j.status==='QUEUED'||j.status==='RETRY'?{...j,status:'CANCELLED' as const,error:'Cancelled by Founder'}:j));}await this.arm();return config;}
 async enqueue(){const now=Date.now(),jobs=await this.storage.get<AuditTask[]>(JOBS)||[];if(jobs.some(j=>['QUEUED','RUNNING','RETRY'].includes(j.status)&&now-Date.parse(j.createdAt)<600000))throw Error('AUDIT_PENDING');if(jobs.filter(j=>now-Date.parse(j.createdAt)<3600000).length>=6)throw Error('AUDIT_HOURLY_LIMIT');const task:AuditTask={id:crypto.randomUUID(),status:'QUEUED',attempts:0,createdAt:new Date().toISOString(),dueAt:now+1000};await this.storage.put(JOBS,[...jobs,task].slice(-MAX_JOBS));await this.arm();return task;}
 private async alert(kind:AuditAlert['kind'],message:string){const entries=await this.storage.get<AuditAlert[]>(ALERTS)||[];if(entries.some(x=>x.kind===kind&&Date.now()-Date.parse(x.createdAt)<3600000))return;entries.push({id:crypto.randomUUID(),kind,message,createdAt:new Date().toISOString()});await this.storage.put(ALERTS,entries.slice(-MAX_ALERTS));}
 async executeAlarm(){const now=Date.now();const s=await this.snapshot();let {jobs}=s;const config=s.config;
  if(config.enabled&&config.nextRunAt!==null&&config.nextRunAt<=now){if(!jobs.some(j=>['QUEUED','RUNNING','RETRY'].includes(j.status)&&now-Date.parse(j.createdAt)<600000))jobs.push({id:crypto.randomUUID(),status:'QUEUED',attempts:0,createdAt:new Date().toISOString(),dueAt:now});await this.storage.put(CONFIG,{...config,nextRunAt:now+config.intervalMinutes*60000});}
  jobs=jobs.map(j=>j.status==='RUNNING'&&now-Date.parse(j.createdAt)>600000?{...j,status:'RETRY' as const,dueAt:now,error:'Recovered interrupted task'}:j);
  const index=jobs.findIndex(j=>['QUEUED','RETRY'].includes(j.status)&&j.dueAt<=now);
  if(index===-1){await this.storage.put(JOBS,jobs.slice(-MAX_JOBS));await this.arm();return;}
  const current={...jobs[index],status:'RUNNING' as const,attempts:jobs[index].attempts+1};jobs[index]=current;await this.storage.put(JOBS,jobs.slice(-MAX_JOBS));
  try{const db=this.env.INTELLIGENCE_DB;if(!db||typeof db.prepare!=='function')throw Error('D1_UNAVAILABLE');
    const result=await db.prepare('SELECT source_id AS source, MAX(observed_at) AS latest, COUNT(*) AS count FROM intelligence_observations GROUP BY source_id ORDER BY latest DESC LIMIT 25').all<{source:string;latest:string;count:number}>();
    const rows=result.results||[];const latest=Math.max(...rows.map(r=>Date.parse(r.latest)).filter(Number.isFinite));
    if(!rows.length)await this.alert('EMPTY','No D1 source observations are available; provider coverage is unverified.');
    else if(Number.isFinite(latest)&&now-latest>7200000)await this.alert('STALE','Newest D1 observation is older than two hours.');
    jobs[index]={...current,status:'COMPLETED',summary:'Read-only audit: '+rows.length+' observed sources; latest '+(Number.isFinite(latest)?new Date(latest).toISOString():'unknown')};
  }catch(e){const reason=e instanceof Error?e.message:'AUDIT_FAILURE';if(current.attempts<MAX_ATTEMPTS)jobs[index]={...current,status:'RETRY',dueAt:Date.now()+(current.attempts===1?60000:300000),error:reason};else{jobs[index]={...current,status:'FAILED',error:reason};await this.alert('FAILED','D1 source audit exhausted three attempts: '+reason.slice(0,100));}}
  await this.storage.put(JOBS,jobs.slice(-MAX_JOBS));await this.arm();
 }
}
