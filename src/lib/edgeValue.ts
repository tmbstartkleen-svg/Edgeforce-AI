/**
 * EdgeForce pricing math. Odds are American; probabilities are on [0, 1].
 * This module does not estimate probabilities or verify market quotes.
 */
export type EdgeValue = {
  americanOdds: number;
  modelProbability: number;
  breakEvenProbability: number;
  probabilityEdgePp: number;
  profitPerDollarWon: number;
  expectedProfitPerDollarStaked: number;
  expectedRoiPercent: number;
  fairAmericanOdds: number | null;
  confidence: 'unverified-model';
};

function assertProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError('modelProbability must be finite and between 0 and 1');
  }
}
function assertOdds(odds: number): void {
  if (!Number.isFinite(odds) || !Number.isInteger(odds) || (odds > -100 && odds < 100)) {
    throw new RangeError('American odds must be an integer <= -100 or >= +100');
  }
}
export function breakEvenProbability(americanOdds: number): number {
  assertOdds(americanOdds);
  return americanOdds < 0
    ? -americanOdds / (-americanOdds + 100)
    : 100 / (americanOdds + 100);
}
export function profitPerDollar(americanOdds: number): number {
  assertOdds(americanOdds);
  return americanOdds < 0 ? 100 / -americanOdds : americanOdds / 100;
}
export function fairOddsFromProbability(probability: number): number | null {
  assertProbability(probability);
  if (probability === 0 || probability === 1) return null;
  const decimalOdds = 1 / probability;
  return probability >= 0.5
    ? -100 / (decimalOdds - 1)
    : 100 * (decimalOdds - 1);
}
export function calculateEdgeValue(americanOdds: number, modelProbability: number): EdgeValue {
  assertOdds(americanOdds);
  assertProbability(modelProbability);
  const breakEven = breakEvenProbability(americanOdds);
  const winProfit = profitPerDollar(americanOdds);
  const expectedProfit = modelProbability * winProfit - (1 - modelProbability);
  return {
    americanOdds,
    modelProbability,
    breakEvenProbability: breakEven,
    probabilityEdgePp: (modelProbability - breakEven) * 100,
    profitPerDollarWon: winProfit,
    expectedProfitPerDollarStaked: expectedProfit,
    expectedRoiPercent: expectedProfit * 100,
    fairAmericanOdds: fairOddsFromProbability(modelProbability),
    confidence: 'unverified-model',
  };
}
