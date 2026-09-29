import {db} from './db';

export type JournalEntry={
 marketId?:string;
 eventId?:string;
 action:string;
 reason:string[];
 before?:Record<string,unknown>;
 after?:Record<string,unknown>;
 metadata?:Record<string,unknown>;
};

export async function writeDecisionJournal(entries:JournalEntry[]){
 const sql=db();
 if(!sql)return {written:0,mode:'memory' as const};
 let written=0;
 const json=(value:unknown)=>sql.json(value as any);
 for(const e of entries){
  await sql`
   insert into decision_journal(market_id,event_id,action,reasons,before_state,after_state,metadata)
   values(${e.marketId??null},${e.eventId??null},${e.action},${json(e.reason)},${json(e.before||{})},${json(e.after||{})},${json(e.metadata||{})})
  `;
  written++;
 }
 return {written,mode:'database' as const};
}
