import{t as e}from"./db-9LtqYd6N.js";var t=`force-dynamic`;async function n(){let t=e();if(!t)return Response.json({configured:!1,ok:!1,counts:{}});try{let[e]=await t`
      select
        (select count(*)::int from athletes) as athletes,
        (select count(*)::int from player_game_stats) as player_game_stats,
        (select count(*)::int from market_snapshots) as market_snapshots,
        (select count(*)::int from market_consensus_snapshots) as market_consensus_snapshots,
        (select count(*)::int from model_runs) as model_runs,
        (select count(*)::int from bet_results) as bet_results,
        (select count(*)::int from automation_runs) as automation_runs,
        (select count(*)::int from production_certifications) as production_certifications,
        (select count(*)::int from model_governance_runs) as model_governance_runs,
        (select count(*)::int from model_governance_snapshots) as model_governance_snapshots,
        (select count(*)::int from validation_runs) as validation_runs,
        (select count(*)::int from validation_snapshots) as validation_snapshots,
        (select count(*)::int from bet_slips) as bet_slips,
        (select count(*)::int from bet_slips where result='open') as open_wagers,
        (select count(*)::int from bet_slips where result in ('win','loss','push')) as settled_wagers
    `;return Response.json({configured:!0,ok:!0,counts:e},{headers:{"Cache-Control":`no-store`}})}catch(e){return Response.json({configured:!0,ok:!1,counts:{},error:e instanceof Error?e.message:`db stats error`},{status:200})}}export{n as GET,t as dynamic};