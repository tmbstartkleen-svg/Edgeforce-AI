export type SettlementLearningPolicy={
 schemaVersion:'v152-settlement-learning-1';
 evidenceClass:'PROVIDER_NATIVE'|'CORROBORATED_SCORE'|'TRUSTED_PRIMARY_SINGLE'|'LEGACY_UNVERIFIED'|'UNKNOWN';
 confidence:string;
 trainingEligible:boolean;
 evidenceWeight:number;
 legacy:boolean;
 reason:string;
};

type SettlementProvenanceLike={
 evidenceClass?:unknown;
 confidence?:unknown;
 source?:unknown;
 sourceCount?:unknown;
 agreeingSources?:unknown;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

export function settlementLearningPolicy(provenance:unknown):SettlementLearningPolicy{
 const p=provenance&&typeof provenance==='object'&&!Array.isArray(provenance)?provenance as SettlementProvenanceLike:null;
 if(!p){
  return {
   schemaVersion:'v152-settlement-learning-1',
   evidenceClass:'LEGACY_UNVERIFIED',
   confidence:'LEGACY',
   trainingEligible:true,
   evidenceWeight:.5,
   legacy:true,
   reason:'pre-V152 historical result retained for backward-compatible learning'
  };
 }
 const evidenceClass=String(p.evidenceClass||'UNKNOWN').toUpperCase();
 const confidence=String(p.confidence||'UNKNOWN').toUpperCase();
 if(evidenceClass==='PROVIDER_NATIVE'){
  return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'PROVIDER_NATIVE',confidence,trainingEligible:true,evidenceWeight:1,legacy:false,reason:'provider-native result is eligible for automatic learning'};
 }
 if(evidenceClass==='CORROBORATED_SCORE'){
  if(confidence==='HIGH'){
   return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'CORROBORATED_SCORE',confidence,trainingEligible:true,evidenceWeight:1,legacy:false,reason:'high-confidence corroborated final score is eligible for automatic learning'};
  }
  if(confidence==='MEDIUM'){
   return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'CORROBORATED_SCORE',confidence,trainingEligible:true,evidenceWeight:.75,legacy:false,reason:'medium-confidence corroborated final score is eligible with reduced evidence weight'};
  }
  return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'CORROBORATED_SCORE',confidence,trainingEligible:false,evidenceWeight:0,legacy:false,reason:'corroborated-score result lacks sufficient confidence for automatic learning'};
 }
 if(evidenceClass==='TRUSTED_PRIMARY_SINGLE'){
  return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'TRUSTED_PRIMARY_SINGLE',confidence,trainingEligible:false,evidenceWeight:.35,legacy:false,reason:'trusted single-source final is settlement-eligible but excluded from automatic model promotion'};
 }
 return {schemaVersion:'v152-settlement-learning-1',evidenceClass:'UNKNOWN',confidence,trainingEligible:false,evidenceWeight:0,legacy:false,reason:'unknown settlement evidence is excluded from automatic learning'};
}

export function settlementLearningFromFeatures(features:unknown):SettlementLearningPolicy{
 const root=features&&typeof features==='object'&&!Array.isArray(features)?features as Record<string,unknown>:{};
 const stored=root.settlementLearning;
 if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
  const value=stored as Record<string,unknown>;
  return {
   schemaVersion:'v152-settlement-learning-1',
   evidenceClass:String(value.evidenceClass||'UNKNOWN').toUpperCase() as SettlementLearningPolicy['evidenceClass'],
   confidence:String(value.confidence||'UNKNOWN'),
   trainingEligible:value.trainingEligible!==false,
   evidenceWeight:clamp(Number(value.evidenceWeight??1),0,1),
   legacy:Boolean(value.legacy),
   reason:String(value.reason||'stored settlement-learning policy')
  };
 }
 return settlementLearningPolicy(root.settlementProvenance);
}

export function effectiveEvidenceSampleSize(rows:Array<{features?:unknown}>){
 return rows.reduce((sum,row)=>sum+settlementLearningFromFeatures(row.features).evidenceWeight,0);
}

export function meetsEffectiveEvidenceMinimum(rows:Array<{features?:unknown}>,minimum:number){
 const effectiveSampleSize=effectiveEvidenceSampleSize(rows);
 return {ok:effectiveSampleSize>=minimum,effectiveSampleSize,minimum};
}

export function summarizeSettlementLearning(rows:Array<{features?:unknown}>){
 const summary={
  total:rows.length,
  eligible:0,
  excluded:0,
  legacy:0,
  providerNative:0,
  corroborated:0,
  trustedPrimarySingle:0,
  unknown:0,
  averageEvidenceWeight:0
 };
 let weight=0;
 for(const row of rows){
  const policy=settlementLearningFromFeatures(row.features);
  if(policy.trainingEligible)summary.eligible++;
  else summary.excluded++;
  if(policy.legacy)summary.legacy++;
  if(policy.evidenceClass==='PROVIDER_NATIVE')summary.providerNative++;
  else if(policy.evidenceClass==='CORROBORATED_SCORE')summary.corroborated++;
  else if(policy.evidenceClass==='TRUSTED_PRIMARY_SINGLE')summary.trustedPrimarySingle++;
  else if(policy.evidenceClass==='UNKNOWN')summary.unknown++;
  weight+=policy.evidenceWeight;
 }
 summary.averageEvidenceWeight=rows.length?Number((weight/rows.length).toFixed(3)):0;
 return summary;
}
