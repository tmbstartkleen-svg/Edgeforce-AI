import {buildMarketMovementProfile,buildMovementSignals,canonicalMovementSelection} from '@/lib/marketMovementLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const continuity=canonicalMovementSelection('Chiefs -2.5','spread')===canonicalMovementSelection('Chiefs -3.5','spread');
 const profile=buildMarketMovementProfile([
  {sport:'NFL',marketKey:'spread',offeredOdds:-110,closingOdds:-130,outcome:1},
  {sport:'NFL',marketKey:'spread',offeredOdds:-105,closingOdds:-125,outcome:1},
  {sport:'NFL',marketKey:'spread',offeredOdds:-115,closingOdds:-125,outcome:0},
  {sport:'NFL',marketKey:'spread',offeredOdds:-110,closingOdds:-120,outcome:1}
 ])[0];
 const signals=buildMovementSignals([
  {odds:-105,probability:.505,pulledAt:'2026-10-05T10:00:00Z',point:-2.5},
  {odds:-120,probability:.545,pulledAt:'2026-10-05T11:00:00Z',point:-3},
  {odds:-132,probability:.569,pulledAt:'2026-10-05T11:30:00Z',point:-3.5},
  {odds:-115,probability:.535,pulledAt:'2026-10-05T12:00:00Z',point:-3}
 ],profile,.03);
 const ok=continuity&&Boolean(signals)&&signals!.marketProbabilityMove>0&&signals!.marketPointMove<0&&signals!.marketReversalSignal<0&&signals!.marketSnapshotCount===4;
 return Response.json({ok,build:'V69',schemaVersion:'v69-market-movement-1',continuity,profile,signals},{headers:{'Cache-Control':'no-store'}});
}
