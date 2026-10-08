import{t as e}from"./db-9LtqYd6N.js";import"./marketMovementLearning-Ce-G0UXL.js";import{r as t}from"./ledger-kDhHVBLF.js";import"./lineMovement-OCYGnOHi.js";import{t as n}from"./predictionFeedback-B_6Coer0.js";async function r(r){let i=r.headers.get(`authorization`);if(process.env.INGEST_SECRET&&i!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:!1,error:`unauthorized`},{status:401});let a=await r.json(),o=Array.isArray(a)?a:Array.isArray(a?.results)?a.results:[],s=e();if(!s){let e=await t(o);return Response.json({ok:!0,mode:`dry-run`,received:o.length,reconciliation:e})}let c=0;for(let e of o)await s`
      insert into bet_results(event_id,market_key,selection_key,offered_odds,closing_odds,result,clv,pnl,stake,model_probability,settled_at)
      values(
        ${e.eventId},${e.marketKey},${e.selectionKey},${e.offeredOdds??null},${e.closingOdds??null},
        ${e.result??null},${e.clv??null},${e.pnl??null},${e.stake??null},${e.modelProbability??null},
        ${e.settledAt??new Date().toISOString()}
      )
    `,c++;let[l,u]=await Promise.all([t(o),n(o)]);return Response.json({ok:!0,mode:`database`,written:c,reconciliation:l,feedback:u})}export{r as POST};