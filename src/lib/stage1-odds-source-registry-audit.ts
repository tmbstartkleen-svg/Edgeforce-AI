/**
 * Stage 1 read-only inventory inspection from authorized D1 source summaries.
 * Scoreboards, model outputs, certification-only rows and aggregator
 * bookmaker multiplicity do NOT count as independent sportsbook upstreams.
 * Registry metadata is never proof of legal entitlement or successful ingest.
 */
export type RegisteredSource={
 source_id:string;upstream_id:string;source_type:string;
 enabled:number|boolean;
};
export type SourceRegistryEvidence={
 sources:RegisteredSource[];storedOddsRows:number;
 independentlyAuditedOperators?:{upstreamId:string;operatorId:string;
  evidenceReference:string}[];
};
const str=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const normalize=(s:string)=>s.trim().toLowerCase();
export function inspectOddsSourceRegistry(input:SourceRegistryEvidence){
 if(!input||!Array.isArray(input.sources)||input.sources.length>1000||
  !Number.isSafeInteger(input.storedOddsRows)||input.storedOddsRows<0)
  throw Error('INVALID_ODDS_REGISTRY_EVIDENCE');
 const summary:Record<string,{registered:number;enabled:number}>={};
 const candidates=[] as Array<{sourceId:string;upstreamId:string}>;
 let malformed=0;
 for(const item of input.sources){
  if(!item||![item.source_id,item.upstream_id,item.source_type].every(str)||
   (item.enabled!==1&&item.enabled!==0&&item.enabled!==true&&item.enabled!==false)){
   malformed++;continue;
  }
  const kind=normalize(item.source_type);
  if(!Object.hasOwn(summary,kind))summary[kind]={registered:0,enabled:0};
  const active=item.enabled===1||item.enabled===true;
  summary[kind].registered++;
  if(active)summary[kind].enabled++;
  if(active&&kind==='sportsbook-odds')
   candidates.push({sourceId:item.source_id,upstreamId:item.upstream_id});
 }
 const distinctRegisteredUpstreams=[...new Set(candidates.map(x=>normalize(x.upstreamId)))];
 const operators=input.independentlyAuditedOperators||[];
 if(!Array.isArray(operators)||operators.length>100)throw Error('INVALID_ODDS_OPERATOR_AUDIT');
 const labels=new Map<string,{operatorId:string;evidenceReference:string}>();
 for(const op of operators){
  if(!op||![op.upstreamId,op.operatorId,op.evidenceReference].every(str))
   throw Error('INVALID_ODDS_OPERATOR_AUDIT');
  const k=normalize(op.upstreamId);
  if(labels.has(k))throw Error('DUPLICATE_OPERATOR_ATTESTATION');
  labels.set(k,{operatorId:normalize(op.operatorId),evidenceReference:op.evidenceReference});
 }
 const auditedOperators=[...new Set(distinctRegisteredUpstreams.map(x=>labels.get(x)?.operatorId).filter(
  (x):x is string=>Boolean(x)))];
 const blockers=[
  ...(candidates.length===0?['NO_ENABLED_SPORTSBOOK_ODDS_SOURCE']:[]),
  ...(input.storedOddsRows===0?['NO_PERSISTED_SPORTSBOOK_ODDS']:[]),
  ...(malformed?['MALFORMED_REGISTRY_ROWS']:[]),
  ...(auditedOperators.length<2?['TWO_INDEPENDENT_SOURCE_OPERATORS_NOT_EVIDENCED']:[]),
  'STORAGE_ENTITLEMENT_NOT_INDEPENDENTLY_VERIFIED',
  'ODDS_COLLECTION_AND_D1_READBACK_NOT_AUTHENTICATED'
 ];
 return {mode:'ODDS_REGISTRY_LAUNCH_BLOCKER_AUDIT' as const,
  totalRegistered:input.sources.length,bySourceType:summary,
  enabledSportsbookSources:candidates.length,
  distinctSportsbookUpstreams:distinctRegisteredUpstreams.length,
  independentlyAttestedOperatorLabels:auditedOperators.length,
  storedOddsRows:input.storedOddsRows,malformed,
  candidates,blockers,releaseCertified:false,
  canWriteOdds:false,verifiedValueBets:0,
  warning:'A registered odds feed is neither collection authority nor data entitlement; self-supplied operator names are not independently verified. Scoreboard data never counts as sportsbook odds.'};
}
