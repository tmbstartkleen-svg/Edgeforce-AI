import {SPECIALIST_AGENTS} from './specialist-network.mjs';
const reserved=new Set(SPECIALIST_AGENTS.map(a=>a.id));
const divisions=new Set(['SPORTS','PREDICTION_MARKETS','PLATFORM']);
const safePermissions=new Set(['READ_METADATA','READ_APPROVED_SOURCES','PROPOSE_OBSERVATIONS','PROPOSE_CHANGES']);
/** Declarative role proposals only; no credentials, schedules or runtime spawning. */
export function proposeSpecialist({id,division,role,mission,permissions=['READ_METADATA'],reason,taskTypes=[]}={}){
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{2,63}$/.test(id)||reserved.has(id))throw Error('INVALID_OR_DUPLICATE_AGENT');
 if(!divisions.has(division))throw Error('INVALID_DIVISION');
 if(typeof role!=='string'||!/^[A-Z_]{3,48}$/.test(role))throw Error('INVALID_ROLE');
 if(typeof mission!=='string'||mission.length<12||mission.length>400)throw Error('INVALID_MISSION');
 if(typeof reason!=='string'||reason.length<12||reason.length>400)throw Error('JUSTIFICATION_REQUIRED');
 if(!Array.isArray(permissions)||permissions.length>4||permissions.some(p=>!safePermissions.has(p)))throw Error('PRIVILEGED_PERMISSION_NOT_ALLOWED');
 if(!Array.isArray(taskTypes)||taskTypes.length>10||taskTypes.some(x=>typeof x!=='string'||!/^[A-Z_]{3,48}$/.test(x)))throw Error('INVALID_TASK_TYPES');
 return Object.freeze({id,division,role,mission,reason,permissions:[...new Set(permissions)],taskTypes:[...new Set(taskTypes)],
  status:'PROPOSED_REQUIRES_REVIEW',execution:'DISABLED',approvalRequired:true,assignedTasks:0,
  preservation:'NO_LEGACY_DELETION',costBudget:0});
}
export function planTeamExpansion({requests=[],maxProposals=5}={}){
 if(!Array.isArray(requests)||!Number.isInteger(maxProposals)||maxProposals<0||maxProposals>10)throw Error('INVALID_EXPANSION_PLAN');
 const proposed=[],rejected=[],seen=new Set();
 for(const request of requests.slice(0,50)){
  try{const role=proposeSpecialist(request);
   if(seen.has(role.id))throw Error('DUPLICATE_PROPOSAL');
   if(proposed.length>=maxProposals)throw Error('PROPOSAL_BUDGET_EXCEEDED');
   proposed.push(role);seen.add(role.id);
  }catch(e){rejected.push({id:String(request?.id??'unknown'),reason:e instanceof Error?e.message:'INVALID_REQUEST'});}
 }
 return {mode:'REVIEW_ONLY',proposed,rejected,activeNewAgents:0,
  note:'Proposed roles do not run automatically; project owners must review implementations, approved sources and costs.'};
}
