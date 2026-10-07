import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateReleaseGate} from '../scripts/release-gate.mjs';

const frozenCritical=()=>({
 schemaVersion:'v74-slo-governor-1',
 ok:false,
 deploymentAllowed:false,
 state:'FROZEN',
 freezeTriggered:true,
 reasons:['current production observability is CRITICAL','3 unresolved ACTION incident(s) are active'],
 current:{overall:'CRITICAL',score:.42,criticalChecks:3,actionIncidents:3}
});

test('ordinary remediation still fails closed on current CRITICAL health',()=>{
 assert.throws(()=>evaluateReleaseGate('slo',frozenCritical(),{remediation:true}),/deployment blocked/);
});

test('legacy handoff alone cannot bypass SLO without strict candidate certification',()=>{
 assert.throws(()=>evaluateReleaseGate('slo',frozenCritical(),{
  remediation:true,legacyHandoff:true,strictCertified:false
 }),/deployment blocked/);
});

test('strict-certified pre-V74 remediation handoff may advance only to comparative canary',()=>{
 assert.equal(evaluateReleaseGate('slo',frozenCritical(),{
  remediation:true,legacyHandoff:true,strictCertified:true
 }),'SLO_REMEDIATION_ACCEPTED');
});

test('legacy exception requires an actual frozen triggered SLO report',()=>{
 for(const patch of [
  {state:'OPEN'},
  {freezeTriggered:false},
  {deploymentAllowed:true},
  {current:{overall:'DEGRADED',score:.7,criticalChecks:0,actionIncidents:1}}
 ]){
  const report={...frozenCritical(),...patch};
  if(report.current.overall==='DEGRADED'){
   assert.throws(()=>evaluateReleaseGate('slo',report,{
    remediation:true,legacyHandoff:true,strictCertified:true
   }),/deployment blocked/);
  }else{
   assert.throws(()=>evaluateReleaseGate('slo',report,{
    remediation:true,legacyHandoff:true,strictCertified:true
   }));
  }
 }
});

test('existing safe remediation acceptance remains limited to non-critical health with zero ACTION incidents',()=>{
 const report={
  ...frozenCritical(),
  current:{overall:'DEGRADED',score:.72,criticalChecks:0,actionIncidents:0}
 };
 assert.equal(evaluateReleaseGate('slo',report,{remediation:true}),'SLO_REMEDIATION_ACCEPTED');
});
