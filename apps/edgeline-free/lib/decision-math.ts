export function scenarioProbability(rows:{weight:number;probability:number}[]){
 if(!rows.length||rows.some(r=>!Number.isFinite(r.weight)||!Number.isFinite(r.probability)||r.weight<0||r.probability<0||r.probability>1)||Math.abs(rows.reduce((s,r)=>s+r.weight,0)-1)>1e-6)return null;
 return rows.reduce((s,r)=>s+r.weight*r.probability,0);
}
export function contractPlan(p:number,uncertainty:number,cost:number,edge:number,entry:number,targetProfit:number){
 if([p,uncertainty,cost,edge,entry,targetProfit].some(n=>!Number.isFinite(n)||n<0)||p>1||uncertainty>1||entry>=1)return null;
 const maxBuy=p-uncertainty-cost-edge;const sellTarget=entry+cost+targetProfit;
 return {maxBuy:maxBuy>0&&maxBuy<1?maxBuy:null,sellTarget:sellTarget>0&&sellTarget<1?sellTarget:null};
}
export function rollingSequences(quotes:any[],events:any[],now:number,hours:number){
 const byId=new Map(events.map(e=>[e.id,e]));const candidates=quotes.filter(q=>q.marketKey==='h2h'&&Number.isFinite(q.price)&&q.price<=-200&&Date.parse(q.updatedAt)<=now&&now-Date.parse(q.updatedAt)<=300000&&Date.parse(byId.get(q.eventId)?.startsAt)>now&&Date.parse(byId.get(q.eventId)?.startsAt)+4*3600000<=now+hours*3600000).sort((a,b)=>Date.parse(byId.get(a.eventId).startsAt)-Date.parse(byId.get(b.eventId).startsAt));
 const result:any[][]=[];for(let i=0;i<candidates.length&&result.length<20;i++){const legs=[candidates[i]];if(legs[0].price>-400)continue;for(let j=i+1;j<candidates.length&&legs.length<5;j++){const q=candidates[j],last=legs[legs.length-1];if(legs.some(l=>l.eventId===q.eventId)||Date.parse(byId.get(q.eventId).startsAt)-Date.parse(byId.get(last.eventId).startsAt)<4.5*3600000)continue;if(last.price>-400)break;legs.push(q);result.push([...legs]);if(result.length>=20)break;}}
 return result;
}
