/** Research-only complete-set payoff analysis for three mutually exclusive outcomes. */
export type ThreeWayOutcome='home'|'draw'|'away';
export type Venue='kalshi'|'polymarket_us';
export type ThreeWayQuote={outcome:ThreeWayOutcome;venue:Venue;price:number;feePerContract:number;filledContracts:number};
export type ThreeWayArbResult={
 status:'invalid'|'partial_exposure'|'complete';
 completeSets:number;
 cost:number;
 fees:number;
 payoutByOutcome:Record<ThreeWayOutcome,number>;
 profitByOutcome:Record<ThreeWayOutcome,number>;
 worstCaseProfit:number;
 guaranteedProfit:boolean;
 warning:string;
};
/**
 * Use only when all three YES contracts have independently verified identical
 * settlement scope, including draw, overtime, cancellation and void rules.
 * Fees must be actual per-contract fees for the chosen order type and venue.
 */
export function analyzeThreeWayDip(quotes:ThreeWayQuote[],settlementEquivalent:boolean):ThreeWayArbResult{
 const warning='A limit price touch is not a fill. Maker/taker fees, partial fills, venue settlement, and capital lockup must be verified before any execution.';
 const empty=(status:ThreeWayArbResult['status']):ThreeWayArbResult=>({
  status,completeSets:0,cost:0,fees:0,payoutByOutcome:{home:0,draw:0,away:0},
  profitByOutcome:{home:0,draw:0,away:0},worstCaseProfit:0,guaranteedProfit:false,warning
 });
 if(!settlementEquivalent||!Array.isArray(quotes)||quotes.length!==3||
  new Set(quotes.map(q=>q.outcome)).size!==3||
  quotes.some(q=>!['home','draw','away'].includes(q.outcome)||!['kalshi','polymarket_us'].includes(q.venue)||
   !Number.isFinite(q.price)||q.price<=0||q.price>=1||
   !Number.isFinite(q.feePerContract)||q.feePerContract<0||
   !Number.isSafeInteger(q.filledContracts)||q.filledContracts<0))return empty('invalid');
 const cost=quotes.reduce((n,q)=>n+q.price*q.filledContracts,0);
 const fees=quotes.reduce((n,q)=>n+q.feePerContract*q.filledContracts,0);
 const payoutByOutcome={home:0,draw:0,away:0};
 for(const q of quotes)payoutByOutcome[q.outcome]=q.filledContracts;
 const profitByOutcome={
  home:payoutByOutcome.home-cost-fees,
  draw:payoutByOutcome.draw-cost-fees,
  away:payoutByOutcome.away-cost-fees
 };
 const worstCaseProfit=Math.min(...Object.values(profitByOutcome));
 const completeSets=Math.min(...quotes.map(q=>q.filledContracts));
 const equalFill=quotes.every(q=>q.filledContracts===completeSets);
 return {status:equalFill?'complete':'partial_exposure',completeSets,cost,fees,
  payoutByOutcome,profitByOutcome,worstCaseProfit,
  guaranteedProfit:equalFill&&completeSets>0&&worstCaseProfit>0,warning};
}
