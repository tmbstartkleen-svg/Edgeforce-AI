import {db} from '@/lib/db';

export const dynamic='force-dynamic';
function authorized(req:Request){const key=process.env.EDGEFORCE_WRITE_KEY;return !key||req.headers.get('x-edgeforce-write-key')===key}

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({configured:false,transactions:[],totals:{deposits:0,withdrawals:0,fees:0,netCashFlow:0}});
 try{
  const transactions=await sql`select id,occurred_at as "occurredAt",platform,transaction_type as "transactionType",amount::float,payment_method as "paymentMethod",fee::float,source_reference as "sourceReference",notes from cash_transactions order by occurred_at desc limit 500`;
  const [totals]=await sql`select coalesce(sum(case when transaction_type='deposit' then amount else 0 end),0)::float as deposits,coalesce(sum(case when transaction_type='withdrawal' then amount else 0 end),0)::float as withdrawals,coalesce(sum(fee),0)::float as fees from cash_transactions`;
  return Response.json({configured:true,transactions,totals:{...totals,netCashFlow:Number(totals.deposits)-Number(totals.withdrawals)-Number(totals.fees)}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({configured:true,error:error instanceof Error?error.message:'ledger error',transactions:[]},{status:200})}
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'Unauthorized'},{status:401});
 const sql=db();if(!sql)return Response.json({ok:false,error:'Database is not configured'},{status:503});
 const body=await req.json().catch(()=>({})) as {occurredAt?:string;platform?:string;transactionType?:'deposit'|'withdrawal'|'fee'|'adjustment';amount?:number;paymentMethod?:string;fee?:number;sourceReference?:string;notes?:string};
 if(!body.transactionType||!Number.isFinite(body.amount)||Number(body.amount)<=0)return Response.json({ok:false,error:'transactionType and positive amount are required'},{status:400});
 const [row]=await sql`insert into cash_transactions(occurred_at,platform,transaction_type,amount,payment_method,fee,source_reference,notes) values(${body.occurredAt||new Date().toISOString()},${body.platform||'DraftKings'},${body.transactionType},${body.amount},${body.paymentMethod||null},${body.fee||0},${body.sourceReference||null},${body.notes||null}) returning id`;
 return Response.json({ok:true,id:row.id});
}
