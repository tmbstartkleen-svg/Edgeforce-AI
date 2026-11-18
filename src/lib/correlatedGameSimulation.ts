/**
 * Research-only correlated binary-outcome Monte Carlo.
 * Probabilities are supplied by an independent model; this module does not calibrate them.
 * A common Gaussian game factor couples all outcomes within a simulated trial.
 */
export type JointMarketInput = {
  id: string;
  probability: number;
  factorLoading: number;
};
export type JointSimulationInput = {
  eventId: string;
  modelVersion: string;
  seed: number;
  trials: 500000 | 1000000;
  markets: JointMarketInput[];
};
export type JointSimulationResult = {
  eventId: string;
  modelVersion: string;
  requestedTrials: number;
  completedTrials: number;
  seed: number;
  marketHits: Record<string, number>;
  pairHits: Record<string, number>;
  standardError: Record<string, number>;
  maxStandardError: number;
  status: 'RESEARCH_ONLY_UNCALIBRATED';
};

const nextRandom = (state: number) => {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
};
const uniform = (state: number) => (state >>> 0) / 4294967296;
const normal = (state: number): [number, number] => {
  const a = nextRandom(state);
  const b = nextRandom(a);
  const u = Math.max(1e-12, uniform(a));
  return [Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform(b)), b];
};
const erfApprox = (x: number) => {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-a * a));
};
const cdf = (z: number) => 0.5 * (1 + erfApprox(z / Math.SQRT2));
const quantile = (p: number) => {
  let lo = -9;
  let hi = 9;
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

export function runCorrelatedGameSimulation(input: JointSimulationInput): JointSimulationResult {
  if (!input.eventId || !input.modelVersion) throw new Error('Event and model identity required');
  if (input.trials !== 500000 && input.trials !== 1000000) throw new RangeError('Unsupported trial count');
  if (!Number.isSafeInteger(input.seed) || input.seed === 0) throw new RangeError('Nonzero integer seed required');
  if (!Array.isArray(input.markets) || input.markets.length < 1 || input.markets.length > 20) throw new RangeError('Markets must contain 1 to 20 entries');
  const ids = new Set<string>();
  for (const m of input.markets) {
    if (!m.id || ids.has(m.id)) throw new Error('Missing or duplicate market ID');
    ids.add(m.id);
    if (!Number.isFinite(m.probability) || m.probability <= 0 || m.probability >= 1) throw new RangeError('Invalid model probability');
    if (!Number.isFinite(m.factorLoading) || Math.abs(m.factorLoading) > 1) throw new RangeError('Invalid factor loading');
  }
  const markets = input.markets.map(m => ({
    id: m.id, threshold: quantile(m.probability), loading: m.factorLoading,
    residual: Math.sqrt(1 - m.factorLoading * m.factorLoading)
  }));
  const marketHits: Record<string, number> = Object.create(null);
  const pairHits: Record<string, number> = Object.create(null);
  const standardError: Record<string, number> = Object.create(null);
  for (const m of markets) marketHits[m.id] = 0;
  for (let i = 0; i < markets.length; i++) for (let j = i + 1; j < markets.length; j++) {
    pairHits[JSON.stringify([markets[i].id, markets[j].id])] = 0;
  }
  let state = input.seed | 0;
  for (let trial = 0; trial < input.trials; trial++) {
    let shared: number;
    [shared, state] = normal(state);
    const hit: boolean[] = [];
    for (const m of markets) {
      let residual: number;
      [residual, state] = normal(state);
      const success = m.loading * shared + m.residual * residual < m.threshold;
      hit.push(success);
      if (success) marketHits[m.id]++;
    }
    for (let i = 0; i < hit.length; i++) if (hit[i]) {
      for (let j = i + 1; j < hit.length; j++) if (hit[j]) {
        pairHits[JSON.stringify([markets[i].id, markets[j].id])]++;
      }
    }
  }
  let maxStandardError = 0;
  for (const m of markets) {
    const p = marketHits[m.id] / input.trials;
    standardError[m.id] = Math.sqrt(p * (1 - p) / input.trials);
    maxStandardError = Math.max(maxStandardError, standardError[m.id]);
  }
  return {
    eventId: input.eventId, modelVersion: input.modelVersion,
    requestedTrials: input.trials, completedTrials: input.trials, seed: input.seed,
    marketHits, pairHits, standardError, maxStandardError,
    status: 'RESEARCH_ONLY_UNCALIBRATED'
  };
}
