/**
 * EdgeForce research-only guaranteed-payout scanner.
 * Enumerates the Cartesian product of mutually exclusive game outcomes and
 * evaluates each fully filled ticket against every possible joint result.
 * No exchange access, order placement, or implied fill guarantees.
 */
export type ArbGame={id:string;outcomes:string[]};
export type ArbTicket={
 id:string;venue:string;
 /** One exact outcome for each game referenced by this ticket. */
 selections:Record<string,string>;
 stake:number;decimalOdds:number;fees:number;
 /** True only for independently confirmed settled and accepted positions. */
 fullyFilled:boolean;
};
export type ArbScanResult={
 status:'invalid'|'unverified'|'complete';
 scenarios:number;
 totalCost:number;
 worstCaseNet:number|null;
 bestCaseNet:number|null;
 guaranteedProfit:boolean;
 uncoveredScenarios:number;
 warning:string;
};
export function scanGuaranteedPayout(games:ArbGame[],tickets:ArbTicket[],settlementVerified:boolean,maxScenarios=4096):ArbScanResult{
 const warning='Research only: actual accepted quantities, identical settlement/void rules, venue credit risk and all fees must be independently verified. Open limit orders are not guaranteed positions.';
 const result=(status:ArbScanResult['status'],scenarios=0,totalCost=0,worstCaseNet:number|null=null,bestCaseNet:number|null=null,uncoveredScenarios=0):ArbScanResult=>({
  status,scenarios,totalCost,worstCaseNet,bestCaseNet,uncoveredScenarios,
  guaranteedProfit:status==='complete'&&worstCaseNet!==null&&worstCaseNet>0,warning
 });
 if(!Array.isArray(games)||!games.length||!Array.isArray(tickets)||!tickets.length||
  !Number.isSafeInteger(maxScenarios)||maxScenarios<1||
  new Set(games.map(g=>g.id)).size!==games.length||
  games.some(g=>!g.id||!Array.isArray(g.outcomes)||g.outcomes.length<2||
   g.outcomes.some(o=>!o)||new Set(g.outcomes).size!==g.outcomes.length)||
  new Set(tickets.map(t=>t.id)).size!==tickets.length||
  tickets.some(t=>!t.id||!t.venue||!t.selections||typeof t.selections!=='object'||
   !Object.keys(t.selections).length||Object.entries(t.selections).some(([gameId,outcome])=>{
    const game=games.find(g=>g.id===gameId);return !game||!game.outcomes.includes(outcome);
   })||!Number.isFinite(t.stake)||t.stake<=0||
   !Number.isFinite(t.decimalOdds)||t.decimalOdds<1||
   !Number.isFinite(t.fees)||t.fees<0))return result('invalid');
 let count=1;
 for(const g of games){count*=g.outcomes.length;if(count>maxScenarios)return result('invalid');}
 const totalCost=tickets.reduce((n,t)=>n+t.stake+t.fees,0);
 if(!settlementVerified||tickets.some(t=>t.fullyFilled!==true))return result('unverified',count,totalCost);
 let states:Record<string,string>[]=[{}];
 for(const g of games)states=states.flatMap(state=>g.outcomes.map(outcome=>({...state,[g.id]:outcome})));
 let worst=Infinity,best=-Infinity,uncovered=0;
 for(const state of states){
  let payout=0,covered=false;
  for(const ticket of tickets){
   if(Object.entries(ticket.selections).every(([id,outcome])=>state[id]===outcome)){
    payout+=ticket.stake*ticket.decimalOdds;covered=true;
   }
  }
  if(!covered)uncovered++;
  const net=payout-totalCost;
  worst=Math.min(worst,net);best=Math.max(best,net);
 }
 return result('complete',count,totalCost,worst,best,uncovered);
}
