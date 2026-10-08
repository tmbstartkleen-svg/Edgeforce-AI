'use client';
import {useEffect,useState} from 'react';

type IdentityMatches={
 total?:number;
 internalEventId?:number;
 frozenSourceEventId?:number;
 eventProviderMapping?:number;
};

type ClosureEvidence={
 topology?:string;
 standbyCommitDrift?:boolean;
 standbyCommitSha?:string|null;
 settlementCertified?:boolean;
 settlementWorkflowBound?:boolean;
 settlementExpectedWorkflowRunId?:string|null;
 settlementWorkflowRunId?:string|null;
 settlementMode?:string|null;
 settlementNoop?:boolean;
 settlementMatchedLegs?:number;
 settlementIdentityCertified?:boolean;
 settlementIdentityCoverage?:number;
 settlementMappedIdentityShare?:number;
 settlementIdentityStrength?:'DIRECT'|'MIXED'|'MAPPED'|'NOOP'|'UNVERIFIED'|string;
 settlementIdentityMatches?:IdentityMatches|null;
 settlementFallbackEvidenceCertified?:boolean|null;
 settlementRunStartedAt?:string|null;
};

type Item={
 closed:boolean;
 commitSha:string;
 executionCertified:boolean;
 promotionVerified:boolean;
 postPromotionVerified:boolean;
 platformConverged:boolean;
 rollbackClear:boolean;
 evidence?:ClosureEvidence;
 workflowRunId?:string|null;
 createdAt:string;
};

type Diagnostics={
 available?:boolean;
 status?:string;
 operatorReady?:boolean;
 workflowBinding?:{
  certified?:boolean;
  expected?:string|null;
  observed?:string|null;
  match?:boolean;
 };
 anomalies?:string[];
};

const pct=(value:unknown)=>{
 const n=Number(value);
 return Number.isFinite(n)?`${Math.round(n*100)}%`:'—';
};
const short=(value:unknown)=>{
 const s=String(value||'');
 return s?s.slice(0,12):'—';
};

export default function FinalProductionClosurePanel(){
 const [x,setX]=useState<Item|null>(null);
 const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch('/api/release/final-closure',{cache:'no-store'});
    const json=await response.json();
    if(active&&response.ok){
     setX(json.latest||null);
     setDiagnostics(json.diagnostics||null);
    }
   }catch{}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 const evidence=x?.evidence||{};
 const identity=evidence.settlementIdentityMatches||{};
 const fallbackUsed=String(evidence.settlementMode||'').includes('score-fallback');
 const settlementState=evidence.settlementCertified?'PASS':'—';
 const fallbackState=fallbackUsed?(evidence.settlementFallbackEvidenceCertified?'CERTIFIED':'BLOCKED'):'N/A';
 const identityStrength=evidence.settlementIdentityStrength||'—';
 const workflowBound=diagnostics?.workflowBinding?.certified??Boolean(evidence.settlementWorkflowBound);
 const expectedRun=diagnostics?.workflowBinding?.expected||evidence.settlementExpectedWorkflowRunId||x?.workflowRunId||null;
 const observedRun=diagnostics?.workflowBinding?.observed||evidence.settlementWorkflowRunId||null;
 const anomalyCount=diagnostics?.anomalies?.length||0;

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V177 PRODUCTION CLOSURE</div>
    <h3>Primary / Standby Release Certificate</h3>
   </div>
   <div className="panelMeta"><span>{diagnostics?.operatorReady||x?.closed?'CLOSED':'PENDING'}</span></div>
  </div>

  <div className="v21Stats">
   <div><small>PRIMARY SHA</small><strong>{x?.commitSha?.slice(0,8)||'—'}</strong><span>Cloudflare release</span></div>
   <div><small>PRIMARY</small><strong>{x?.executionCertified&&x?.promotionVerified&&x?.postPromotionVerified?'PASS':'—'}</strong><span>certified + live + smoked</span></div>
   <div><small>STANDBY</small><strong>{x?.platformConverged?'READY':'—'}</strong><span>Vercel manual DR</span></div>
   <div><small>ROLLBACK</small><strong>{x?.rollbackClear?'CLEAR':'—'}</strong><span>primary revocation integrity</span></div>
   <div><small>SETTLEMENT</small><strong>{settlementState}</strong><span>{evidence.settlementMode||'no commit-bound evidence'}</span></div>
   <div><small>RUN BOUND</small><strong>{workflowBound?'PASS':'—'}</strong><span>{short(observedRun)} / expected {short(expectedRun)}</span></div>
   <div><small>ID COVERAGE</small><strong>{pct(evidence.settlementIdentityCoverage)}</strong><span>{identityStrength} identity path</span></div>
   <div><small>MAPPED SHARE</small><strong>{pct(evidence.settlementMappedIdentityShare)}</strong><span>{Number(identity.eventProviderMapping||0)} mapped / {Number(identity.total||0)} matched</span></div>
   <div><small>FALLBACK</small><strong>{fallbackState}</strong><span>{fallbackUsed?'score evidence certification':'native/no fallback'}</span></div>
   <div><small>ANOMALIES</small><strong>{anomalyCount}</strong><span>{anomalyCount?'closure diagnostics require review':'none detected'}</span></div>
  </div>

  <div className="historyNote">
   V177 exposes the exact production workflow certificate used for settlement closure. Production is operator-ready only when the Cloudflare primary is certified, the Vercel disaster-recovery standby is READY and healthy, settlement is bound to the same deployment commit and workflow run, and every matched leg has complete identity accounting. Standby commit drift is expected until failover.
  </div>
 </section>;
}
