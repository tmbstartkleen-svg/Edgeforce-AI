type ClosureLike={
 closed?:boolean;
 commitSha?:string;
 executionCertified?:boolean;
 promotionVerified?:boolean;
 postPromotionVerified?:boolean;
 platformConverged?:boolean;
 rollbackClear?:boolean;
 blockers?:unknown;
 evidence?:unknown;
 workflowRunId?:string|null;
 createdAt?:string;
};

const obj=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
const list=(value:unknown)=>Array.isArray(value)?value.map(String):[];

export function buildFinalClosureDiagnostics(input:ClosureLike|null|undefined){
 if(!input){
  return {
   available:false,
   status:'UNAVAILABLE' as const,
   operatorReady:false,
   commitSha:null,
   commitBinding:{certified:false,expected:null,observed:null,match:false},
   workflowBinding:{certified:false,expected:null,observed:null,match:false},
   settlement:{certified:false,mode:null,noop:false,matchedLegs:0,identityCertified:false,identityCoverage:0,identityStrength:'UNVERIFIED',mappedIdentityShare:0,fallbackEvidenceCertified:null},
   topology:{platformConverged:false,standbyCommitDrift:false,standbyCommitSha:null},
   blockers:['final production closure evidence is unavailable'],
   anomalies:['NO_CLOSURE_EVIDENCE']
  };
 }
 const evidence=obj(input.evidence);
 const blockers=list(input.blockers);
 const expectedCommit=String(input.commitSha||'')||null;
 const observedCommit=String(evidence.settlementCommitSha||'')||null;
 const commitBound=Boolean(expectedCommit&&observedCommit&&expectedCommit===observedCommit);
 const expected=String(evidence.settlementExpectedWorkflowRunId||input.workflowRunId||'')||null;
 const observed=String(evidence.settlementWorkflowRunId||'')||null;
 const workflowBound=Boolean(evidence.settlementWorkflowBound&&expected&&observed&&expected===observed);
 const identityCoverage=Number(evidence.settlementIdentityCoverage||0);
 const mappedShare=Number(evidence.settlementMappedIdentityShare||0);
 const matchedLegs=Math.max(0,Number(evidence.settlementMatchedLegs||0));
 const anomalies:string[]=[];
 if(!commitBound)anomalies.push('SETTLEMENT_COMMIT_NOT_BOUND');
 if(!workflowBound)anomalies.push('SETTLEMENT_WORKFLOW_NOT_BOUND');
 if(evidence.settlementCertified!==true)anomalies.push('SETTLEMENT_NOT_CERTIFIED');
 if(evidence.settlementIdentityCertified!==true)anomalies.push('SETTLEMENT_IDENTITY_NOT_CERTIFIED');
 if(identityCoverage!==1)anomalies.push('SETTLEMENT_IDENTITY_COVERAGE_INCOMPLETE');
 if(String(evidence.settlementMode||'').includes('score-fallback')&&evidence.settlementFallbackEvidenceCertified!==true){
  anomalies.push('SETTLEMENT_FALLBACK_NOT_CERTIFIED');
 }
 if(input.rollbackClear===false)anomalies.push('ROLLBACK_NOT_CLEAR');
 if(input.platformConverged===false)anomalies.push('PLATFORM_NOT_CONVERGED');

 const operatorReady=Boolean(
  input.closed
  &&input.executionCertified
  &&input.promotionVerified
  &&input.postPromotionVerified
  &&input.platformConverged
  &&input.rollbackClear
  &&commitBound
  &&workflowBound
  &&evidence.settlementCertified===true
  &&evidence.settlementIdentityCertified===true
  &&identityCoverage===1
  &&blockers.length===0
  &&anomalies.length===0
 );

 return {
  available:true,
  status:operatorReady?'CLOSED' as const:'PENDING' as const,
  operatorReady,
  commitSha:String(input.commitSha||'')||null,
  commitBinding:{
   certified:commitBound,
   expected:expectedCommit,
   observed:observedCommit,
   match:Boolean(expectedCommit&&observedCommit&&expectedCommit===observedCommit)
  },
  workflowBinding:{
   certified:workflowBound,
   expected,
   observed,
   match:Boolean(expected&&observed&&expected===observed)
  },
  settlement:{
   certified:evidence.settlementCertified===true,
   mode:evidence.settlementMode||null,
   noop:Boolean(evidence.settlementNoop),
   matchedLegs,
   identityCertified:evidence.settlementIdentityCertified===true,
   identityCoverage:Number.isFinite(identityCoverage)?identityCoverage:0,
   identityStrength:String(evidence.settlementIdentityStrength||'UNVERIFIED'),
   mappedIdentityShare:Number.isFinite(mappedShare)?mappedShare:0,
   identityMatches:evidence.settlementIdentityMatches||null,
   fallbackEvidenceCertified:evidence.settlementFallbackEvidenceCertified??null,
   runStartedAt:evidence.settlementRunStartedAt||null
  },
  topology:{
   platformConverged:Boolean(input.platformConverged),
   standbyCommitDrift:Boolean(evidence.standbyCommitDrift),
   standbyCommitSha:evidence.standbyCommitSha||null,
   standbyDeploymentId:evidence.standbyDeploymentId||null
  },
  blockers,
  anomalies,
  createdAt:input.createdAt||null
 };
}
