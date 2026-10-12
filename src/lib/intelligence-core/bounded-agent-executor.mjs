import {assertTaskTransition} from './agent-task-ledger.mjs';

/** Claim jobs atomically in D1. No external fetches or executions occur here. */
export async function claimDueTask(db,{workerId,now=new Date().toISOString()}={}){
 if(!db?.prepare)throw Error('D1_NOT_BOUND');
 if(!/^[a-zA-Z0-9:_-]{1,64}$/.test(String(workerId??'')))throw Error('INVALID_WORKER_ID');
 const task=await db.prepare(`SELECT task_id,agent_id,division,source_id,task_kind,attempts,max_attempts
 FROM specialist_tasks WHERE task_state='PENDING'
 AND attempts < max_attempts AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
 ORDER BY created_at ASC LIMIT 1`).bind(now).first();
 if(!task)return null;
 const changed=await db.prepare(`UPDATE specialist_tasks SET task_state='RUNNING',
 attempts=attempts+1,updated_at=?,last_error=NULL
 WHERE task_id=? AND task_state='PENDING' AND attempts=?`)
 .bind(now,task.task_id,task.attempts).run();
 if(Number(changed.meta?.changes??0)!==1)return null;
 await db.prepare(`INSERT INTO specialist_task_events(task_id,state,detail)
 VALUES (?,'RUNNING',?)`).bind(task.task_id,workerId).run();
 return {...task,attempts:task.attempts+1,task_state:'RUNNING'};
}
export async function finishTask(db,{taskId,success,error='',now=new Date().toISOString()}={}){
 if(!db?.prepare)throw Error('D1_NOT_BOUND');
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(String(taskId??'')))throw Error('INVALID_TASK_ID');
 const state=success?'SUCCEEDED':'FAILED';
 assertTaskTransition('RUNNING',state);
 const changed=await db.prepare(`UPDATE specialist_tasks SET task_state=?,
 last_error=?,updated_at=? WHERE task_id=? AND task_state='RUNNING'`)
 .bind(state,String(error).slice(0,200),now,taskId).run();
 if(Number(changed.meta?.changes??0)!==1)return false;
 await db.prepare('INSERT INTO specialist_task_events(task_id,state,detail) VALUES (?,?,?)')
 .bind(taskId,state,success?'':String(error).slice(0,200)).run();
 return true;
}
