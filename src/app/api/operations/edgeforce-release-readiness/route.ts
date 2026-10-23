/**
 * Public, read-only evidence readiness status. No client-provided proof,
 * paid odds provider calls, D1 writes or invented certification flags.
 * This reports known missing release evidence rather than evaluating mock
 * data or inferring live availability from configured provider names.
 */
export const dynamic='force-dynamic';
export async function GET(){
 const stages=[
  {stage:1,name:'Authenticated sportsbook evidence',
   status:'BLOCKED',requirements:[
    'Prove collection authorization and storage entitlement',
    'Verify two independently operated sportsbook upstreams',
    'Demonstrate isolated D1 persist and exact-price readback']},
  {stage:2,name:'Independent model and value certification',
   status:'BLOCKED',requirements:[
    'Audit model provenance and leakage-free held-out predictions',
    'Compare realized calibration against a matched baseline',
    'Reconcile independently verified odds with model probabilities']},
  {stage:3,name:'All-sports DraftKings catalog and props',
   status:'BLOCKED',requirements:[
    'Authenticate complete expected league and market catalog',
    'Verify event-specific player IDs and alternate prop lines',
    'Demonstrate priced outcomes across the full selected catalog']},
  {stage:4,name:'Production release verification',
   status:'BLOCKED',requirements:[
    'Pass authenticated production smoke and data freshness gates',
    'Verify alert safety, reliability and backout behavior',
    'Complete operator acceptance and release authorization']}
 ] as const;
 return Response.json({
  ok:true,mode:'EVIDENCE_REQUIREMENTS_ONLY',asOf:new Date().toISOString(),
  stages,certifiedStages:0,remainingStages:4,
  releaseCertified:false,verifiedBets:0,
  noCurrentEvidenceFetch:true,
  evidenceOrigin:'RELEASE_POLICY_NOT_LIVE_CATALOG',
  warning:'Requirements are known, but this route does not fetch or certify live provider, model, D1 or deployment evidence. Passing CI alone is not a production data certificate.'
 },{headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
