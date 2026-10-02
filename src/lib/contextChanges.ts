import type {Market} from './types';

export type ContextChangeType=
 'LINE_MOVE'|'INJURY'|'LINEUP'|'STARTER'|'GOALIE'|'QUARTERBACK'|'WEATHER'|'PLAYER_PROJECTION'|'PLAYER_STATUS'|'PLAYER_AVAILABILITY';

export type ContextChangeEvent={
 id:string;
 marketId:string;
 event:string;
 selection:string;
 sport:string;
 type:ContextChangeType;
 severity:'INFO'|'WATCH'|'ACTION';
 reason:string;
 before?:unknown;
 after?:unknown;
 detectedAt:string;
 requiresResimulation:true;
};

const num=(v:unknown)=>{
 const n=Number(v);
 return Number.isFinite(n)?n:undefined;
};
const changed=(a:unknown,b:unknown,threshold=0)=>{
 const x=num(a),y=num(b);
 if(x===undefined&&y===undefined)return false;
 if(x===undefined||y===undefined)return true;
 return Math.abs(y-x)>=threshold;
};
const textChanged=(a:unknown,b:unknown)=>{
 const x=String(a??'').trim().toLowerCase();
 const y=String(b??'').trim().toLowerCase();
 return x!==y;
};
export const contextMarketKey=(m:Market)=>[m.id,m.market,m.selection].join('|');
const eventId=(m:Market,type:ContextChangeType,reason:string)=>`${contextMarketKey(m)}|${type}|${reason}`;

function push(out:ContextChangeEvent[],m:Market,type:ContextChangeType,severity:ContextChangeEvent['severity'],reason:string,before?:unknown,after?:unknown){
 out.push({
  id:eventId(m,type,reason),
  marketId:m.id,event:m.event,selection:m.selection,sport:m.sport,type,severity,reason,before,after,
  detectedAt:new Date().toISOString(),requiresResimulation:true
 });
}

export function detectMaterialContextChanges(previous:Market[],current:Market[]):ContextChangeEvent[]{
 if(!previous.length||!current.length)return [];
 const prior=new Map(previous.map(m=>[contextMarketKey(m),m]));
 const out:ContextChangeEvent[]=[];

 for(const m of current){
  const p=prior.get(contextMarketKey(m));
  if(!p)continue;

  const marketDelta=Math.abs((m.marketProb??0)-(p.marketProb??0));
  if(m.odds!==p.odds||marketDelta>=.012){
   push(out,m,'LINE_MOVE',marketDelta>=.03?'ACTION':'WATCH',
    `Market moved from ${p.odds} to ${m.odds}; implied probability delta ${(marketDelta*100).toFixed(1)} pts`,
    {odds:p.odds,marketProb:p.marketProb},{odds:m.odds,marketProb:m.marketProb});
  }

  const pf=p.sportFeatures||{},cf=m.sportFeatures||{};
  const featureChecks:Array<[string,ContextChangeType,number,ContextChangeEvent['severity']]>= [
   ['injury','INJURY',.08,'ACTION'],
   ['lineup','LINEUP',.08,'ACTION'],
   ['starter','STARTER',.08,'ACTION'],
   ['goalie','GOALIE',.08,'ACTION'],
   ['quarterback','QUARTERBACK',.08,'ACTION'],
   ['weather','WEATHER',.15,'WATCH']
  ];
  for(const [feature,type,threshold,severity] of featureChecks){
   if(changed(pf[feature],cf[feature],threshold)){
    push(out,m,type,severity,`${feature} context changed materially`,pf[feature],cf[feature]);
   }
  }

  const pp=p.playerContext,cp=m.playerContext;
  if(pp||cp){
   if(textChanged(pp?.status,cp?.status)){
    push(out,m,'PLAYER_STATUS','ACTION','Player status changed',pp?.status,cp?.status);
   }
   if(pp?.starter!==cp?.starter&&!(pp?.starter===undefined&&cp?.starter===undefined)){
    push(out,m,'STARTER','ACTION','Player starting designation changed',pp?.starter,cp?.starter);
   }
   if(changed(pp?.availability,cp?.availability,.05)){
    push(out,m,'PLAYER_AVAILABILITY','ACTION','Player availability changed by at least 5 percentage points',pp?.availability,cp?.availability);
   }
   const beforeProj=num(pp?.projection),afterProj=num(cp?.projection);
   if(beforeProj!==undefined||afterProj!==undefined){
    const absolute=beforeProj===undefined||afterProj===undefined?Infinity:Math.abs(afterProj-beforeProj);
    const relative=beforeProj&&afterProj!==undefined?absolute/Math.max(.01,Math.abs(beforeProj)):Infinity;
    if(absolute>=.5||relative>=.03){
     push(out,m,'PLAYER_PROJECTION',relative>=.08?'ACTION':'WATCH','Player projection changed materially',beforeProj,afterProj);
    }
   }
  }
 }

 return out;
}

export function contextRevision(markets:Market[]){
 const stable=markets.map(m=>({
  id:m.id,market:m.market,selection:m.selection,odds:m.odds,marketProb:m.marketProb,
  features:m.sportFeatures||{},player:m.playerContext||null
 })).sort((a,b)=>(a.id+a.market+a.selection).localeCompare(b.id+b.market+b.selection));
 const s=JSON.stringify(stable);
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16).padStart(8,'0');
}
