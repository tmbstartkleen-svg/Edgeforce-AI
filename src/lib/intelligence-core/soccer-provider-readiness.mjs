// Provider-readiness contracts for soccer live board. A configured provider is NOT a licensed feed.
export function assessSoccerProviderReadiness({sources=[],marketRows=[],now=Date.now(),maxAgeMs=180000}={}){
 const approved=sources.filter(x=>x.enabled===true&&x.licenseVerified===true&&x.providerApproved===true&&
  typeof x.providerId==='string'&&x.providerId&&typeof x.upstreamId==='string'&&x.upstreamId);
 const accepted=new Set(approved.map(x=>x.providerId));
 const eligible=marketRows.filter(x=>accepted.has(x.sourceProviderId)&&x.licensed===true&&
  typeof x.observedAt==='string'&&Number.isFinite(Date.parse(x.observedAt))&&
  Date.parse(x.observedAt)<=now&&now-Date.parse(x.observedAt)<=maxAgeMs);
 return {configured:sources.length,approved:approved.length,freshLicensedRows:eligible.length,
  ready:approved.length>0&&eligible.length>0,
  reason:!approved.length?'NO_APPROVED_LICENSED_UPSTREAM':!eligible.length?'NO_FRESH_LICENSED_MARKETS':'PROVIDER_EVIDENCE_PRESENT',
  approvedUpstreams:approved.map(x=>({providerId:x.providerId,upstreamId:x.upstreamId})),
  sourceIds:eligible.map(x=>x.id),fullDraftKingsInventoryCertified:false};
}
