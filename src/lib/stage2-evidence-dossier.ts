/**
 * Major C Stage 2 integrated research certification dossier.
 *
 * Aggregate independent evidence from actual settled forecast outcomes, actual
 * historical closing prices, and comparable independent quote feeds. No
 * external reads, database writes, credential access, or self-certification.
 * Inputs are untrusted until an external provenance/holdout review is done.
 */
import {auditHeldOutProbabilityCalibration,type SettledForecast} from './heldout-calibration-audit';
import {auditClosingLineValue,type ClosingLinePair} from './closing-line-value-audit';
import {analyzeIndependentQuoteAgreement,type SourceQuote} from './independent-quote-agreement';
import {evaluatePairedBrierSkill,type PairedForecast} from './paired-brier-skill';

export type Stage2EvidenceBundle={
 settledForecasts:SettledForecast[];
 closingLinePairs:ClosingLinePair[];
 simultaneousSourceQuotes:SourceQuote[];
 pairedBaselineForecasts?:PairedForecast[];
 // Attestations are NOT supplied here. Authorization must come from a separate
 // trusted reviewer/service, never arbitrary request JSON booleans.
};
export function evaluateStage2ResearchDossier(bundle:Stage2EvidenceBundle,now=Date.now()){
 if(!bundle||typeof bundle!=='object'||!Number.isFinite(now)||
  !Array.isArray(bundle.settledForecasts)||!Array.isArray(bundle.closingLinePairs)||
  !Array.isArray(bundle.simultaneousSourceQuotes))throw Error('INVALID_STAGE2_EVIDENCE');
 const calibration=auditHeldOutProbabilityCalibration(bundle.settledForecasts,now);
 const clv=auditClosingLineValue(bundle.closingLinePairs,now);
 const crossSource=analyzeIndependentQuoteAgreement(bundle.simultaneousSourceQuotes,now);
 const paired=evaluatePairedBrierSkill(bundle.pairedBaselineForecasts??[],now);
 const requirements=[
  {id:'SETTLED_MODEL_SAMPLE',passed:calibration.sampleSize>=100,
   observed:calibration.sampleSize,required:'100 or more uniquely identified settled forecasts'},
  {id:'CALIBRATION_ERROR',passed:calibration.sampleSize>=100&&
   calibration.expectedCalibrationError!==null&&calibration.expectedCalibrationError<=0.10,
   observed:calibration.expectedCalibrationError,required:'ECE <= 0.10 on audited holdout'},
  {id:'BRIER_SKILL_BASELINE',passed:paired.observedImprovement,
   observed:paired.absoluteBrierImprovement,required:'Positive Brier improvement on >=100 event-matched settled predictions (still requires provenance audit)'},
  {id:'CLOSING_LINE_HISTORY',passed:clv.comparablePairs>=30,
   observed:clv.comparablePairs,required:'30 or more distinct matched historical closing lines'},
  {id:'INDEPENDENT_QUOTE_CORROBORATION',passed:crossSource.corroboratedMarkets>=1&&
   crossSource.divergentMarkets===0,
   observed:crossSource.corroboratedMarkets,required:'At least one fresh comparable two-upstream quote; no divergence'},
  {id:'MODEL_HOLDOUT_PROVENANCE',passed:false,
   observed:'NOT_AUDITED',required:'Audited temporal holdout and training exclusion'},
  {id:'SOURCE_AUTHENTICITY_AND_ENTITLEMENT',passed:false,
   observed:'NOT_AUDITED',required:'Authenticated independent upstream ownership and storage permission'},
  {id:'LIVE_EXECUTABILITY',passed:false,
   observed:'NOT_AUDITED',required:'Executable sportsbook price, suspension checks and freshness validation'}
 ];
 const deficiencies=requirements.filter(r=>!r.passed).map(r=>r.id);
 return {mode:'STAGE2_RESEARCH_DOSSIER' as const,
  asOf:new Date(now).toISOString(),stage2ResearchMetricsAvailable:calibration.sampleSize>=100&&
   clv.comparablePairs>=30&&crossSource.corroboratedMarkets>0,
  stage2Certified:false,productionReady:false,verifiedBetCount:0,
  requirements,deficiencies,
  calibration:{modelKey:calibration.modelKey,sampleSize:calibration.sampleSize,
   brierScore:calibration.brierScore,logLoss:calibration.logLoss,
   expectedCalibrationError:calibration.expectedCalibrationError,
   maxBinCalibrationGap:calibration.maxBinCalibrationGap,rejected:calibration.rejected},
  pairedBaseline:{sampleSize:paired.sampleSize,modelBrierScore:paired.modelBrierScore,
   baselineBrierScore:paired.baselineBrierScore,absoluteBrierImprovement:paired.absoluteBrierImprovement,
   observedImprovement:paired.observedImprovement,rejected:paired.rejected,
   baselineProvenanceVerified:false},
  clv:{comparablePairs:clv.comparablePairs,averageClvPercent:clv.averageClvPercent,
   beatCloseCount:clv.beatCloseCount,rejected:clv.rejected},
  crossSource:{comparedMarkets:crossSource.comparedMarkets,
   corroboratedMarkets:crossSource.corroboratedMarkets,
   divergentMarkets:crossSource.divergentMarkets,rejected:crossSource.rejected},
  warning:'Research metrics do not verify data provenance, legal data rights, independent model calibration, executable odds or profitable bets. External certification is mandatory.'};
}
