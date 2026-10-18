import {calculateEdgeValue} from '@/lib/edgeValue';
export const dynamic = 'force-dynamic';

/** Educational calculator: caller must supply its own probability and quote. */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ok: false, error: 'INVALID_JSON'}, {status: 400}); }
  if (!body || typeof body !== 'object') {
    return Response.json({ok: false, error: 'INVALID_INPUT'}, {status: 400});
  }
  const input = body as Record<string, unknown>;
  if (typeof input.americanOdds !== 'number' || typeof input.modelProbability !== 'number') {
    return Response.json({ok: false, error: 'ODDS_AND_PROBABILITY_REQUIRED'}, {status: 400});
  }
  try {
    return Response.json({
      ok: true,
      ...calculateEdgeValue(input.americanOdds, input.modelProbability),
      isVerifiedBet: false,
      disclaimer: 'User-supplied prices and probabilities; no independent quote or model verification performed.',
    }, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return Response.json({ok: false, error: 'INVALID_INPUT', message: error instanceof Error ? error.message : 'Invalid values'}, {status: 400});
  }
}
