/**
 * Enterprise release evidence gate. Joins historical model/price evidence
 * and expected-vs-observed sportsbook catalog coverage. No network access,
 * database writes, paid provider calls, or self-attested certifications.
 * The report never promotes untrusted evidence to production approval.
 */
import {evaluateStage2ResearchDossier,type Stage2EvidenceBundle} from './stage2-evidence-dossier';
import {auditFullDraftKingsOddsExport} from './full-draftkings-export-audit';
import type {RequiredMarket} from './draftkings-market-gap-audit';
import {auditDraftKingsCoverageContinuity,type CoverageSnapshot} from './draftkings-coverage-continuity';

export type MajorReleaseEvidence={
 stage2:Stage2EvidenceBundle;
 draftKings:{events:unknown;expected:RequiredMarket[];snapshots?:CoverageSnapshot[]};
};
export function evaluateMajorReleaseEvidence(input:MajorReleaseEvidence,now=Date.now()){
 if(!input||typeof input!=='object'||!input.stage2||!input.draftKings||
   !Number.isFinite(now))throw Error('INVALID_MAJOR_RELEASE_EVIDENCE');
 const model=evaluateStage2ResearchDossier(input.stage2,now);
 const coverage=auditFullDraftKingsOddsExport(
  input.draftKings.events,input.draftKings.expected,now);
 const continuity=input.draftKings.snapshots===undefined?null:
  auditDraftKingsCoverageContinuity(input.draftKings.expected,input.draftKings.snapshots,now);
 const gates=[
  {id:'STAGE1_UPSTREAM_ENTITLEMENT',stage:1,status:'BLOCKED',why:'Provider storage and reuse rights not independently verified'},
  {id:'STAGE1_INDEPENDENT_FEEDS',stage:1,status:'BLOCKED',why:'Authenticated independent odds upstream operators not certified'},
  {id:'STAGE1_D1_READBACK',stage:1,status:'BLOCKED',why:'Authorized isolated D1 persist-and-readback evidence not supplied'},
  {id:'STAGE2_MEASURED_HOLDOUT',stage:2,
   status:model.stage2ResearchMetricsAvailable?'RESEARCH_EVIDENCE':'BLOCKED',
   why:model.stage2ResearchMetricsAvailable?'Historical metrics computed; provenance still missing':'Insufficient paired settled forecasts, CLV history or comparable quotes'},
  {id:'STAGE2_MODEL_PROVENANCE',stage:2,status:'BLOCKED',why:'Independent training, temporal holdout and outcome provenance unaudited'},
  {id:'STAGE3_EXPECTED_CATALOG',stage:3,
   status:coverage.catalogProvided?'RESEARCH_EVIDENCE':'BLOCKED',
   why:coverage.catalogProvided?'Caller-supplied market catalog; no external DraftKings authentication':'No expected comprehensive DK catalog'},
  {id:'STAGE3_PRICED_OUTCOME_COVERAGE',stage:3,
   status:coverage.coverageComplete?'RESEARCH_EVIDENCE':'BLOCKED',
   why:coverage.coverageComplete?'Provided sample meets supplied catalog only':'Required DK event/market/prop coverage missing or incomplete'},
  {id:'STAGE3_COVERAGE_CONTINUITY',stage:3,
   status:continuity?.evidenceSufficientForTrend?'RESEARCH_EVIDENCE':'BLOCKED',
   why:continuity?.evidenceSufficientForTrend?'Multi-snapshot gap trend measured from unverified inputs':'At least two valid historical coverage snapshots required'},
  {id:'STAGE3_PLAYER_IDENTITY',stage:3,status:'BLOCKED',
   why:'No authenticated stable athlete directory joined to every priced player prop'},
  {id:'STAGE4_DEPLOYMENT_CERTIFICATION',stage:4,status:'BLOCKED',
   why:'Production smoke, authenticated data, observability and security release evidence not provided'}
 ] as const;
 const missingByStage=[1,2,3,4].map(stage=>({
  stage,blocked:gates.filter(g=>g.stage===stage&&g.status==='BLOCKED').map(g=>g.id),
  researchOnly:gates.filter(g=>g.stage===stage&&g.status==='RESEARCH_EVIDENCE').map(g=>g.id),
  certified:false
 }));
 return {mode:'EDGEFORCE_MAJOR_RELEASE_EVIDENCE' as const,
  generatedAt:new Date(now).toISOString(),
  stage2Research:model,stage3Coverage:coverage,
  stage3Continuity:continuity,
  gateCount:gates.length,gates,missingByStage,
  certifiedStages:0,remainingMajorStages:4,
  certifiedMarketCount:0,verifiedValueBets:0,
  releaseCertified:false,productionApproved:false,
  warning:'Analysis of supplied exports is not production certification. Real independent upstream provenance, authorization, stable player identities, calibration review, verified odds and deployed reliability are mandatory.'};
}
