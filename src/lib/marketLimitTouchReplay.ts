/**
 * Deterministic, read-only reconstruction of whether a YES limit was touched.
 * Trade prints establish price touches, not queue position or executable fills.
 */
export type MarketTradePrint={timestamp:string;price:number;size:number};
export type LimitTouchReplayInput={
 gameId:string;
 forecastCreatedAt:string;
 gameStartedAt:string;
 gameEndedAt:string;
 /** Provider-confirmed full historical coverage through game end. */
 historyComplete:boolean;
 limitPrice:number;
 prints:MarketTradePrint[];
};
export type LimitTouchReplayResult={
 status:'invalid'|'insufficient_evidence'|'ok';
 observedTouch:boolean|null;
 firstTouchAt:string|null;
 printsExamined:number;
 warning:string;
};
export function replayLimitTouches(input:LimitTouchReplayInput):LimitTouchReplayResult{
 const warning='Historical prints only: a trade at or below a limit does not prove that a resting order would have filled. No live order submission.';
 const empty=(status:LimitTouchReplayResult['status']):LimitTouchReplayResult=>({status,observedTouch:null,firstTouchAt:null,printsExamined:0,warning});
 const forecast=Date.parse(input.forecastCreatedAt),start=Date.parse(input.gameStartedAt),end=Date.parse(input.gameEndedAt);
 if(!input.gameId||!Number.isFinite(forecast)||!Number.isFinite(start)||!Number.isFinite(end)||forecast>=start||end<=start||
 !Number.isFinite(input.limitPrice)||input.limitPrice<=0||input.limitPrice>=1||
 !Array.isArray(input.prints)||input.prints.some(p=>!Number.isFinite(Date.parse(p.timestamp))||
 !Number.isFinite(p.price)||p.price<0||p.price>1||!Number.isFinite(p.size)||p.size<=0))return empty('invalid');
 if(input.historyComplete!==true)return empty('insufficient_evidence');
 const inGame=input.prints.filter(p=>Date.parse(p.timestamp)>=start&&Date.parse(p.timestamp)<=end).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 if(!inGame.length)return empty('insufficient_evidence');
 const first=inGame.find(p=>p.price<=input.limitPrice);
 return {status:'ok',observedTouch:Boolean(first),firstTouchAt:first?.timestamp??null,printsExamined:inGame.length,warning};
}
