import type {FinalDecisionRow} from './finalDecisionGate';
import type {EdgeLifecycleRow} from './edgeLifecycle';
import type {EarlyCashoutLadder} from './earlyCashout';

export type CommandSeverity='CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
export type CommandType='PRIME_RECHECK'|'READY_RECHECK'|'EDGE_WEAKENING'|'EDGE_EXIT'|'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';

export type OpportunityCommand={
 id:string;
 type:CommandType;
 severity:CommandSeverity;
 domain:'SPORTS'|'MARKETS';
 category:string;
 title:string;
 action:string;
 score:number;
 expiresAt?:string;
 dedupeKey:string;
 cooldownMinutes:number;
 reasons:string[];
};

const severityRank:Record<CommandSeverity,number>={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};

export function buildOpportunityCommandQueue(input:{
 decisions:FinalDecisionRow[];
 lifecycle:EdgeLifecycleRow[];
 cashout:EarlyCashoutLadder;
}){
 const commands:OpportunityCommand[]=[];

 for(const row of input.decisions){
  if(row.state==='PRIME'){
   commands.push({
    id:'prime:'+row.id,type:'PRIME_RECHECK',severity:'HIGH',domain:row.domain,category:row.category,title:row.title,
    action:'Re-check current price, timing and best venue now.',
    score:row.actionabilityScore,dedupeKey:'decision:'+row.id,cooldownMinutes:15,reasons:row.reasons
   });
  }else if(row.state==='READY'){
   commands.push({
    id:'ready:'+row.id,type:'READY_RECHECK',severity:'MEDIUM',domain:row.domain,category:row.category,title:row.title,
    action:'Keep near the top of the board and re-check before the next material price move.',
    score:row.actionabilityScore,dedupeKey:'decision:'+row.id,cooldownMinutes:30,reasons:row.reasons
   });
  }
 }

 for(const row of input.lifecycle){
  if(row.lifecycleState==='WEAKENING'){
   commands.push({
    id:'weak:'+row.id,type:'EDGE_WEAKENING',severity:'MEDIUM',domain:row.domain,category:row.category,title:row.title,
    action:'Reduce priority and re-check whether the original edge still exists.',
    score:Math.max(0,1-row.masterScore),dedupeKey:'lifecycle:'+row.id,cooldownMinutes:20,reasons:[row.reason]
   });
  }else if(row.lifecycleState==='DECAYED'||row.lifecycleState==='EXIT'){
   commands.push({
    id:'exit:'+row.id,type:'EDGE_EXIT',severity:'HIGH',domain:row.domain,category:row.category,title:row.title,
    action:'Remove from active analytical priority.',
    score:1,dedupeKey:'lifecycle:'+row.id,cooldownMinutes:60,reasons:[row.reason]
   });
  }
 }

 const finalLeg=input.cashout.finalRiskLeg;
 for(const checkpoint of input.cashout.checkpointPlan){
  const isFinal=checkpoint.afterLeg===input.cashout.legCount-1;
  commands.push({
   id:'cashout:'+checkpoint.afterLeg+':'+(finalLeg?.id||'ladder'),
   type:isFinal?'FINAL_LEG_REVIEW':'CASHOUT_REVIEW',
   severity:isFinal?'CRITICAL':'MEDIUM',
   domain:'SPORTS',
   category:'EARLY_CASHOUT',
   title:isFinal?'Early Cash-Out Ladder — before final risk leg':checkpoint.label,
   action:checkpoint.instruction,
   score:isFinal?.95:.65,
   expiresAt:isFinal?finalLeg?.startTime:undefined,
   dedupeKey:'cashout:'+checkpoint.afterLeg+':'+(finalLeg?.id||'ladder'),
   cooldownMinutes:isFinal?10:30,
   reasons:[
    'remaining legs '+checkpoint.remainingLegs,
    'remaining modeled probability '+(checkpoint.remainingModelProbability*100).toFixed(1)+'%',
    'theoretical hold multiple '+checkpoint.theoreticalHoldMultiple.toFixed(2)+'x'
   ]
  });
 }

 const deduped=new Map<string,OpportunityCommand>();
 for(const c of commands){
  const prior=deduped.get(c.dedupeKey);
  if(!prior||severityRank[c.severity]>severityRank[prior.severity]||c.score>prior.score)deduped.set(c.dedupeKey,c);
 }
 const rows=[...deduped.values()].sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]||b.score-a.score);

 return {
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
   critical:rows.filter(x=>x.severity==='CRITICAL').length,
   high:rows.filter(x=>x.severity==='HIGH').length,
   medium:rows.filter(x=>x.severity==='MEDIUM').length,
   low:rows.filter(x=>x.severity==='LOW').length
  },
  notes:[
   'The command queue prioritizes analytics follow-up only; it does not execute wagers, trades, cash-outs, or closes.',
   'Commands are deduplicated by opportunity and carry cooldown guidance to reduce repeated alerts.',
   'Early Cash-Out checkpoints remain review prompts; actual sportsbook cash-out availability and offers must be checked live.'
  ]
 };
}
