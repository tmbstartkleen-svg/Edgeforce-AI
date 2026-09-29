import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',points:[]});
 const points=await sql`
  select ps.generated_at as "at",
   coalesce(ba.current_bankroll,ba.starting_bankroll) as bankroll,
   ps.total_stake as "totalStake",
   ps.expected_profit as "expectedProfit",
   ps.drawdown_pct as "drawdownPct"
  from portfolio_snapshots ps
  left join bankroll_accounts ba on ba.id=ps.bankroll_account_id
  order by ps.generated_at asc
  limit 500
 `;
 return Response.json({source:'database',points});
}
