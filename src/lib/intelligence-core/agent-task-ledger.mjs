import {SPECIALIST_AGENTS} from './specialist-network.mjs';
const allowed=new Map(SPECIALIST_AGENTS.map(agent=>[agent.id,agent]));
const validStates=new Set(['PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED']);
export function validateTaskRecord(task){
 if(!task||typeof task!=='object')throw Error('INVALID_TASK');
 const agent=allowed.get(task.agentId);
 if(!agent)throw Error('UNKNOWN_SPECIALIST');
 if(task.division!==agent.division)throw Error('DIVISION_MISMATCH');
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(String(task.taskId??'')))throw Error('INVALID_TASK_ID');
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(String(task.sourceId??'')))throw Error('INVALID_SOURCE_ID');
 if(!/^[A-Z_]{2,48}$/.test(String(task.taskKind??'')))throw Error('INVALID_TASK_KIND');
 const attempts=Number(task.maxAttempts??3);
 if(!Number.isInteger(attempts)||attempts<1||attempts>5)throw Error('INVALID_ATTEMPT_LIMIT');
 const json=JSON.stringify(task.payload??{});
 if(json.length>8192)throw Error('TASK_PAYLOAD_TOO_LARGE');
 return Object.freeze({taskId:task.taskId,agentId:agent.id,division:agent.division,
 sourceId:task.sourceId,taskKind:task.taskKind,payloadJson:json,maxAttempts:attempts});
}
export function assertTaskTransition(before,after){
 if(!validStates.has(before)||!validStates.has(after))throw Error('INVALID_TASK_STATE');
 const permitted={PENDING:['RUNNING','CANCELLED'],RUNNING:['SUCCEEDED','FAILED','PENDING'],
 FAILED:['PENDING','CANCELLED'],SUCCEEDED:[],CANCELLED:[]};
 if(!permitted[before].includes(after))throw Error('INVALID_TASK_TRANSITION');
 return true;
}
