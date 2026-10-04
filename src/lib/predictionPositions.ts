import {db} from './db';
import type {PredictionContract} from './predictionMarkets';
import {evaluatePredictionPositions,type PredictionPosition,type PredictionPositionSide} from './predictionPositionIntelligence';

const hourBucket=(date=new Date())=>{
 const d=new Date(date);
 d.setUTCMinutes(0,0,0);
 return d.toISOString();
};

export type PredictionPositionInput={
 venue:string;
 contractId:string;
 title:string;
 category?:string;
 side:PredictionPositionSide;
 quantity:number;
 avgEntryProbability:number;
 entryFee?:number;
 fairProbabilityAtEntry?:number;
 modelSource?:string;
 openedAt?:string;
 notes?:string;
 metadata?:Record<string,unknown>;
};

export async function loadOpenPredictionPositions():Promise<PredictionPosition[]>{
 const sql=db();
 if(!sql)return [];
 const rows=await sql`
  select id,venue,contract_id as "contractId",title,category,side,
   quantity::float,avg_entry_probability::float as "avgEntryProbability",
   entry_fee::float as "entryFee",
   fair_probability_at_entry::float as "fairProbabilityAtEntry",
   model_source as "modelSource",opened_at as "openedAt",notes
  from prediction_positions
  where status='open'
  order by opened_at desc
 `;
 return (rows as any[]).map(row=>({
  ...row,
  id:Number(row.id),
  quantity:Number(row.quantity),
  avgEntryProbability:Number(row.avgEntryProbability),
  entryFee:Number(row.entryFee||0),
  fairProbabilityAtEntry:row.fairProbabilityAtEntry===null?undefined:Number(row.fairProbabilityAtEntry),
  openedAt:new Date(row.openedAt).toISOString()
 }));
}

export async function recordPredictionPosition(input:PredictionPositionInput){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,id:null};
 if(!input.venue.trim()||!input.contractId.trim()||!input.title.trim())throw new Error('venue, contractId, and title are required');
 if(input.side!=='YES'&&input.side!=='NO')throw new Error('side must be YES or NO');
 if(!Number.isFinite(input.quantity)||input.quantity<=0)throw new Error('quantity must be greater than zero');
 if(!Number.isFinite(input.avgEntryProbability)||input.avgEntryProbability<=0||input.avgEntryProbability>=1)throw new Error('avgEntryProbability must be between 0 and 1');
 const [row]=await sql`
  insert into prediction_positions(
   venue,contract_id,title,category,side,quantity,avg_entry_probability,entry_fee,
   fair_probability_at_entry,model_source,opened_at,notes,metadata
  ) values(
   ${input.venue},${input.contractId},${input.title},${input.category||'OTHER'},${input.side},
   ${input.quantity},${input.avgEntryProbability},${Math.max(0,input.entryFee||0)},
   ${input.fairProbabilityAtEntry??null},${input.modelSource??null},
   ${input.openedAt||new Date().toISOString()},${input.notes??null},
   ${sql.json((input.metadata||{}) as any)}
  )
  returning id
 `;
 return {ok:true,mode:'database' as const,id:Number(row.id)};
}

export async function closePredictionPosition(id:number,realizedPnl?:number){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,id};
 const rows=await sql`
  update prediction_positions
  set status='closed',closed_at=now(),realized_pnl=${realizedPnl??null}
  where id=${id} and status='open'
  returning id
 `;
 if(!rows.length)throw new Error('open prediction position not found');
 return {ok:true,mode:'database' as const,id};
}

export async function persistPredictionPositionMarks(contracts:PredictionContract[]){
 const sql=db();
 if(!sql)return {positions:0,written:0,mode:'memory' as const};
 const positions=await loadOpenPredictionPositions();
 if(!positions.length)return {positions:0,written:0,mode:'database' as const};
 const evaluated=evaluatePredictionPositions(positions,contracts);
 const observedHour=hourBucket();
 let written=0;
 for(const item of evaluated){
  const inserted=await sql`
   insert into prediction_position_marks(
    prediction_position_id,observed_hour,current_probability,bid_probability,ask_probability,
    executable_exit_probability,fair_probability,fair_source,fair_confidence,
    remaining_edge,unrealized_pnl,action,timing,score,reasons,risk_flags,raw
   ) values(
    ${item.position.id},${observedHour},${item.current?.probability??null},
    ${item.current?.bidProbability??null},${item.current?.askProbability??null},
    ${item.current?.executableExitProbability??null},${item.fair?.sideProbability??null},
    ${item.fair?.source??null},${item.fair?.confidence??null},
    ${item.remainingEdge},${item.unrealizedPnl},${item.action},${item.timing},${item.score},
    ${sql.json(item.reasons as any)},${sql.json(item.riskFlags as any)},${sql.json(item as any)}
   )
   on conflict (prediction_position_id,observed_hour) do update set
    current_probability=excluded.current_probability,
    bid_probability=excluded.bid_probability,
    ask_probability=excluded.ask_probability,
    executable_exit_probability=excluded.executable_exit_probability,
    fair_probability=excluded.fair_probability,
    fair_source=excluded.fair_source,
    fair_confidence=excluded.fair_confidence,
    remaining_edge=excluded.remaining_edge,
    unrealized_pnl=excluded.unrealized_pnl,
    action=excluded.action,
    timing=excluded.timing,
    score=excluded.score,
    reasons=excluded.reasons,
    risk_flags=excluded.risk_flags,
    raw=excluded.raw
   returning id
  `;
  written+=inserted.length;
 }
 return {positions:positions.length,written,mode:'database' as const};
}