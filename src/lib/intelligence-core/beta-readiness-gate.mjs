/** Build #446 release evidence gate; missing proof is a blocker, never inferred. */
export function evaluateBetaReadiness(evidence={}){
 const checks=[
  ['exactMainCi','Exact-main GitHub certifications'],
  ['productionCommitVerified','Live Cloudflare production commit identity'],
  ['d1SchemaReady','Authenticated D1 schema diagnostics'],
  ['liveIngestionVerified','Source-attributed production ingestion and persistence'],
  ['sportsbookOddsVerified','Current authenticated DraftKings prices'],
  ['independentUpstreamsVerified','Two independently authenticated odds upstreams'],
  ['modelCalibrationVerified','Out-of-sample model calibration'],
  ['allSportsCoverageAudited','Coverage gaps identified across enabled sports and props'],
  ['productionSmokeVerified','Authenticated production smoke test']
 ];
 const results=checks.map(([key,label])=>({key,label,passed:evidence[key]===true}));
 return {status:results.every(r=>r.passed)?'READY_FOR_LIMITED_BETA_REVIEW':'NOT_CERTIFIED',
  passed:results.filter(r=>r.passed).length,required:results.length,
  blockers:results.filter(r=>!r.passed).map(r=>r.key),checks:results,
  productionCutoverAuthorized:false};
}
