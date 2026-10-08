import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,points:[]});let n=await t`
  select ps.generated_at as "at",
   ba.current_bankroll as bankroll,
   ps.total_stake as "totalStake",
   ps.expected_profit as "expectedProfit",
   ps.expected_roi as "expectedRoi",
   ps.drawdown_pct as "drawdownPct"
  from portfolio_snapshots ps
  left join bankroll_accounts ba on ba.id=ps.bankroll_account_id
  order by ps.generated_at desc limit 200
 `;return Response.json({source:`database`,points:n.reverse()})}export{t as GET};