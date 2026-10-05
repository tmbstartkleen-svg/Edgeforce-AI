import {evaluatePreventiveActionGate} from '@/lib/preventiveActionDecisionGate';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const strong:any={cause:'AUTOMATION',actionKey:'restart-job',actionText:'Restart stale job after dependency recovery.',priorityScore:.88,effectivenessScore:.82,confidence:.80,sourceRiskScore:.78,evidenceQuality:'STRONG',reason:[]};
 const weak:any={...strong,effectivenessScore:.25,confidence:.70,priorityScore:.40};
 const recommend=evaluatePreventiveActionGate({topAction:strong,sourceRiskScore:.78,sourceRiskLevel:'HIGH',overallHealth:'HEALTHY',criticalChecks:0,actionIncidents:0,predictedCause:'AUTOMATION'});
 const reject=evaluatePreventiveActionGate({topAction:weak,sourceRiskScore:.78,sourceRiskLevel:'HIGH',overallHealth:'HEALTHY',criticalChecks:0,actionIncidents:0,predictedCause:'AUTOMATION'});
 return Response.json({ok:recommend.decision==='RECOMMEND'&&reject.decision==='DO_NOT_USE',schemaVersion:'v80-preventive-action-decision-test-1',recommend,reject});
}
