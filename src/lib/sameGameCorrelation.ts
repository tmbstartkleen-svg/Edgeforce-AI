import type {Scanned} from './scanner';

const lower=(s:string)=>s.toLowerCase();
const sameEvent=(a:Scanned,b:Scanned)=>a.event===b.event;
const sameSport=(a:Scanned,b:Scanned)=>a.sport===b.sport;
const isOver=(x:Scanned)=>lower(`${x.market} ${x.selection}`).includes('over');
const isUnder=(x:Scanned)=>lower(`${x.market} ${x.selection}`).includes('under');
const sameDirection=(a:Scanned,b:Scanned)=>(isOver(a)&&isOver(b))||(isUnder(a)&&isUnder(b));
const playerName=(x:Scanned)=>x.playerContext?.name?.toLowerCase()||'';
const team=(x:Scanned)=>x.playerContext?.team?.toLowerCase()||'';
const isPlayer=(x:Scanned)=>Boolean(x.playerContext)||lower(x.market).includes('player')||lower(x.market).includes('prop');

export function sameGameCorrelation(a:Scanned,b:Scanned){
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

export function correlationExposure(a:Scanned,b:Scanned){
 return Math.abs(sameGameCorrelation(a,b));
}

export function correlationAdjustedJoint(legs:Scanned[]){
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
