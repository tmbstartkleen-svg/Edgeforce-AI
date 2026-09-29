export type PositionState='CANDIDATE'|'OPEN'|'HOLD'|'REDUCE'|'HEDGE'|'CASH_OUT'|'REMOVE'|'SETTLED';

export type LifecycleInput={
 state:PositionState;
 expectedValue:number;
 probability:number;
 stale:boolean;
 drawdownBrake:boolean;
 correlationBreach:boolean;
 cashoutDecision?:'CASH_OUT'|'HOLD'|'NEUTRAL';
 settled?:boolean;
};

export function nextPositionState(x:LifecycleInput):PositionState{
 if(x.settled)return 'SETTLED';
 if(x.stale)return 'REMOVE';
 if(x.cashoutDecision==='CASH_OUT')return 'CASH_OUT';
 if(x.correlationBreach)return 'REDUCE';
 if(x.drawdownBrake&&x.expectedValue>0)return 'REDUCE';
 if(x.expectedValue<=0)return x.state==='OPEN'||x.state==='HOLD'?'REMOVE':'CANDIDATE';
 if(x.probability<.5&&x.state==='OPEN')return 'HEDGE';
 if(x.state==='CANDIDATE')return 'OPEN';
 return 'HOLD';
}
