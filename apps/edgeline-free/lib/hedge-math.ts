export type HedgeOutcome = {
  id: string;
  selection: string;
  americanOdds: number;
};

export type HedgePlan = {
  potentialPayout: number;
  totalHedgeStake: number;
  totalCapital: number;
  equalizedNet: number;
  minimumCombinedDecimal: number | null;
  hedges: Array<HedgeOutcome & { decimalOdds: number; stake: number }>;
};

export function americanToDecimal(odds: number) {
  if (!Number.isFinite(odds) || Math.abs(odds) < 100) return null;
  return odds < 0 ? 1 + 100 / Math.abs(odds) : 1 + odds / 100;
}

export function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1));
}

export function calculateLastLegCoverage(
  originalStake: number,
  combinedAmericanOdds: number,
  alternatives: HedgeOutcome[]
): HedgePlan | null {
  const combinedDecimal = americanToDecimal(combinedAmericanOdds);
  if (!combinedDecimal || !Number.isFinite(originalStake) || originalStake <= 0 || alternatives.length < 1) return null;
  const hedges = alternatives.map(outcome => {
    const decimalOdds = americanToDecimal(outcome.americanOdds);
    return decimalOdds ? { ...outcome, decimalOdds, stake: originalStake * combinedDecimal / decimalOdds } : null;
  });
  if (hedges.some(item => item === null)) return null;
  const validHedges = hedges.filter((item): item is NonNullable<typeof item> => item !== null);
  const potentialPayout = originalStake * combinedDecimal;
  const totalHedgeStake = validHedges.reduce((sum, hedge) => sum + hedge.stake, 0);
  const alternativeReciprocalSum = validHedges.reduce((sum, hedge) => sum + 1 / hedge.decimalOdds, 0);
  const minimumCombinedDecimal = alternativeReciprocalSum < 1 ? 1 / (1 - alternativeReciprocalSum) : null;
  return {
    potentialPayout,
    totalHedgeStake,
    totalCapital: originalStake + totalHedgeStake,
    equalizedNet: potentialPayout - originalStake - totalHedgeStake,
    minimumCombinedDecimal,
    hedges: validHedges,
  };
}
