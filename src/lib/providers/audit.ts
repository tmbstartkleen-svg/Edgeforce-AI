import {db} from '../db';
import type {FailoverResult} from './failover';

export async function recordIngestionRun(result:FailoverResult<unknown>,rawCount=0,normalizedCount=0,warnings:string[]=[]){
 const sql=db();
 if(!sql)return;
 await sql`
  insert into provider_ingestion_runs(capability,provider_id,mode,raw_count,normalized_count,warnings,attempts)
  values(
   ${result.capability},${result.providerId??null},${result.ok?'live':'failed'},${rawCount},${normalizedCount},
   ${sql.json(warnings)},${sql.json(result.attempts)}
  )
 `;
}
