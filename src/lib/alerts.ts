export type AlertSeverity='INFO'|'WATCH'|'ACTION';
export type EdgeAlert={
 type:'LINE_MOVE'|'STALE_LINE'|'INJURY'|'WEATHER'|'EDGE_CHANGE'|'PORTFOLIO'|'CASHOUT';
 severity:AlertSeverity;
 marketId?:string;
 message:string;
 createdAt:string;
};

export function staleLineAlert(marketId:string,sourceAgeMin:number):EdgeAlert|null{
 if(sourceAgeMin<=20)return null;
 return {type:'STALE_LINE',severity:sourceAgeMin>60?'ACTION':'WATCH',marketId,message:`Market source is ${sourceAgeMin.toFixed(0)} minutes old`,createdAt:new Date().toISOString()};
}

export function edgeChangeAlert(marketId:string,previousEv:number,currentEv:number):EdgeAlert|null{
 const delta=currentEv-previousEv;
 if(Math.abs(delta)<.02)return null;
 return {type:'EDGE_CHANGE',severity:Math.abs(delta)>=.05?'ACTION':'WATCH',marketId,message:`Expected value changed ${(delta*100).toFixed(1)} percentage points`,createdAt:new Date().toISOString()};
}
