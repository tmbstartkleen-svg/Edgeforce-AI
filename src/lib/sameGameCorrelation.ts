export type CorrelationLeg={
 id:string;
 event:string;
 sport:string;
 market:string;
 selection:string;
 playerContext?:{
  name:string;
  team?:string;
 };
 simProbability:number;
};

const lower=(s:string)=>s.toLowerCase();
const sameEvent=(a:CorrelationLeg,b:CorrelationLeg)=>a.event===b.event;
const sameSport=(a:CorrelationLeg,b:CorrelationLeg)=>a.sport===b.sport;
const isOver=(x:CorrelationLeg)=>lower(`${x.market} ${x.selection}`).includes('over');
const isUnder=(x:CorrelationLeg)=>lower(`${x.market} ${x.selection}`).includes('under');
const sameDirection=(a:CorrelationLeg,b:CorrelationLeg)=>(isOver(a)&&isOver(b))||(isUnder(a)&&isUnder(b));
const playerName=(x:CorrelationLeg)=>x.playerContext?.name?.toLowerCase()||'';
const team=(x:CorrelationLeg)=>x.playerContext?.team?.toLowerCase()||'';
const isPlayer=(x:CorrelationLeg)=>Boolean(x.playerContext)||lower(x.market).includes('player')||lower(x.market).includes('prop');

export function sameGameCorrelation(a:CorrelationLeg,b:CorrelationLeg){
 if(a.id===b.id)return 1;
 let c=0;
 if(!sameEvent(a,b)){
  if(sameSport(a,b))c+=.015;
  return Math.max(-.35,Math.min(.35,c));
 }

 c+=.04;

 if(isPlayer(a)&&isPlayer(b)){
  if(playerName(a)&&playerName(a)===playerName(b)){
   c+=sameDirection(a,b)?.30:-.22;
  }else if(team(a)&&team(a)===team(b)){
   c+=sameDirection(a,b)?.12:-.08;
  }else if(team(a)&&team(b)&&team(a)!==team(b)){
   c+=sameDirection(a,b)?.04:-.03;
  }
 }

 const aText=lower(`${a.market} ${a.selection}`);
 const bText=lower(`${b.market} ${b.selection}`);
 const aTeamMarket=!isPlayer(a)&&(aText.includes('money')||aText.includes('spread')||aText.includes('total'));
 const bTeamMarket=!isPlayer(b)&&(bText.includes('money')||bText.includes('spread')||bText.includes('total'));

 if(isPlayer(a)&&bTeamMarket)c+=sameDirection(a,b)?.08:-.05;
 if(isPlayer(b)&&aTeamMarket)c+=sameDirection(a,b)?.08:-.05;

 if(aText.includes('total')&&bText.includes('total'))c+=sameDirection(a,b)?.10:-.10;
 if(aText.includes('spread')&&bText.includes('money'))c+=.14;
 if(bText.includes('spread')&&aText.includes('money'))c+=.14;

 return Math.max(-.35,Math.min(.35,c));
}

export function correlationExposure(a:CorrelationLeg,b:CorrelationLeg){
 return Math.abs(sameGameCorrelation(a,b));
}

export function correlationAdjustedJoint(legs:CorrelationLeg[]){
 const joint=legs.reduce((p,x)=>p*x.simProbability,1);
 let adjustment=0;
 for(let i=0;i<legs.length;i++){
  for(let j=i+1;j<legs.length;j++){
   adjustment+=sameGameCorrelation(legs[i],legs[j])*.28;
  }
 }
 const multiplier=Math.max(.45,Math.min(1.55,1+adjustment));
 return {
  independent:joint,
  adjusted:Math.max(.000001,Math.min(.999999,joint*multiplier)),
  adjustment:multiplier-1
 };
}
