import {evaluatePredictionPositions,type PredictionPosition} from '@/lib/predictionPositionIntelligence';
import type {PredictionContract} from '@/lib/predictionMarkets';

export const dynamic='force-dynamic';

function contract(id:string,title:string,yes:number,bid:number,ask:number):PredictionContract{
 return {id,source:'Kalshi',title,category:'Test',yesProbability:yes,noProbability:1-yes,modelProbability:yes,probabilityDifference:0,bidProbability:bid,askProbability:ask,volume:50000,liquidity:25000};
}

function position(id:number,contractId:string,title:string,entry:number,fair:number):PredictionPosition{
 return {id,venue:'Kalshi',contractId,title,category:'TEST',side:'YES',quantity:100,avgEntryProbability:entry,entryFee:0,fairProbabilityAtEntry:fair,modelSource:'deterministic-test-fair',openedAt:new Date().toISOString()};
}

export async function GET(){
 const contracts:PredictionContract[]=[
  contract('k-add','Will Alpha win the championship?',.445,.44,.45),
  contract('k-profit','Will Beta win the championship?',.705,.70,.71),
  contract('k-exit','Will Gamma win the championship?',.505,.50,.51)
 ];
 const positions:PredictionPosition[]=[
  position(1,'k-add','Will Alpha win the championship?',.40,.60),
  position(2,'k-profit','Will Beta win the championship?',.40,.62),
  position(3,'k-exit','Will Gamma win the championship?',.65,.52)
 ];
 const evaluated=evaluatePredictionPositions(positions,contracts);
 const byId=new Map(evaluated.map(x=>[x.position.id,x]));
 const ok=byId.get(1)?.action==='ADD'&&byId.get(2)?.action==='TAKE_PROFIT'&&byId.get(3)?.action==='EXIT';
 return Response.json({ok,actions:evaluated.map(x=>({id:x.position.id,action:x.action,timing:x.timing,score:x.score,edge:x.remainingEdge,pnl:x.unrealizedPnl,fair:x.fair}))},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}