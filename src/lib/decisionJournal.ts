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
 for(const e of entries){
  await sql`
   insert into decision_journal(market_id,event_id,action,reasons,before_state,after_state,metadata)
   values(${e.marketId??null},${e.eventId??null},${e.action},${sql.json(e.reason)},${sql.json(e.before||{})},${sql.json(e.after||{})},${sql.json(e.metadata||{})})
  `;
  written++;
 }
 return {written,mode:'database' as const};
}
