import {db} from '@/lib/db';
import {reconcileLedgerResults} from '@/lib/ledger';

export async function POST(req:Request){
  const auth=req.headers.get('authorization');
  if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
  const body=await req.json();
  const results=Array.isArray(body)?body:Array.isArray(body?.results)?body.results:[];
  const sql=db();
  if(!sql){
    const reconciliation=await reconcileLedgerResults(results);
    return Response.json({ok:true,mode:'dry-run',received:results.length,reconciliation});
  }
  let written=0;
  for(const r of results){
    await sql`
      insert into bet_results(event_id,market_key,selection_key,offered_odds,closing_odds,result,clv,pnl,stake,model_probability,settled_at)
      values(
        ${r.eventId},${r.marketKey},${r.selectionKey},${r.offeredOdds??null},${r.closingOdds??null},
        ${r.result??null},${r.clv??null},${r.pnl??null},${r.stake??null},${r.modelProbability??null},
        ${r.settledAt??new Date().toISOString()}
      )
    `;
    written++;
  }
  const reconciliation=await reconcileLedgerResults(results);
  return Response.json({ok:true,mode:'database',written,reconciliation});
}
