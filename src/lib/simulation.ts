import type {Market} from './types';

export type SimulationTier=100|1000|10000|100000;
export type SimulationResult={runs:SimulationTier;hits:number;probability:number;ciLow:number;ciHigh:number;volatility:number};

export function simulationTier(edge:number,confidence:number):SimulationTier{
 if(edge>=.08&&confidence>=.8)return 100000;
 if(edge>=.05&&confidence>=.72)return 10000;
 if(edge>=.025)return 1000;
 return 100;
}

const clamp=(x:number,min=.01,max=.99)=>Math.max(min,Math.min(max,x));
const feat=(m:Market,k:string)=>Math.max(-1,Math.min(1,Number(m.sportFeatures?.[k]||0)));

export function runGameStateSimulation(m:Market,runs:SimulationTier):SimulationResult{
 const playerConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.playerSampleConfidence||0)));
 const v64PlayerOpponentConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.playerVsOpponentConfidence||0)));
 const opponentHistoryAdjustment=v64PlayerOpponentConfidence>=.15
  ? feat(m,'playerVsOpponentSignal')*.008*v64PlayerOpponentConfidence
  : feat(m,'playerOpponent')*.008*playerConfidence;
 const playerAdjustment=(
  feat(m,'playerForm')*.012+
  feat(m,'playerHomeAway')*.008+
  feat(m,'playerUsage')*.006+
  (feat(m,'playerRosterContinuity')-.5)*.004
 )*playerConfidence+opponentHistoryAdjustment;
 const calibrationConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.playerCalibrationConfidence||0)));
 const calibrationBias=Math.max(-.06,Math.min(.06,Number(m.sportFeatures?.playerCalibrationBias||0)))*calibrationConfidence;
 const matchupConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.opponentMatchupConfidence||0)));
 const matchupAdjustment=feat(m,'opponentMatchupSignal')*.014*matchupConfidence;
 const roleConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.roleRedistributionConfidence||0)));
 const roleAdjustment=(feat(m,'roleStatLift')*.010+feat(m,'roleUsageLift')*.006+feat(m,'roleMinutesLift')*.004)*roleConfidence;
 const lineupConfidence=Math.max(0,Math.min(1,Number(m.sportFeatures?.lineupRoleConfidence||0)));
 const lineupAdjustment=(feat(m,'lineupStarterDelta')*.010+feat(m,'lineupPromotionScore')*.006)*lineupConfidence;
 const base=clamp(m.modelProb+playerAdjustment+calibrationBias+matchupAdjustment+roleAdjustment+lineupAdjustment);
 const uncertainty=(1-Math.max(.2,Math.min(1,m.confidence)))*.10;
 const context=Math.min(.08,
  Math.abs(feat(m,'injury'))*.025+
  Math.abs(feat(m,'weather'))*.018+
  Math.abs(feat(m,'travel'))*.012+
  Math.abs(feat(m,'starter'))*.018+
  Math.abs(feat(m,'goalie'))*.018+
  Math.abs(feat(m,'quarterback'))*.020+
  Math.abs(feat(m,'playerVolatility'))*.015*(.5+playerConfidence*.5)+
  Math.abs(feat(m,'opponentMatchupVolatility'))*.010*matchupConfidence+
  Math.abs(feat(m,'roleAbsenceSeverity'))*.008*roleConfidence+
  Math.abs(.5-feat(m,'lineupStarterProbability'))*.004*(1-lineupConfidence)
 );
 const volatility=.015+uncertainty+context;
 let hits=0;
 let state=hashSeed(m.id+m.startTime);

 for(let i=0;i<runs;i++){
  state=xorshift32(state); const u1=Math.max(1e-9,(state>>>0)/4294967296);
  state=xorshift32(state); const u2=Math.max(1e-9,(state>>>0)/4294967296);
  const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
  const scenarioP=clamp(base+z*volatility);
  state=xorshift32(state);
  const u=(state>>>0)/4294967296;
  if(u<scenarioP)hits++;
 }
 const phat=hits/runs;
 const se=Math.sqrt(Math.max(.0000001,phat*(1-phat)/runs));
 return {runs,hits,probability:phat,ciLow:Math.max(0,phat-1.96*se),ciHigh:Math.min(1,phat+1.96*se),volatility};
}

export const runBernoulliSimulation=runGameStateSimulation;

function hashSeed(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h||123456789}
function xorshift32(x:number){x^=x<<13;x^=x>>>17;x^=x<<5;return x|0}
