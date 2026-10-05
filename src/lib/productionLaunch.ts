import {db} from './db';

export const PRODUCTION_LAUNCH_STAGES=[
 'DEPLOYED','MIGRATED','PROVIDERS_CERTIFIED','LAUNCH_DOCTOR_PASSED','SMOKE_PASSED','ATTESTED','STRICT_CERTIFIED','V1_READY','COMPLETE','FAILED','ROLLED_BACK'
] as const;
export type ProductionLaunchStage=typeof PRODUCTION_LAUNCH_STAGES[number];
export type ProductionLaunchState='NOT_STARTED'|'IN_PROGRESS'|'READY'|'FAILED'|'ROLLED_BACK'|'STALE';

const requiredStages:ProductionLaunchStage[]=['DEPLOYED','MIGRATED','PROVIDERS_CERTIFIED','LAUNCH_DOCTOR_PASSED','SMOKE_PASSED','ATTESTED','STRICT_CERTIFIED','V1_READY','COMPLETE'];

export async function recordProductionLaunchEvent(input:{launchId:string;stage:ProductionLaunchStage;deploymentUrl?:string|null;commitSha?:string|null;detail?:Record<string,unknown>|null}){
 const sql=db();
 if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into production_launch_events(launch_id,stage,deployment_url,commit_sha,detail)
  values(${input.launchId},${input.stage},${input.deploymentUrl||null},${input.commitSha||null},${sql.json((input.detail||{}) as any)})
  returning id,created_at as "createdAt"
 `;
 return {persisted:true,id:Number(row?.id||0)||null,createdAt:row?.createdAt||null};
}

export async function getProductionLaunchStatus(){
 const sql=db();
 if(!sql)return {configured:false,state:'NOT_STARTED' as ProductionLaunchState,launchId:null,progress:0,events:[],missingStages:requiredStages};
 let latestId:string|null=null;
 try{
  const [latest]=await sql`select launch_id from production_launch_events order by created_at desc limit 1`;
  latestId=latest?.launch_id?String(latest.launch_id):null;
 }catch{
  return {configured:true,state:'NOT_STARTED' as ProductionLaunchState,launchId:null,progress:0,events:[],missingStages:requiredStages};
 }
 if(!latestId)return {configured:true,state:'NOT_STARTED' as ProductionLaunchState,launchId:null,progress:0,events:[],missingStages:requiredStages};
 const rows=await sql`
  select id,launch_id as "launchId",stage,deployment_url as "deploymentUrl",commit_sha as "commitSha",detail,created_at as "createdAt"
  from production_launch_events where launch_id=${latestId} order by created_at asc,id asc
 `;
 const events=(rows as any[]).map(x=>({id:Number(x.id),launchId:String(x.launchId),stage:String(x.stage) as ProductionLaunchStage,deploymentUrl:x.deploymentUrl?String(x.deploymentUrl):null,commitSha:x.commitSha?String(x.commitSha):null,detail:x.detail||{},createdAt:String(x.createdAt)}));
 const stages=new Set(events.map(x=>x.stage));
 const completed=requiredStages.filter(x=>stages.has(x)).length;
 const progress=completed/requiredStages.length;
 const missingStages=requiredStages.filter(x=>!stages.has(x));
 const latestEvent=events.at(-1)||null;
 const ageMin=latestEvent?Math.max(0,(Date.now()-new Date(latestEvent.createdAt).getTime())/60000):null;
 let state:ProductionLaunchState='IN_PROGRESS';
 if(stages.has('ROLLED_BACK'))state='ROLLED_BACK';
 else if(stages.has('FAILED'))state='FAILED';
 else if(stages.has('COMPLETE')&&missingStages.length===0)state='READY';
 else if(ageMin!==null&&ageMin>30)state='STALE';
 return {configured:true,state,launchId:latestId,progress,events,missingStages,latestEvent,ageMinutes:ageMin,requiredStages};
}