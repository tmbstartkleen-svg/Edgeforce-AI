import {buildPlayerCalibrationProfile} from '@/lib/playerCalibration';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=Array.from({length:20},(_,i)=>({
  athleteId:'ath-test',sport:'NBA',statKey:'points',direction:'OVER',
  modelProbability:.58,result:(i<14?'win':'loss') as 'win'|'loss'
 }));
 const p=buildPlayerCalibrationProfile(rows);
 const ok=Boolean(
  p&&p.sampleSize===20&&p.wins===14&&p.losses===6&&
  p.observedHitRate>.58&&p.calibrationBias>0&&p.calibrationBias<=.06&&p.confidence===.5
 );
 return Response.json({ok,build:'V63',schemaVersion:'v63-player-calibration-1',profile:p},{headers:{'Cache-Control':'no-store'}});
}
