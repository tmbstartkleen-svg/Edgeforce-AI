/** PULSE scenario-aware decision gate.
 * This is a research screen, not a bet placer or proof of profitability.
 * Scenario dispersion is used as a conservative stress haircut, not a statistical confidence interval.
 */
const finiteProbability = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

export function decimalOdds(americanOdds) {
  if (!Number.isFinite(americanOdds) || !Number.isInteger(americanOdds) || americanOdds === 0 || Math.abs(americanOdds) < 100) {
    throw new TypeError('INVALID_AMERICAN_ODDS');
  }
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds);
}

export function evaluatePulseCandidate(input, {
  now = Date.now(),
  maxAgeMs = 20 * 60 * 1000,
  minEdge = 0.03,
  scenarioRiskPenalty = 0.5,
} = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.scenarios) ||
      input.scenarios.length < 2 || !Number.isFinite(now) || !Number.isFinite(maxAgeMs) ||
      maxAgeMs <= 0 || !Number.isFinite(minEdge) || minEdge < 0 || minEdge > 1 ||
      !Number.isFinite(scenarioRiskPenalty) || scenarioRiskPenalty < 0 || scenarioRiskPenalty > 3) {
    throw new TypeError('INVALID_PULSE_INPUT');
  }
  const decimal = decimalOdds(input.americanOdds);
  const breakEvenProbability = 1 / decimal;
  const quoteObservedAt = input.quoteObservedAt;
  const quoteFresh = Number.isFinite(quoteObservedAt) && quoteObservedAt <= now + 60_000 &&
    now - quoteObservedAt <= maxAgeMs;
  const evidence = {
    quoteFresh,
    modelCalibrated: input.modelCalibrated === true,
    outOfSampleVerified: input.outOfSampleVerified === true,
    sourceAudited: input.sourceAudited === true,
    lineupStatus: ['CONFIRMED', 'MODELED_UNCERTAINTY'].includes(input.lineupStatus),
  };

  let weightSum = 0;
  let weightedProbability = 0;
  for (const scenario of input.scenarios) {
    if (!scenario || !finiteProbability(scenario.probability) ||
        !Number.isFinite(scenario.weight) || scenario.weight <= 0) {
      throw new TypeError('INVALID_PULSE_SCENARIO');
    }
    weightSum += scenario.weight;
    weightedProbability += scenario.weight * scenario.probability;
  }
  if (Math.abs(weightSum - 1) > 1e-6) throw new TypeError('SCENARIO_WEIGHTS_MUST_SUM_TO_ONE');

  const scenarioMeanProbability = weightedProbability;
  const scenarioVariance = input.scenarios.reduce(
    (sum, scenario) => sum + scenario.weight * (scenario.probability - scenarioMeanProbability) ** 2, 0,
  );
  const scenarioStandardDeviation = Math.sqrt(scenarioVariance);
  const scenarioAdjustedProbability = Math.max(
    0,
    Math.min(1, scenarioMeanProbability - scenarioRiskPenalty * scenarioStandardDeviation),
  );
  const edge = scenarioAdjustedProbability - breakEvenProbability;
  const conservativeExpectedRoi = scenarioAdjustedProbability * decimal - 1;
  const evidenceReady = Object.values(evidence).every(Boolean);
  let status = 'PASS';
  let reason = 'CONSERVATIVE_EDGE_NOT_ABOVE_THRESHOLD';
  if (!evidenceReady) {
    status = 'PASS';
    reason = 'REQUIRED_EVIDENCE_MISSING';
  } else if (edge >= minEdge && conservativeExpectedRoi > 0) {
    status = 'CANDIDATE_FOR_REVIEW';
    reason = 'SCENARIO_ADJUSTED_EDGE_CLEARS_THRESHOLD';
  } else if (edge > 0) {
    status = 'WATCHLIST';
    reason = 'POSITIVE_BUT_THIN_SCENARIO_ADJUSTED_EDGE';
  }

  return {
    status,
    reason,
    automatedBettingEnabled: false,
    americanOdds: input.americanOdds,
    decimalOdds: decimal,
    breakEvenProbability,
    scenarioMeanProbability,
    scenarioStandardDeviation,
    scenarioAdjustedProbability,
    edge,
    conservativeExpectedRoi,
    minEdge,
    scenarioRiskPenalty,
    evidence,
    evidenceReady,
    notes: [
      'Scenario dispersion haircut is a stress adjustment, not a confidence interval.',
      'Candidate status means review only; it does not certify positive expected value or executable prices.',
      'No network requests or wagers are made by this function.',
    ],
  };
}
