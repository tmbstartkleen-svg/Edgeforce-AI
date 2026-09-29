import {db} from './db';
import type {EdgeAlert} from './alerts';

export async function writeAlerts(alerts:EdgeAlert[]){
 const sql=db();
 if(!sql)return {written:0,mode:'memory' as const};
 let written=0;
 for(const a of alerts){
  await sql`
   insert into alerts(alert_type,severity,market_id,message,payload)
   values(${a.type},${a.severity},${a.marketId??null},${a.message},${sql.json({createdAt:a.createdAt})})
  `;
  written++;
 }
 return {written,mode:'database' as const};
}
