export const RESEARCH_VERSION = 'poisson-prior-only-v1';
export const LEAGUES: Record<string, string> = {
  E0: 'England · Premier League',
  SP1: 'Spain · La Liga',
  D1: 'Germany · Bundesliga',
  I1: 'Italy · Serie A',
  F1: 'France · Ligue 1',
};
export const SEASONS = ['2122', '2223', '2324', '2425', '2526', '2627'];
export type Method = 'market' | 'poisson' | 'monteCarlo';
export type ResearchGame = {
  key: string;
  date: string;
  time: string;
  league: string;
  season: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  result: number;
  odds: number[] | null;
  market: number[] | null;
  poisson: number[] | null;
  monteCarlo: number[] | null;
  trainingGames: number;
};

export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= input.length; i++) {
    const c = input[i] ?? '\n';
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (c === '\n') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else field += c;
  }
  const headers = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])),
  );
}

export function poissonProbabilities(home: number, away: number): number[] {
  const distribution = (lambda: number) => {
    const p = [Math.exp(-lambda)];
    for (let i = 1; i <= 15; i++) p.push((p[i - 1] * lambda) / i);
    return p;
  };
  const h = distribution(home),
    a = distribution(away),
    p = [0, 0, 0];
  for (let i = 0; i < h.length; i++)
    for (let j = 0; j < a.length; j++)
      p[i > j ? 0 : i === j ? 1 : 2] += h[i] * a[j];
  const total = p.reduce((x, y) => x + y, 0);
  return p.map((v) => v / total);
}
export function monteCarlo(p: number[], key: string, runs = 10000) {
  let seed = 2166136261;
  for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const counts = [0, 0, 0];
  for (let i = 0; i < runs; i++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const u = seed / 4294967296;
    counts[u < p[0] ? 0 : u < p[0] + p[1] ? 1 : 2]++;
  }
  return counts.map((v) => v / runs);
}

// Each day's predictions are frozen before ANY result from that day is learned.
export function buildHistory(
  csv: string,
  league: string,
  season: string,
): ResearchGame[] {
  const parsed = parseCSV(csv).filter(
    (r) =>
      /^\d{2}\/\d{2}\/\d{4}$/.test(r.Date) &&
      ['H', 'D', 'A'].includes(r.FTR) &&
      /^\d+$/.test(r.FTHG) &&
      /^\d+$/.test(r.FTAG),
  );
  const games = parsed
    .map((r) => {
      const [d, m, y] = r.Date.split('/');
      const odds = ['B365H', 'B365D', 'B365A'].map((k) => Number(r[k]));
      const usable = odds.every((n) => Number.isFinite(n) && n > 1);
      const inv = odds.map((n) => 1 / n),
        sum = inv.reduce((a, b) => a + b, 0);
      return {
        key: `${league}:${season}:${r.Date}:${r.HomeTeam}:${r.AwayTeam}`,
        date: `${y}-${m}-${d}`,
        time: r.Time || '',
        league,
        season,
        home: r.HomeTeam,
        away: r.AwayTeam,
        homeScore: Number(r.FTHG),
        awayScore: Number(r.FTAG),
        result: ['H', 'D', 'A'].indexOf(r.FTR),
        odds: usable ? odds : null,
        market: usable ? inv.map((p) => p / sum) : null,
        poisson: null,
        monteCarlo: null,
        trainingGames: 0,
      } as ResearchGame;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.key.localeCompare(b.key),
    );
  const seen = new Set<string>();
  const unique = games.filter((g) => !seen.has(g.key) && !!seen.add(g.key));
  const teams = new Map<string, { scored: number[]; conceded: number[] }>();
  let n = 0,
    totalHome = 0,
    totalAway = 0;
  const team = (name: string) =>
    teams.get(name) ?? { scored: [], conceded: [] };
  for (let start = 0; start < unique.length; ) {
    let end = start + 1;
    while (end < unique.length && unique[end].date === unique[start].date)
      end++;
    for (const g of unique.slice(start, end)) {
      g.trainingGames = n;
      const h = team(g.home),
        a = team(g.away);
      if (n < 60 || h.scored.length < 5 || a.scored.length < 5) continue;
      const base = Math.max(0.1, (totalHome + totalAway) / (2 * n));
      const mean = (v: number[]) =>
        (v.reduce((x, y) => x + y, 0) + 5 * base) / (v.length + 5);
      const clamp = (v: number) => Math.min(4.5, Math.max(0.2, v));
      g.poisson = poissonProbabilities(
        clamp(
          ((totalHome / n) * mean(h.scored) * mean(a.conceded)) / base ** 2,
        ),
        clamp(
          ((totalAway / n) * mean(a.scored) * mean(h.conceded)) / base ** 2,
        ),
      );
      g.monteCarlo = monteCarlo(g.poisson, g.key);
    }
    for (const g of unique.slice(start, end)) {
      const h = team(g.home),
        a = team(g.away);
      h.scored = [...h.scored, g.homeScore].slice(-20);
      h.conceded = [...h.conceded, g.awayScore].slice(-20);
      a.scored = [...a.scored, g.awayScore].slice(-20);
      a.conceded = [...a.conceded, g.homeScore].slice(-20);
      teams.set(g.home, h);
      teams.set(g.away, a);
      n++;
      totalHome += g.homeScore;
      totalAway += g.awayScore;
    }
    start = end;
  }
  return unique;
}

export function kelly(p: number, decimal: number, fraction = 0.25) {
  if (
    !Number.isFinite(p) ||
    p < 0 ||
    p > 1 ||
    !Number.isFinite(decimal) ||
    !Number.isFinite(fraction) ||
    fraction < 0
  )
    return 0;
  return decimal > 1
    ? Math.min(
        0.01,
        Math.max(0, ((p * decimal - 1) / (decimal - 1)) * fraction),
      )
    : 0;
}
export function periodKey(date: string, unit: string) {
  if (unit === 'year') return date.slice(0, 4);
  if (unit === 'month') return date.slice(0, 7);
  if (unit === 'week') {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  return date;
}
export function evaluate(
  games: ResearchGame[],
  method: Method,
  legs = 1,
  staking = 'flat',
) {
  if (![1, 2, 3].includes(legs))
    throw new Error('Choose one, two or three legs');
  const eligible = games
    .filter((g) => g.market && g.poisson && g.monteCarlo && g.odds)
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const tickets: {
    date: string;
    p: number;
    odds: number;
    won: boolean;
    stake: number;
  }[] = [];
  let brier = 0,
    logLoss = 0;
  const days = new Map<string, ResearchGame[]>();
  for (const g of eligible) {
    const p = g[method]!;
    brier += p.reduce((s, v, i) => s + (v - Number(i === g.result)) ** 2, 0);
    logLoss -= Math.log(Math.max(1e-12, p[g.result]));
    const key = `${g.date}:${g.league}`;
    days.set(key, [...(days.get(key) ?? []), g]);
  }
  for (const day of days.values())
    for (let i = 0; i + legs <= day.length; i += legs) {
      const group = day.slice(i, i + legs);
      let probability = 1,
        odds = 1,
        won = true;
      for (const g of group) {
        const p = g[method]!;
        const pick = p.indexOf(Math.max(...p));
        probability *= p[pick];
        odds *= g.odds![pick];
        won &&= pick === g.result;
      }
      const stake = staking === 'kelly' ? kelly(probability, odds) : 0.01;
      if (stake > 0)
        tickets.push({ date: group[0].date, p: probability, odds, won, stake });
    }
  let bankroll = 100,
    peak = 100,
    drawdown = 0,
    staked = 0,
    wins = 0;
  const ticketDays = [...new Set(tickets.map((t) => t.date))];
  for (const date of ticketDays) {
    const day = tickets.filter((t) => t.date === date),
      start = bankroll;
    const total = day.reduce((s, t) => s + t.stake, 0),
      scale = Math.min(1, 0.1 / total);
    for (const t of day) {
      const stake = start * t.stake * scale;
      staked += stake;
      bankroll += stake * (t.won ? t.odds - 1 : -1);
      if (t.won) wins++;
    }
    peak = Math.max(peak, bankroll);
    drawdown = Math.max(drawdown, ((peak - bankroll) / peak) * 100);
  }
  const count = tickets.length,
    rate = count ? wins / count : 0,
    z = 1.96;
  const center =
    (rate + (z * z) / (2 * Math.max(count, 1))) /
    (1 + (z * z) / Math.max(count, 1));
  const width =
    (z *
      Math.sqrt(
        (rate * (1 - rate)) / Math.max(count, 1) +
          (z * z) / (4 * Math.max(count, 1) ** 2),
      )) /
    (1 + (z * z) / Math.max(count, 1));
  return {
    games: eligible.length,
    tickets: count,
    wins,
    hitRate: count ? rate * 100 : null,
    lower: count ? (center - width) * 100 : null,
    upper: count ? (center + width) * 100 : null,
    brier: eligible.length ? brier / eligible.length : null,
    logLoss: eligible.length ? logLoss / eligible.length : null,
    roi: staked ? ((bankroll - 100) / staked) * 100 : null,
    bankroll,
    drawdown,
    staked,
  };
}
