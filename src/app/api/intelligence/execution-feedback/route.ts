import {loadExecutionFeedback} from '@/lib/executionFeedback';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await loadExecutionFeedback();
 return Response.json({
  ok:true,
  configured:report.configured,
  generatedAt:new Date().toISOString(),
  rows:report.rows,
  notes:[
   'Execution feedback uses 30-day price-capture history and is bounded before it reaches the daily router.',
   'Positive CLV can increase analytical emphasis slightly; negative CLV can reduce it.',
   'Execution feedback cannot override calibration, sample-size, champion/challenger, or production-readiness gates.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
