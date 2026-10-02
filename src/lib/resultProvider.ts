import {fetchResultsContext} from './providers/context';
import {reconcileLedgerResults} from './ledger';
import {recordPredictionFeedback} from './predictionFeedback';

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
 if(!provider.ok){
  return {ok:false,mode:provider.attempts.length?'failed':'unconfigured',provider:provider.providerName||provider.providerId||null,received:0,normalized:0,matchedLegs:0,settledSlips:0,error:provider.error};
 }
 const raw=rows(provider.data);
 const normalized=raw.map(normalizeResult).filter((x):x is NonNullable<ReturnType<typeof normalizeResult>>=>Boolean(x));
 const [reconciliation,feedback]=await Promise.all([
  reconcileLedgerResults(normalized),
  recordPredictionFeedback(normalized)
 ]);
 return {
  ok:true,
  mode:'live',
  provider:provider.providerName||provider.providerId||'results-provider',
  received:raw.length,
  normalized:normalized.length,
  matchedLegs:reconciliation.matchedLegs,
  settledSlips:reconciliation.settledSlips,
  predictionFeedbackWritten:feedback.written,
  predictionRunsMatched:feedback.matchedRuns
 };
}
