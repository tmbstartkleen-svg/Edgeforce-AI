export type LegDecisionStatus='KEEP'|'WATCH'|'REPLACE_CANDIDATE';

export type LegDecisionInput={
  originalSimulationProbability:number;
  currentSimulationProbability:number;
  currentOdds?:number;
  originalOdds?:number;
  locked?:boolean;
  changeSummary?:string[];
};

export type LegDecision={
  status:LegDecisionStatus;
  score:number;
  probabilityDelta:number;
  reasons:string[];
};

const clamp=(x:number)=>Math.max(0,Math.min(100,x));

export function evaluateLegDecision(input:LegDecisionInput):LegDecision{
  const original=input.originalSimulationProbability;
  const current=input.currentSimulationProbability;
  const delta=current-original;
  const changes=input.changeSummary||[];
  const joined=changes.join(' ').toLowerCase();

  const starterRisk=/starter|quarterback|goalie|pitcher/.test(joined);
  const lineupRisk=/lineup/.test(joined);
  const injuryRisk=/injury|availability|out|inactive/.test(joined);
  const weatherRisk=/weather/.test(joined);

  let score=50+(current-.65)*180+delta*240;
  if(current>=.70)score+=8;
  if(current>=.75)score+=6;
  if(delta>=.02)score+=5;
  if(delta<=-.03)score-=10;
  if(delta<=-.05)score-=12;
  if(starterRisk)score-=10;
  if(lineupRisk)score-=7;
  if(injuryRisk)score-=9;
  if(weatherRisk)score-=4;
  score=clamp(Math.round(score));

  const reasons:string[]=[];
  if(current<.65)reasons.push('Current 10K simulation is below the 65% leg floor');
  if(delta<=-.05)reasons.push('Simulation probability fell by at least 5 points');
  else if(delta<=-.025)reasons.push('Simulation probability fell materially');
  if(starterRisk)reasons.push('Starter status changed');
  if(lineupRisk)reasons.push('Lineup status changed');
  if(injuryRisk)reasons.push('Injury or availability signal changed');
  if(weatherRisk)reasons.push('Weather signal changed');

  let status:LegDecisionStatus='KEEP';
  if(current<.65||delta<=-.05||((starterRisk||injuryRisk)&&delta<=-.025))status='REPLACE_CANDIDATE';
  else if(current<.68||delta<=-.025||changes.length>0)status='WATCH';

  if(status==='KEEP'){
    if(delta>=.02)reasons.push('Current simulation improved from the saved value');
    else reasons.push('Current simulation remains above the leg floor without a material negative change');
  }else if(status==='WATCH'&&reasons.length===0){
    reasons.push('Current simulation remains playable but changed enough to monitor');
  }

  return {status,score,probabilityDelta:delta,reasons};
}
