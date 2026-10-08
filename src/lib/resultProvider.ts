import {fetchResultsContext} from './providers/context';
import {reconcileLedgerResults} from './ledger';
import {recordPredictionFeedback} from './predictionFeedback';
import {settlePlayerPropPredictions} from './playerWarehouse';
import {settleExternalMlPredictionFeedback} from './mlChampionDrift';
import {settleShadowPredictionFeedback} from './mlShadowRecovery';
import {finalScoreSettlementRows,type SettlementProvenance} from './scoreSettlementFallback';

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';

function rows(payload:unknown):unknown[]{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const key of ['results','data','events','rows']){
  if(Array.isArray(root[key]))return root[key] as unknown[];
 }
 return [];
}

function normalizeResult(v:unknown){
 const r=obj(v);
 const result=str(r.result||r.outcome||r.status).toLowerCase();
 if(!['win','loss','push'].includes(result))return null;
 const eventId=str(r.eventId||r.event_id||r.id);
 const marketKey=str(r.marketKey||r.market_key||r.market||r.type);
 const selectionKey=str(r.selectionKey||r.selection_key||r.selection||r.outcomeName||r.outcome_name);
 if(!eventId||!selectionKey)return null;
 const closingOdds=typeof (r.closingOdds??r.closing_odds)==='number'?Number(r.closingOdds??r.closing_odds):undefined;
 return {
  eventId,
  marketKey:marketKey||undefined,
  selectionKey,
  result:result as 'win'|'loss'|'push',
  closingOdds,
  settledAt:str(r.settledAt||r.settled_at||r.completedAt||r.completed_at)||new Date().toISOString()
 };
}

export async function runAutomaticSettlement(){
 const provider=await fetchResultsContext();
 const raw=provider.ok?rows(provider.data):[];
 const providerSource=provider.providerName||provider.providerId||'results-provider';
 const providerRows=raw
  .map(normalizeResult)
  .filter((x):x is NonNullable<ReturnType<typeof normalizeResult>>=>Boolean(x))
  .map(row=>({
   ...row,
   settlementProvenance:{
    schemaVersion:'v151-settlement-provenance-1',
    evidenceClass:'PROVIDER_NATIVE',
    source:providerSource,
    confidence:'PROVIDER_NATIVE',
    sourceCount:1,
    agreeingSources:1,
    reason:'configured results provider supplied the settlement outcome',
    observedAt:row.settledAt
   } satisfies SettlementProvenance
  }));
 const fallback=await finalScoreSettlementRows().catch(error=>({
  available:false,rows:[],matchedGames:0,candidateLegs:0,
  warnings:[error instanceof Error?error.message:'final-score fallback failed'],
  evidence:{totalFinalGames:0,acceptedFinalGames:0,blockedFinalGames:0,highConfidence:0,mediumConfidence:0,trustedSingleSource:0,blockedConflict:0,blockedLowConfidence:0,blockedSingleSource:0}
 }));
 const seen=new Set<string>();
 const normalized=[...providerRows,...fallback.rows].filter(row=>{
  const key=[row.eventId,row.marketKey||'',row.selectionKey].join('|').toLowerCase();
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
 if(!provider.ok&&!fallback.available){
  return {ok:false,mode:provider.attempts.length?'failed':'unconfigured',provider:provider.providerName||provider.providerId||null,received:0,normalized:0,matchedLegs:0,settledSlips:0,error:provider.error,fallbackAvailable:false,fallbackWarnings:fallback.warnings};
 }
 const [reconciliation,feedback,playerProps,externalMl,shadowMl]=await Promise.all([
  reconcileLedgerResults(normalized),
  recordPredictionFeedback(normalized),
  settlePlayerPropPredictions(normalized),
  settleExternalMlPredictionFeedback(normalized),
  settleShadowPredictionFeedback(normalized)
 ]);
 return {
  ok:true,
  mode:provider.ok?'live+score-fallback':'score-fallback',
  provider:provider.ok?(provider.providerName||provider.providerId||'results-provider'):'no-key-final-score-mesh',
  received:raw.length,
  normalized:normalized.length,
  fallbackAvailable:fallback.available,
  fallbackRows:fallback.rows.length,
  fallbackCandidateLegs:fallback.candidateLegs,
  settlementNoop:normalized.length===0,
  fallbackMatchedGames:fallback.matchedGames,
  fallbackWarnings:fallback.warnings,
  fallbackEvidence:fallback.evidence,
  fallbackEvidenceCertified:
   fallback.evidence.blockedFinalGames===0&&
   fallback.evidence.blockedConflict===0&&
   fallback.evidence.blockedLowConfidence===0&&
   fallback.evidence.blockedSingleSource===0,
  settlementIdentityMatches:{
   internalEventId:reconciliation.internalIdentityMatches,
   frozenSourceEventId:reconciliation.frozenSourceIdentityMatches,
   eventProviderMapping:reconciliation.mappedSourceIdentityMatches,
   total:reconciliation.matchedLegs
  },
  settlementProvenanceWritten:reconciliation.provenanceWritten,
  settlementEvidenceEvents:reconciliation.evidenceEvents,
  settlementEvidenceClasses:reconciliation.evidenceClasses,
  matchedLegs:reconciliation.matchedLegs,
  settledSlips:reconciliation.settledSlips,
  predictionFeedbackWritten:feedback.written,
  predictionRunsMatched:feedback.matchedRuns,
  playerPropMatches:playerProps.matched,
  playerPropsSettled:playerProps.settled,
  externalMlMatched:externalMl.matched,
  externalMlSettled:externalMl.settled,
  shadowMlMatched:shadowMl.matched,
  shadowMlSettled:shadowMl.settled
 };
}
