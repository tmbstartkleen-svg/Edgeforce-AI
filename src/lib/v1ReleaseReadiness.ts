import {db} from './db';
import {runProductionCertification} from './productionCertification';
import {loadDeploymentGuardSummary} from './deploymentGuard';
import {getProductionLaunchStatus} from './productionLaunch';

export type V1Verdict='GO'|'CONDITIONAL'|'NO_GO';
export type V1GateState='PASS'|'WARN'|'FAIL'|'UNKNOWN';
export type V1Gate={id:string;label:string;state:V1GateState;required:boolean;detail:string};

export async function buildV1ReleaseReadiness(options:{strict?:boolean}={}){
 const environment=process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local';
 const strict=options.strict??(environment==='production'||process.env.REQUIRE_PRODUCTION_ENV==='true');
 const [certification,deploymentGuard,launchStatus]=await Promise.all([runProductionCertification({strict}),loadDeploymentGuardSummary(),getProductionLaunchStatus()]);
 const sql=db();
 let replay:any=null;
 let stress:any=null;
 let health:any=null;

 if(sql){
  try{
   const [r]=await sql`select ordering_status,ordering_score::float8,observed_at from decision_replay_snapshots order by observed_at desc limit 1`;
   replay=r||null;
  }catch{}
  try{
   const [s]=await sql`
    select
     max(observed_at) as observed_at,
     count(*) filter(where classification='ROBUST')::int as robust,
     count(*) filter(where classification='RESILIENT')::int as resilient,
     count(*) filter(where classification='FRAGILE')::int as fragile,
     count(*) filter(where classification='FAIL')::int as fail,
     count(*) filter(where baseline_state in ('PRIME','READY') and classification in ('FRAGILE','FAIL'))::int as prime_ready_fragile
    from stress_scenario_snapshots
    where observed_at >= now()-interval '24 hours'
   `;
   stress=s?.observed_at?s:null;
  }catch{}
  try{
   const [h]=await sql`select overall_state,health_score::float8,critical_checks,degraded_checks,unknown_checks,observed_at from operational_health_snapshots order by observed_at desc limit 1`;
   health=h||null;
  }catch{}
 }

 const gates:V1Gate[]=[];
 const add=(id:string,label:string,state:V1GateState,required:boolean,detail:string)=>gates.push({id,label,state,required,detail});

 add('production-certification','Production certification',certification.certified?'PASS':strict?'FAIL':'WARN',true,certification.certified?'Base production certification passed.':certification.blockers.length?certification.blockers.join(' • '):'Certification is not fully satisfied in this environment.');
 add('observability','Operational health',certification.observability.overall==='HEALTHY'?'PASS':certification.observability.overall==='CRITICAL'?(strict?'FAIL':'WARN'):'WARN',true,`Current health ${certification.observability.overall} at ${(certification.observability.score*100).toFixed(1)}%.`);
 add('security','Security posture',certification.security.ok?'PASS':'FAIL',true,certification.security.ok?'Required security headers and mutation/rate limits are present.':`Missing headers: ${certification.security.missingHeaders.join(', ')||'security posture failed'}.`);
 add('automation','Automation health',certification.automation.failedCount===0&&certification.automation.staleCount===0?'PASS':'FAIL',true,`${certification.automation.healthyCount} healthy, ${certification.automation.pendingCount} pending, ${certification.automation.failedCount} failed, ${certification.automation.staleCount} stale.`);
 add('live-data','Live sportsbook data',certification.ingestion.source==='live'?'PASS':strict?'FAIL':'WARN',true,`Current ingestion source: ${certification.ingestion.source}; markets: ${certification.ingestion.marketCount}.`);
 add('release-attestation','Release attestation',certification.releaseAttestation.found&&certification.releaseAttestation.buildPassed&&certification.releaseAttestation.smokePassed&&certification.releaseAttestation.loadPassed&&certification.releaseAttestation.readinessPassed?'PASS':strict?'FAIL':'WARN',true,certification.releaseAttestation.found?`Attestation ${certification.releaseAttestation.version}: build=${certification.releaseAttestation.buildPassed}, smoke=${certification.releaseAttestation.smokePassed}, load=${certification.releaseAttestation.loadPassed}, readiness=${certification.releaseAttestation.readinessPassed}.`:'No current release attestation found.');
 const execCert=certification.executionCertification;
 add('release-execution','Release execution evidence',execCert?.certified?'PASS':strict?'FAIL':'WARN',true,execCert?`Execution certificate ${execCert.releaseVersion} @ ${execCert.commitSha.slice(0,8)}; source ${execCert.source}.`:'No current-release execution certificate found.');
 const promotion=certification.promotionProvenance;
 add('promotion-provenance','Production promotion provenance',promotion?.promoted&&!promotion?.rolledBack&&!promotion?.blockers?.length?'PASS':'WARN',true,promotion?`Promotion ${promotion.releaseVersion} @ ${promotion.commitSha.slice(0,8)} on ${promotion.platform}; workflow ${promotion.workflowRunId||'unknown'}.`:'First promotion of the current release has not written provenance yet.');
 add('provider-certification','Provider certification',certification.providerCertification?.launchReady?'PASS':strict?'FAIL':'WARN',true,certification.providerCertification?`Provider launchReady=${Boolean(certification.providerCertification.launchReady)}.`:'No persisted provider certification yet.');
 add('model-validation','Model validation',certification.modelValidation.latestRun?.status==='failed'?'FAIL':certification.modelValidation.latestRun?'PASS':'WARN',true,certification.modelValidation.latestRun?`Latest validation run ${certification.modelValidation.latestRun.status}; evidence failures ${certification.modelValidation.report.evidence.failed}.`:'No durable validation run yet.');
 add('model-governance','Model governance',certification.modelGovernance.latestRun?.status==='failed'?'FAIL':certification.modelGovernance.latestRun?'PASS':'WARN',true,certification.modelGovernance.latestRun?`Latest governance run ${certification.modelGovernance.latestRun.status}; critical ${certification.modelGovernance.summary.critical}, drifting ${certification.modelGovernance.summary.drifting}.`:'No completed governance run yet.');
 add('unified-intelligence','Unified intelligence stack',certification.unifiedIntelligence.state==='BLOCKED'?'FAIL':certification.unifiedIntelligence.state==='HEALTHY'?'PASS':'WARN',true,`State ${certification.unifiedIntelligence.state}; score ${(certification.unifiedIntelligence.score*100).toFixed(1)}%; critical coverage ${(certification.unifiedIntelligence.criticalCoverage*100).toFixed(1)}%.`);
 add('reliability-supervisor','Reliability supervisor',certification.reliability.mode==='PROTECTIVE'?'FAIL':certification.reliability.mode==='NORMAL'?'PASS':'WARN',true,`Mode ${certification.reliability.mode}; score ${(certification.reliability.score*100).toFixed(1)}%; open ${certification.reliability.openComponents.length}; half-open ${certification.reliability.halfOpenComponents.length}.`);
 add('slo-error-budget','SLO error budget',certification.sloGovernor.state==='FROZEN'?(strict?'FAIL':'WARN'):certification.sloGovernor.state==='OPEN'?'PASS':'WARN',true,`State ${certification.sloGovernor.state}; 1h burn ${certification.sloGovernor.windows.oneHour.burnRate.toFixed(1)}x; 24h burn ${certification.sloGovernor.windows.twentyFourHour.burnRate.toFixed(1)}x; 7d budget ${(Math.max(0,certification.sloGovernor.windows.sevenDay.budgetRemaining)*100).toFixed(1)}% remaining.`);
 const sloLaunchPass=Boolean((launchStatus as any).events?.some((x:any)=>x.stage==='SLO_BUDGET_PASSED'));
 add('slo-launch-stage','SLO deployment launch stage',sloLaunchPass?'PASS':strict?'FAIL':'WARN',true,sloLaunchPass?`Launch ${(launchStatus as any).launchId||'current'} recorded SLO_BUDGET_PASSED.`:'Current launch has not recorded SLO_BUDGET_PASSED.');
 const canaryPass=Boolean((launchStatus as any).events?.some((x:any)=>x.stage==='CANARY_PASSED'));
 add('deployment-canary','Comparative deployment canary',canaryPass?'PASS':strict?'FAIL':'WARN',true,canaryPass?`Launch ${(launchStatus as any).launchId||'current'} passed the comparative canary.`:`No accepted comparative canary stage is recorded; latest probe ${deploymentGuard.latest?.decision||'none'}.`);

 const replayState=String(replay?.ordering_status||'INSUFFICIENT');
 add('decision-replay','Decision ordering replay',replayState==='MISORDERED'?'FAIL':replayState==='ORDERED'?'PASS':'WARN',false,replay?`Historical ordering ${replayState}; separation score ${(Number(replay.ordering_score||0)*100).toFixed(1)}%.`:'No durable replay snapshot yet; historical validation is still accumulating.');
 const fragile=Number(stress?.prime_ready_fragile||0);
 add('stress-test','Stress-test robustness',fragile>0?'WARN':stress?'PASS':'UNKNOWN',false,stress?`${Number(stress.robust||0)} robust, ${Number(stress.resilient||0)} resilient, ${Number(stress.fragile||0)} fragile, ${Number(stress.fail||0)} fail; PRIME/READY fragile=${fragile}.`:'No recent stress snapshot available.');
 add('incidents','Operational incidents',certification.incidents.action>0?'FAIL':certification.incidents.watch>0?'WARN':'PASS',true,`${certification.incidents.action} ACTION, ${certification.incidents.watch} WATCH, ${certification.incidents.info} INFO incident(s).`);

 const hardFailures=gates.filter(x=>x.required&&x.state==='FAIL');
 const knownRegression=gates.some(x=>x.id==='decision-replay'&&x.state==='FAIL');
 const warnings=gates.filter(x=>x.state==='WARN'||x.state==='UNKNOWN');
 const verdict:V1Verdict=hardFailures.length||knownRegression?'NO_GO':warnings.length?'CONDITIONAL':'GO';
 const score=gates.reduce((sum,x)=>sum+(x.state==='PASS'?1:x.state==='WARN'?.6:x.state==='UNKNOWN'?.35:0),0)/Math.max(1,gates.length);
 const blockers=[...new Set([...certification.blockers,...hardFailures.map(x=>`${x.label}: ${x.detail}`),...(knownRegression?['Decision replay is MISORDERED; PRIME/READY/WATCH hierarchy failed historical validation.']:[])])];
 const advisories=[...new Set([...certification.warnings,...warnings.map(x=>`${x.label}: ${x.detail}`)])];

 return {
  architectureRelease:'EdgeForce v1',
  generatedAt:new Date().toISOString(),environment,strict,verdict,score,gates,blockers,advisories,
  evidence:{
   productionCertified:certification.certified,
   operationalHealth:certification.observability.overall,
   replayOrdering:replayState,
   stressPrimeReadyFragile:stress?fragile:null,
   releaseAttestation:certification.releaseAttestation,
   releaseExecutionCertified:Boolean(certification.executionCertification?.certified),
   releaseExecutionCommit:certification.executionCertification?.commitSha||null,
   promotionProvenanceRecorded:Boolean(certification.promotionProvenance),
   promotionProvenanceCommit:certification.promotionProvenance?.commitSha||null,
   promotionProvenancePlatform:certification.promotionProvenance?.platform||null,
   securityOk:certification.security.ok,
   liveData:certification.ingestion.source==='live',
   unifiedIntelligenceState:certification.unifiedIntelligence.state,
   unifiedIntelligenceScore:certification.unifiedIntelligence.score,
   reliabilityMode:certification.reliability.mode,
   reliabilityScore:certification.reliability.score,
   sloDeploymentState:certification.sloGovernor.state,
   sloDeploymentAllowed:certification.sloGovernor.deploymentAllowed,
   sloLaunchStagePassed:sloLaunchPass,
   deploymentCanaryPassed:canaryPass
  },
  certification,
  notes:[
   'GO requires every required gate to pass and no known decision-ordering regression.',
   'CONDITIONAL means there is no known release-blocking regression, but historical or operational evidence is incomplete or warning-level.',
   'NO_GO is fail-closed for required production gates or a known historical decision-ordering regression.',
   'V1 readiness is a software release verdict, not a guarantee of prediction accuracy, betting profit, or market outcomes.'
  ]
 };
}

export async function persistV1ReleaseReadiness(report:Awaited<ReturnType<typeof buildV1ReleaseReadiness>>){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into v1_release_readiness_snapshots(architecture_release,environment,strict_mode,verdict,readiness_score,blockers,advisories,gates,evidence)
  values(${report.architectureRelease},${report.environment},${report.strict},${report.verdict},${report.score},${sql.json(report.blockers)},${sql.json(report.advisories)},${sql.json(report.gates as any)},${sql.json(report.evidence as any)}) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}