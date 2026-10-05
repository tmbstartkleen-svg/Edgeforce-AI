import {buildPreventiveDecisionCalibration} from '@/lib/preventiveDecisionCalibration';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const report=buildPreventiveDecisionCalibration([
  {decision:'RECOMMEND',gateScore:.80,calibratedSuccess:true},
  {decision:'RECOMMEND',gateScore:.75,calibratedSuccess:true},
  {decision:'HOLD_FOR_EVIDENCE',gateScore:.55,calibratedSuccess:true},
  {decision:'DO_NOT_USE',gateScore:.25,calibratedSuccess:false}
 ]);
 return Response.json({
  ok:report.sampleSize===4&&report.brierScore>=0&&report.calibrationError>=0&&report.recommendSuccessRate===1,
  schemaVersion:'v81-preventive-decision-calibration-test-1',
  report
 });
}
