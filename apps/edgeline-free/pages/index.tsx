import PredictionDesk from '../components/PredictionDesk';
import TimedParlays from '../components/TimedParlays';
import Tracker from '../components/Tracker';
import Strategies from '../components/Strategies';
import PlayerUpdates from '../components/PlayerUpdates';
import GamePlayers from '../components/GamePlayers';
import Head from 'next/head';
import type { Arb } from '../lib/arbitrage';
import Research from '../components/Research';
import { easternDay, easternPeriod, USER_TIME_ZONE } from '../lib/eastern-time';
import Monitoring from '../components/Monitoring';
import ProfessionalDesk from '../components/ProfessionalDesk';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  Heart,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { americanToDecimal, decimalToAmerican } from '../lib/hedge-math';
import {
  capturedPriceAdvantage,
  isFreshPrice,
  validStake,
} from '../lib/market-integrity';

type Event = {
  id: string;
  sport: string;
  startsAt: string;
  home: string;
  away: string;
  matchup: string;
  markets: number;
};
type Quote = {
  id: string;
  eventId: string;
  marketKey: string;
  marketLabel: string;
  draftKingsCategory: string;
  betType: string;
  selection: string;
  price: number;
  updatedAt: string;
  stale: boolean;
  impliedProbability: number;
  noVigProbability: number;
  consensusProbability: number | null;
  consensusBooks: number;
  consensusEdge: number | null;
};
type Snapshot = {
  arbitrage?: Arb[];
  events: Event[];
  quotes: Quote[];
  feed: {
    sport?: string;
    creditsReserved?: number;
    monthlyLimit?: number;
    fetchedAt: string | null;
    nextCheckAt: string;
    remaining: number | null;
    problem: string | null;
    refreshMessage: string | null;
    manualRefreshesRemaining: number;
  };
};
type Pack = {
  id: string;
  name: string;
  label: string;
  legs: Quote[];
  chance: number;
  rawChance: number;
  odds: number | null;
  fairOdds: number | null;
  wins: number;
  window: string;
  duration: string;
  reviewAt: string | null;
};
type SimulationSummary = {
  runs: number;
  wins: number;
  rate: number;
  lowerBound: number;
};
type MegaPlan = {
  id: string;
  name: string;
  horizon: string;
  legs: Quote[];
  complete: boolean;
  decimalOdds: number;
  draftKingsOdds: number | null;
  marketProbability: number;
  simulationProbability: number;
  simulationOdds: number | null;
  summary: SimulationSummary;
};
type SimulationDetail = {
  id: string;
  title: string;
  subtitle: string;
  odds: number | null;
  impliedProbability: number;
  modelProbability: number;
  modelSource: string;
  simulatedProbability: number;
  conservativeProbability: number;
  expectedValue: number;
  runs: number;
  outcomes: boolean[];
  path: string;
};
type PaperTicket = {
  id: string;
  createdAt: string;
  stake: number;
  decimalOdds: number;
  probability: number;
  status: 'open' | 'won' | 'lost' | 'void';
  legs: Array<{
    quoteId: string;
    eventId: string;
    matchup: string;
    sport: string;
    selection: string;
    betType: string;
    startsAt: string;
    price: number;
    probability: number;
  }>;
};
const fmt = (n: number | null) =>
  n === null
    ? '—'
    : `${n > 0 ? '+' : ''}${Math.abs(n) >= 1000000 ? n.toExponential(2) : n.toLocaleString()}`;
const fmtProbability = (n: number) =>
  n > 0 && n < 0.01 ? `${n.toExponential(2)}%` : `${n.toFixed(2)}%`;
const period = easternPeriod;
const price = (legs: Quote[]) =>
  decimalToAmerican(
    legs.reduce((p, q) => p * (americanToDecimal(q.price) || 1), 1),
  );
const modelProbability = (quote: Quote) =>
  quote.consensusProbability ?? quote.noVigProbability;
const chance = (legs: Quote[]) =>
  legs.reduce((p, q) => (p * modelProbability(q)) / 100, 1) * 100;
const simulationOutcomes = (legs: Quote[], runs = 100) => {
  let seed = legs
    .map((x) => x.id)
    .join('')
    .split('')
    .reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  return Array.from({ length: runs }, () => {
    let hit = true;
    for (const leg of legs) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      if (seed / 4294967296 > modelProbability(leg) / 100) hit = false;
    }
    return hit;
  });
};
const simulationSummary = (legs: Quote[], runs = 10000): SimulationSummary => {
  const wins = simulationOutcomes(legs, runs).filter(Boolean).length;
  const observed = wins / runs;
  const z = 1.96;
  const denominator = 1 + (z * z) / runs;
  const center = observed + (z * z) / (2 * runs);
  const spread =
    z *
    Math.sqrt((observed * (1 - observed)) / runs + (z * z) / (4 * runs * runs));
  return {
    runs,
    wins,
    rate: observed * 100,
    lowerBound: Math.max(0, ((center - spread) / denominator) * 100),
  };
};
const simulate100 = (legs: Quote[]) =>
  simulationOutcomes(legs).filter(Boolean).length;
const rawChance = (legs: Quote[]) =>
  legs.reduce((p, q) => (p * q.impliedProbability) / 100, 1) * 100;
const expectedValue = (probability: number, odds: number) => {
  const decimal = americanToDecimal(odds);
  return decimal ? ((probability / 100) * decimal - 1) * 100 : -100;
};
const eventHours = (sport: string) =>
  /NFL|NCAAF|Football/i.test(sport)
    ? 3.5
    : /MLB|Baseball|NPB|KBO/i.test(sport)
      ? 3
      : /NBA|WNBA|Basketball/i.test(sport)
        ? 2.5
        : /NHL|Hockey|Liiga/i.test(sport)
          ? 2.5
          : /Soccer|EPL|Liga/i.test(sport)
            ? 2.25
            : 2.5;
const shortDate = (date: Date) =>
  date.toLocaleString([], { timeZone: USER_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const panels = [
  'predictions',
  'timed',
  'tracker',
  'week',
  'ready',
  'simulations',
  'parlays',
  'board',
  'ledger',
  'research',
  'tools',
  'coverage',
  'monitoring',
  'arbitrage',
  'strategies',
  'players',
] as const;
type Panel = (typeof panels)[number];
function readSavedArray<T>(key: string): T[] {
  const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  return Array.isArray(value) ? value : [];
}

export default function Home() {
  const [data, setData] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState('');
  const [sport, setSport] = useState('All'),
    [market, setMarket] = useState('all'),
    [when, setWhen] = useState('All'),
    [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [stake, setStake] = useState(10),
    [advanced, setAdvanced] = useState(false),
    [tour, setTour] = useState(false),
    [panel, setPanel] = useState<
      | 'week'
      | 'ready'
      | 'simulations'
      | 'parlays'
      | 'board'
      | 'ledger'
      | 'research'
      | 'tools'
      | 'coverage'
      | 'monitoring'
      | 'arbitrage'
      | 'strategies'
      | 'players'
      | 'tracker'
      | 'predictions'
      | 'timed'
    >('board'),
    [detail, setDetail] = useState<SimulationDetail | null>(null),
    [gameDetail, setGameDetail] = useState<Event | null>(null),
    [paperTickets, setPaperTickets] = useState<PaperTicket[]>([]),
    [ledgerLoaded, setLedgerLoaded] = useState(false),
    [storageError, setStorageError] = useState(''),
    [now, setNow] = useState(Date.now()),
    [shareMessage, setShareMessage] = useState('');
  const [feedSport, setFeedSport] = useState('upcoming');
  const [feedSports,setFeedSports]=useState<{key:string;title:string}[]>([]);
  const [catalogError,setCatalogError]=useState('');
  const [scheduleStatus,setScheduleStatus]=useState('');
  const [scheduleEvents,setScheduleEvents]=useState<Event[]>([]);
  useEffect(()=>{api.get('/api/schedule').then(({data:s})=>{setScheduleEvents(s.events||[]);setScheduleStatus(`${s.events.length} upcoming schedule entries across ${s.sources.length} checked leagues · ${s.sources.filter((x:any)=>x.error).length} source errors · Retrieved ${s.checkedAt}. Odds are separate; coverage is not exhaustive.`);}).catch(()=>setScheduleStatus('Schedule source unavailable; odds snapshots remain separate.'));},[]);
  const broadEvents=useMemo(()=>{const existing=data?.events||[];const key=(e:Event)=>[e.sport,e.home,e.away,e.startsAt].join('|');const keys=new Set(existing.map(key));return [...existing,...scheduleEvents.filter(e=>Date.parse(e.startsAt)>now&&!keys.has(key(e)))].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));},[data,scheduleEvents,now]);
  useEffect(()=>{api.get('/api/sports').then(({data})=>{setFeedSports(data.sports||[]);setCatalogError(data.problem||'');}).catch(()=>setCatalogError('League catalog unavailable'));},[]);
  const load = async (force = false, quiet = false) => {
    if (!quiet) force ? setRefreshing(true) : setBusy(true);
    setError('');
    try {
      const r = force
        ? await api.post('/api/live-state/refresh',{sport:feedSport})
        : await api.get('/api/live-state');
      const payload = (r as any)?.data ?? r;
      if (!Array.isArray(payload?.events) || !Array.isArray(payload?.quotes))
        throw new Error('Invalid feed');
      if(!force && payload.feed?.sport)setFeedSport(payload.feed.sport);
      const clock = Date.now();
      setData({
        ...payload,
        quotes: payload.quotes.map((q: Quote) => ({
          ...q,
          stale: q.stale || !isFreshPrice(q.updatedAt, clock),
        })),
      } as Snapshot);
      setNow(clock);
    } catch {
      setError('The live feed could not be reached. Try refresh in a moment.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
    try {
      setSelected(
        readSavedArray<string>('edge-slip').filter(
          (value) => typeof value === 'string',
        ),
      );
      setFavorites(
        readSavedArray<string>('edge-faves').filter(
          (value) => typeof value === 'string',
        ),
      );
      const saved = readSavedArray<PaperTicket>('edge-paper-ledger-v1');
      if (
        saved.some(
          (ticket) =>
            !ticket ||
            typeof ticket.id !== 'string' ||
            !Array.isArray(ticket.legs) ||
            !validStake(ticket.stake),
        )
      )
        throw new Error('Invalid saved ledger');
      setPaperTickets(saved);
      setTour(!localStorage.getItem('edge-tour-v2'));
      setLedgerLoaded(true);
    } catch {
      setStorageError(
        'Saved browser data could not be loaded. Existing records have been left untouched; use another browser or export your saved data before clearing storage.',
      );
    }
    const onHash = () => {
      const requested = location.hash.slice(1);
      if (panels.includes(requested as Panel)) setPanel(requested as Panel);
      else if (requested === 'today') setPanel('monitoring');
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    const freshnessClock=window.setInterval(()=>{setNow(Date.now());setData(old=>{if(!old)return old;const quotes=old.quotes.map(q=>({...q,stale:!isFreshPrice(q.updatedAt)}));return quotes.some((q,i)=>q.stale!==old.quotes[i].stale)?{...old,quotes}:old;});},15000);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.clearInterval(freshnessClock);
    };
  }, []);
  const navigate = (target: Panel) => {
    setDetail(null);
    setGameDetail(null);
    setPanel(target);
    location.hash = target;
  };
  useEffect(() => {
    if (!ledgerLoaded) return;
    try {
      localStorage.setItem('edge-slip', JSON.stringify(selected));
    } catch {
      setStorageError(
        'Browser storage is unavailable. Export your paper ledger to keep a backup.',
      );
    }
  }, [selected, ledgerLoaded]);
  useEffect(() => {
    if (!ledgerLoaded) return;
    try {
      localStorage.setItem('edge-faves', JSON.stringify(favorites));
    } catch {
      setStorageError(
        'Browser storage is unavailable. Export your paper ledger to keep a backup.',
      );
    }
  }, [favorites, ledgerLoaded]);
  useEffect(() => {
    if (ledgerLoaded)
      try {
        localStorage.setItem(
          'edge-paper-ledger-v1',
          JSON.stringify(paperTickets),
        );
      } catch {
        setStorageError(
          'Paper results could not be saved in this browser. Export a backup before closing this page.',
        );
      }
  }, [paperTickets, ledgerLoaded]);
  useEffect(() => setAdvanced(true), []);
  const sports = useMemo(
    () => [
      'All',
      ...Array.from(new Set((data?.events || []).map((e) => e.sport))),
    ],
    [data],
  );
  const chosen = useMemo(
    () =>
      selected
        .map((id) => data?.quotes.find((q) => q.id === id))
        .filter(Boolean) as Quote[],
    [selected, data],
  );
  const dailyPacks = useMemo<Pack[]>(() => {
    if (!data) return [];
    const bestByEvent = new Map<string, Quote>();
    data.quotes
      .filter(
        (q) =>
          !q.stale &&
          q.price >= -500 &&
          q.price <= 300 &&
          Date.parse(
            data.events.find((e) => e.id === q.eventId)?.startsAt || '',
          ) > Date.now(),
      )
      .forEach((q) => {
        const old = bestByEvent.get(q.eventId);
        if (!old || modelProbability(q) > modelProbability(old))
          bestByEvent.set(q.eventId, q);
      });
    const eligible = [...bestByEvent.values()].sort(
      (a, b) => modelProbability(b) - modelProbability(a),
    );
    const enrich = (legs: Quote[], name: string, label: string): Pack => {
      const times = legs
        .map((q) =>
          Date.parse(data.events.find((e) => e.id === q.eventId)!.startsAt),
        )
        .sort();
      const first = new Date(times[0]),
        last = new Date(times[times.length - 1]),
        firstEvent = data.events.find((e) => e.id === legs[0].eventId)!;
      const checkpoint = new Date(
        +first + eventHours(firstEvent.sport) * 3600000,
      );
      const p = chance(legs),
        raw = rawChance(legs);
      return {
        id: `${label}-${legs.map((x) => x.id).join('-')}`,
        name,
        label,
        legs,
        chance: p,
        rawChance: raw,
        odds: price(legs),
        fairOdds: decimalToAmerican(1 / (p / 100)),
        wins: simulate100(legs),
        window:
          legs.length === 1
            ? shortDate(first)
            : `${shortDate(first)} → ${shortDate(last)}`,
        duration:
          legs.length === 1
            ? 'Single event'
            : `${Math.max(1, Math.round((+last - +first) / 3600000))}h between starts`,
        reviewAt: legs.length > 1 ? shortDate(checkpoint) : null,
      };
    };
    const singles = eligible
      .slice(0, 3)
      .map((q, i) =>
        enrich(
          [q],
          i === 0 ? 'Strongest price consensus' : 'Single market comparison',
          'SINGLE',
        ),
      );
    const pairs: Quote[][] = [];
    for (let i = 0; i < eligible.length; i++)
      for (let j = i + 1; j < eligible.length; j++) {
        const legs = [eligible[i], eligible[j]].sort(
            (a, b) =>
              Date.parse(
                data.events.find((e) => e.id === a.eventId)!.startsAt,
              ) -
              Date.parse(data.events.find((e) => e.id === b.eventId)!.startsAt),
          ),
          ea = data.events.find((e) => e.id === legs[0].eventId)!,
          eb = data.events.find((e) => e.id === legs[1].eventId)!;
        if (
          Date.parse(eb.startsAt) - Date.parse(ea.startsAt) >=
          (eventHours(ea.sport) + 0.5) * 3600000
        )
          pairs.push(legs);
      }
    return [
      ...singles,
      ...pairs
        .sort((a, b) => chance(b) - chance(a))
        .slice(0, 5)
        .map((legs, i) =>
          enrich(
            legs,
            i === 0
              ? 'Highest simulated 2-leg'
              : i === 1
                ? 'Best spaced sequence'
                : 'Time-ordered candidate',
            '2-LEG PARLAY',
          ),
        ),
    ];
  }, [data]);
  const weeklyPacks = useMemo<Pack[]>(() => {
    if (!data) return [];
    const best = new Map<string, Quote>();
    data.quotes
      .filter(
        (q) =>
          !q.stale &&
          q.price >= -500 &&
          q.price <= 250 &&
          Date.parse(
            data.events.find((e) => e.id === q.eventId)?.startsAt || '',
          ) > Date.now(),
      )
      .forEach((q) => {
        const old = best.get(q.eventId);
        if (!old || modelProbability(q) > modelProbability(old))
          best.set(q.eventId, q);
      });
    const legs = [...best.values()]
        .sort(
          (a, b) =>
            Date.parse(data.events.find((e) => e.id === a.eventId)!.startsAt) -
            Date.parse(data.events.find((e) => e.id === b.eventId)!.startsAt),
        )
        .slice(0, 30),
      results: Pack[] = [];
    for (let a = 0; a < legs.length && results.length < 3; a++)
      for (let b = a + 1; b < legs.length && results.length < 3; b++)
        for (let c = b + 1; c < legs.length && results.length < 3; c++) {
          const group = [legs[a], legs[b], legs[c]],
            times = group.map((q) =>
              Date.parse(data.events.find((e) => e.id === q.eventId)!.startsAt),
            );
          if (times[2] - times[0] < 24 * 3600000) continue;
          const p = chance(group),
            raw = rawChance(group),
            first = new Date(times[0]),
            last = new Date(times[2]);
          results.push({
            id: `week-${group.map((q) => q.id).join('-')}`,
            name: 'Three-day weekly sequence',
            label: '3-LEG WEEK PLAN',
            legs: group,
            chance: p,
            rawChance: raw,
            odds: price(group),
            fairOdds: decimalToAmerican(1 / (p / 100)),
            wins: simulate100(group),
            window: `${shortDate(first)} → ${shortDate(last)}`,
            duration: `${Math.round((+last - +first) / 86400000)}d across starts`,
            reviewAt: null,
          });
        }
    return results.sort((a, b) => b.chance - a.chance);
  }, [data]);
  const packs = [...dailyPacks, ...weeklyPacks];
  const topSimulations = useMemo(() => {
    if (!data) return [];
    return data.quotes
      .filter((q) => data.events.some((e) => e.id === q.eventId))
      .map((q) => {
        const event = data.events.find((e) => e.id === q.eventId)!;
        const outcomes = simulationOutcomes([q]);
        const summary = simulationSummary([q]);
        const conservativeEv = expectedValue(summary.lowerBound, q.price);
        return {
          quote: q,
          event,
          outcomes,
          summary,
          conservativeEv,
          gap: summary.rate - q.impliedProbability,
        };
      })
      .sort(
        (a, b) =>
          b.conservativeEv - a.conservativeEv ||
          modelProbability(b.quote) - modelProbability(a.quote),
      )
      .slice(0, 30);
  }, [data]);
  const megaPlans = useMemo<MegaPlan[]>(() => {
    if (!data) return [];
    const now = Date.now();
    const build = (id: string, name: string, horizon: string, end: number) => {
      const best = new Map<string, Quote>();
      data.quotes
        .filter((quote) => {
          const event = data.events.find((item) => item.id === quote.eventId);
          const start = event ? Date.parse(event.startsAt) : 0;
          return start >= now && start <= end;
        })
        .forEach((quote) => {
          const old = best.get(quote.eventId);
          if (!old || modelProbability(quote) > modelProbability(old)) {
            best.set(quote.eventId, quote);
          }
        });
      const legs = [...best.values()]
        .sort((a, b) => modelProbability(b) - modelProbability(a))
        .slice(0, 30)
        .sort(
          (a, b) =>
            Date.parse(
              data.events.find((event) => event.id === a.eventId)!.startsAt,
            ) -
            Date.parse(
              data.events.find((event) => event.id === b.eventId)!.startsAt,
            ),
        );
      const decimalOdds = legs.reduce(
        (total, leg) => total * (americanToDecimal(leg.price) || 1),
        1,
      );
      const simulationProbability = legs.length ? chance(legs) : 0;
      return {
        id,
        name,
        horizon,
        legs,
        complete: legs.length === 30,
        decimalOdds,
        draftKingsOdds: legs.length ? decimalToAmerican(decimalOdds) : null,
        marketProbability: legs.length ? rawChance(legs) : 0,
        simulationProbability,
        simulationOdds:
          simulationProbability > 0
            ? decimalToAmerican(1 / (simulationProbability / 100))
            : null,
        summary: legs.length
          ? simulationSummary(legs)
          : { runs: 10000, wins: 0, rate: 0, lowerBound: 0 },
      };
    };
    return [
      build(
        'daily-30',
        'Daily 30-leg builder',
        'Next 24 hours',
        now + 24 * 60 * 60 * 1000,
      ),
      build(
        'weekly-30',
        'Weekly 30-leg builder',
        'Next seven days',
        now + 7 * 24 * 60 * 60 * 1000,
      ),
    ];
  }, [data]);
  const pricedEventIds = useMemo(
    () => new Set((data?.quotes || []).map((quote) => quote.eventId)),
    [data],
  );
  const scheduleDays = useMemo(() => {
    const groups = new Map<string, { date: Date; events: Event[] }>();
    for (const event of [...(data?.events || [])].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
      const date = new Date(event.startsAt);
      const key = easternDay(date);
      const group = groups.get(key) || { date, events: [] };
      group.events.push(event);
      groups.set(key, group);
    }
    return [...groups.values()].slice(0, 7);
  }, [data]);
  const decimal = chosen.reduce(
      (p, q) => p * (americanToDecimal(q.price) || 1),
      1,
    ),
    combined = chosen.length ? decimalToAmerican(decimal) : null;
  const visible = (data?.events || []).filter(
    (e) =>
      (sport === 'All' || e.sport === sport) &&
      (when === 'All' || period(e.startsAt) === when) &&
      (!query ||
        `${e.sport} ${e.away} ${e.home}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const toggle = (q: Quote) =>
    setSelected((old) =>
      old.includes(q.id)
        ? old.filter((x) => x !== q.id)
        : [
            ...old.filter(
              (id) =>
                data?.quotes.find((x) => x.id === id)?.eventId !== q.eventId,
            ),
            q.id,
          ],
    );
  const usePack = (p: Pack) => {
    setSelected((old) => [
      ...old.filter(
        (id) =>
          !p.legs.some(
            (q) => data?.quotes.find((x) => x.id === id)?.eventId === q.eventId,
          ),
      ),
      ...p.legs.map((q) => q.id),
    ]);
    setTimeout(
      () =>
        document.querySelector('#slip')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  };
  const eventFor = (q: Quote) => data?.events.find((e) => e.id === q.eventId);
  const closeTour = () => {
    try {
      localStorage.setItem('edge-tour-v2', '1');
    } catch {
      /* Tour can still close when storage is unavailable. */
    }
    setTour(false);
  };
  const inspectQuote = (q: Quote) => {
    const e = eventFor(q)!;
    const summary = simulationSummary([q]);
    setGameDetail(null);
    setDetail({
      id: q.id,
      title: q.selection,
      subtitle: `${e.away} at ${e.home}`,
      odds: q.price,
      impliedProbability: q.impliedProbability,
      modelProbability: modelProbability(q),
      modelSource: q.consensusBooks
        ? `${q.consensusBooks}-book cross-book consensus`
        : 'DraftKings no-vig fallback',
      simulatedProbability: summary.rate,
      conservativeProbability: summary.lowerBound,
      expectedValue: expectedValue(summary.lowerBound, q.price),
      runs: summary.runs,
      outcomes: simulationOutcomes([q]),
      path: `DraftKings › ${e.sport} › Game Lines › ${q.betType}`,
    });
  };
  const inspectPack = (p: Pack) => {
    const summary = simulationSummary(p.legs);
    setDetail({
      id: p.id,
      title: p.name,
      subtitle: `${p.legs.length}-leg candidate · ${p.window}`,
      odds: p.odds,
      impliedProbability: p.rawChance,
      modelProbability: p.chance,
      modelSource: `${p.legs.filter((q) => q.consensusBooks > 0).length}/${p.legs.length} legs use cross-book consensus`,
      simulatedProbability: summary.rate,
      conservativeProbability: summary.lowerBound,
      expectedValue:
        p.odds === null ? -100 : expectedValue(summary.lowerBound, p.odds),
      runs: summary.runs,
      outcomes: simulationOutcomes(p.legs),
      path: p.legs.map((q) => `${q.selection} (${q.betType})`).join(' + '),
    });
  };
  const openedGameQuotes = gameDetail
    ? (data?.quotes || []).filter((quote) => quote.eventId === gameDetail.id)
    : [];
  const savePaperTicket = () => {
    if (!chosen.length || !validStake(stake) || !ledgerLoaded) return;
    const probability = chance(chosen);
    const ticket: PaperTicket = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      stake: Math.max(0, stake),
      decimalOdds: decimal,
      probability,
      status: 'open',
      legs: chosen
        .slice()
        .sort(
          (a, b) =>
            Date.parse(eventFor(a)!.startsAt) -
            Date.parse(eventFor(b)!.startsAt),
        )
        .map((quote) => {
          const event = eventFor(quote)!;
          return {
            quoteId: quote.id,
            eventId: event.id,
            matchup: `${event.away} at ${event.home}`,
            sport: event.sport,
            selection: quote.selection,
            betType: quote.betType,
            startsAt: event.startsAt,
            price: quote.price,
            probability: modelProbability(quote),
          };
        }),
    };
    setPaperTickets((tickets) => [ticket, ...tickets]);
    setPanel('ledger');
    location.hash = 'ledger';
  };
  const settleTicket = (id: string, status: 'open' | 'won' | 'lost' | 'void') =>
    setPaperTickets((tickets) =>
      tickets.map((ticket) =>
        ticket.id === id ? { ...ticket, status } : ticket,
      ),
    );
  const ledgerMetrics = useMemo(() => {
    const resolved = paperTickets.filter((ticket) =>
      ['won', 'lost'].includes(ticket.status),
    );
    const stakeRisked = resolved.reduce((sum, ticket) => sum + ticket.stake, 0);
    const profit = resolved.reduce(
      (sum, ticket) =>
        sum +
        (ticket.status === 'won'
          ? ticket.stake * (ticket.decimalOdds - 1)
          : -ticket.stake),
      0,
    );
    const brier = resolved.length
      ? resolved.reduce((sum, ticket) => {
          const observed = ticket.status === 'won' ? 1 : 0;
          return sum + (ticket.probability / 100 - observed) ** 2;
        }, 0) / resolved.length
      : null;
    return {
      resolved: resolved.length,
      wins: resolved.filter((ticket) => ticket.status === 'won').length,
      profit,
      roi: stakeRisked ? (profit / stakeRisked) * 100 : 0,
      brier,
    };
  }, [paperTickets]);
  const exportLedger = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            tickets: paperTickets,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'edgeline-paper-results.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setShareMessage('Link copied');
    } catch {
      setShareMessage('Copy the page address to share this view.');
    }
  };
  return (
    <>
      <Head>
        <title>EdgeLine — DraftKings Market Desk</title>
        <meta
          name="description"
          content="A live DraftKings-aligned market desk and manual parlay planner."
        />
      </Head>
      <header>
        <a className="brand" href="#today">
          <span>EDGE</span>LINE <i>MARKET DESK</i>
        </a>
        <div className="status">
          <b />{' '}
          {error || data?.feed.problem
            ? 'SOURCE NEEDS ATTENTION'
            : data?.feed.fetchedAt
              ? 'FREE BETA · CACHED PRICES'
              : 'CONNECTING'}
        </div>
        <div className="headerActions">
          <button className="mode" onClick={() => setAdvanced(!advanced)}>
            {advanced ? 'Advanced data' : 'Simple view'}
          </button>
          <button
            className="icon"
            onClick={copyShareLink}
            aria-label="Copy share link"
          >
            <Share2 size={18} />
          </button>
          <span role="status">{shareMessage}</span>
        </div>
      </header>
      <div className="ticker">
        <div className="tickerLabel">
          <Zap size={14} /> MARKET TICKER
        </div>
        <div className="tickerWindow">
          <div className="tickerTrack">
            {[...(data?.events || []), ...(data?.events || [])]
              .slice(0, 16)
              .map((e, i) => {
                const q = data?.quotes.find(
                  (x) => x.eventId === e.id && x.marketKey === 'h2h',
                );
                return (
                  <span key={`${e.id}-${i}`}>
                    <b>{e.sport}</b>
                    {e.away} @ {e.home}
                    <time>
                      {new Date(e.startsAt).toLocaleTimeString([], { timeZone: USER_TIME_ZONE,
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                    {q && (
                      <strong>
                        {q.selection} {fmt(q.price)}
                      </strong>
                    )}
                    <i />
                  </span>
                );
              })}
          </div>
        </div>
        <button
          aria-label="Refresh market snapshot"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      <div className="shell">
        <aside>
          <nav>
            <a href="#board">Market board</a>
            <a href="#predictions">Prediction markets</a>
            <a href="#timed">Timed parlays</a>
            <a href="#tracker">Results tracker <b>{paperTickets.length}</b></a>
            <a href="#players">Player research</a>
            <a href="#coverage">Coverage audit</a>
            <a href="#monitoring">System & learning</a>
            <a href="#slip">
              My bet slip <b>{chosen.length}</b>
            </a>
            <a href="#guide">Phone guide</a>
          </nav>
          <div className="truth">
            <ShieldCheck size={20} />
            <strong>Decision support</strong>
            <p>
              Odds and simulations inform a choice; they never guarantee a
              result or profit.
            </p>
          </div>
        </aside>
        <main id="today">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <Activity size={14} /> SEVEN-DAY SPORTS MARKET
              </div>
              <h1>
                Your sports research
                <br />
                <em>command center.</em>
              </h1>
              <p>
                Real DraftKings odds, cross-book comparisons, timed parlay research and public prediction-market snapshots. Free credits fund bounded snapshots, not continuous live prices. Times shown in Eastern Time.
              </p>
            </div>
            <div className="heroStats">
              <div>
                <strong>{broadEvents.length}</strong>
                <span>scheduled events</span>
              </div>
              <div>
                <strong>{pricedEventIds.size}</strong>
                <span>games with odds</span>
              </div>
              <div>
                <strong>{data?.quotes.filter((quote) => !quote.stale && isFreshPrice(quote.updatedAt, now)).length || 0}</strong>
                <span>sim-ready selections</span>
              </div>
            </div>
          </section>
          <section className="feedline"><label>Odds league <select aria-label="Odds league" value={feedSport} onChange={e=>setFeedSport(e.target.value)}><option value="upcoming">Next 8 games across sports</option>{feedSports.map(s=><option key={s.key} value={s.key}>{s.title}</option>)}</select></label><button disabled={refreshing} onClick={()=>load(true)}>{refreshing?'Refreshing…':'Refresh selected league'}</button><span>Displayed: {data?.feed.sport || 'Connecting'} · Snapshot: {data?.feed.fetchedAt?new Date(data.feed.fetchedAt).toLocaleString('en-US',{timeZone:USER_TIME_ZONE}):'None'}</span></section>
          <div className="feedPolicy"><strong>Free-tier credit protection</strong><span>{data?.feed.manualRefreshesRemaining??'—'} refreshes left today · {data?.feed.creditsReserved??'—'}/{data?.feed.monthlyLimit??300} app credits reserved this month · Provider credits left: {data?.feed.remaining??'Unknown'}</span><span>Shared 30-minute cooldown, 3 refreshes/day. Up to 3 credits per refresh. Quotes older than five minutes are excluded from ready parlays and arbitrage.</span><span role="status">{data?.feed.refreshMessage || catalogError}</span></div>
          {storageError && (
            <div className="alert" role="alert">
              {storageError}
            </div>
          )}
          {(error || data?.feed.problem) && (
            <div className="alert">
              {error || data?.feed.problem}
            </div>
          )}
          <nav className="viewSwitch" aria-label="Main workspace">
            {([['board','Market board'],['arbitrage','Edges & arbitrage'],['predictions','Prediction markets'],['timed','Timed parlays'],['tracker','Results tracker'],['players','Player research'],['coverage','Coverage'],['monitoring','System & learning']] as const).map(([id,label])=><button key={id} className={panel===id?'active':''} onClick={()=>navigate(id)}>{label}</button>)}
          </nav>
          <details style={{margin:'12px 0'}}><summary>Research tools & saved tickets</summary><div className="viewSwitch">{([['ledger','Grade paper tickets'],['research','Historical validation'],['week','Schedule'],['strategies','Strategy guide'],['simulations','Market simulation diagnostics'],['parlays','Extended parlay lab'],['tools','Provider references'],['ready','Legacy candidates']] as const).map(([id,label])=><button key={id} onClick={()=>navigate(id)}>{label}</button>)}</div></details>
          <p role="status">Source-backed pregame analysis. Market-implied simulations are not independent forecasts. Public injury and roster reports are in Player updates; confirmed lineups and probability adjustments remain unverified. Prediction-market contracts are inspected separately.</p>
          {panel === 'arbitrage' && <section><span className="eyebrow">CROSS-BOOK PRICE CHECK</span><h2>Arbitrage candidates</h2><p>DraftKings vs FanDuel full-game moneylines only. Every outcome must match, all prices must be under five minutes old, and the event must not have started. These are theoretical price discrepancies; confirm identical settlement rules, limits and available stakes before considering execution. Exchange contracts and fees are not included.</p>{(data?.arbitrage||[]).filter(a=>Date.parse(a.startsAt)>now&&a.legs.every(l=>isFreshPrice(l.updatedAt,now))).length===0?<div className="alert">No qualifying arbitrage in this snapshot. This is not a claim that none exists elsewhere.</div>:(data?.arbitrage||[]).filter(a=>Date.parse(a.startsAt)>now&&a.legs.every(l=>isFreshPrice(l.updatedAt,now))).map(a=><article key={a.eventId}><h3>{a.matchup}</h3><p>{a.margin.toFixed(2)}% theoretical return before execution constraints · {a.market}</p>{a.legs.map(l=><p key={l.selection}>{l.book}: {l.selection} · {fmt(l.price)} · {(l.share*100).toFixed(2)}% of total stake · {new Date(l.updatedAt).toLocaleTimeString()}</p>)}</article>)}</section>}
          {panel === 'predictions' && <PredictionDesk />}
          {panel === 'timed' && <TimedParlays data={data} now={now} onUse={ids=>{setSelected(ids);document.querySelector('#slip')?.scrollIntoView({behavior:'smooth'});}} />}
          {panel === 'board' && <section className="researchPanel"><h2>Upcoming games — free schedule coverage</h2><p>{scheduleStatus||'Loading independent league schedules…'}</p><details><summary>Browse {broadEvents.length} scheduled games, including games without odds</summary><table><thead><tr><th>League</th><th>Game</th><th>Start</th><th>Pricing</th></tr></thead><tbody>{broadEvents.map(e=><tr key={e.id}><td>{e.sport}</td><td><button onClick={()=>setGameDetail(e)}>{e.matchup}</button></td><td>{new Date(e.startsAt).toLocaleString()}</td><td>{e.markets?'Snapshot available — check age':'Odds unavailable'}</td></tr>)}</tbody></table></details></section>}
          {panel === 'strategies' && <Strategies />}
          {panel === 'tracker' && <Tracker tickets={paperTickets} />}
          {panel === 'players' && <PlayerUpdates />}
          {panel === 'monitoring' && <Monitoring />}
          {panel === 'research' && <Research />}
          {panel === 'tools' && <ProfessionalDesk />}
          {panel === 'coverage' && <ProfessionalDesk coverage />}
          {panel === 'week' && (
            <section id="week">
              <div className="titleRow">
                <div>
                  <span className="eyebrow">ADVANCE SIMULATION QUEUE</span>
                  <h2>Next seven days</h2>
                </div>
                <p>
                  Every available scheduled event · simulations switch on when
                  DraftKings posts usable odds
                </p>
              </div>
              {busy ? (
                <div className="loading">Building the seven-day schedule…</div>
              ) : scheduleDays.length ? (
                <div className="weekBoard">
                  {scheduleDays.map((day) => (
                    <section className="weekDay" key={easternDay(day.date)}>
                      <div className="weekDayHead">
                        <div>
                          <span>
                            {day.date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) ===
                            new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
                              ? 'TODAY' : 'UPCOMING'}
                          </span>
                          <strong>
                            {day.date.toLocaleDateString([], { timeZone: USER_TIME_ZONE,
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </strong>
                        </div>
                        <b>{day.events.length} events</b>
                      </div>
                      <div className="weekEvents">
                        {day.events.map((event) => {
                          const quotes = (data?.quotes || []).filter(
                            (quote) => quote.eventId === event.id,
                          );
                          const best = quotes
                            .slice()
                            .sort(
                              (a, b) =>
                                modelProbability(b) - modelProbability(a),
                            )[0];
                          return (
                            <article className="weekEvent" key={event.id}>
                              <time>
                                {new Date(event.startsAt).toLocaleTimeString(
                                  [],
                                  { timeZone: USER_TIME_ZONE, hour: 'numeric', minute: '2-digit' },
                                )}
                              </time>
                              <div className="weekMatchup">
                                <span>{event.sport}</span>
                                <strong>
                                  {event.away} at {event.home}
                                </strong>
                              </div>
                              {best ? (
                                <div className="weekReady">
                                  <span>
                                    <i />{' '}
                                    {best.stale ? 'CACHED ODDS' : 'RECENT ODDS'}
                                  </span>
                                  <strong>100 simulations ready</strong>
                                  <small>
                                    {quotes.length} priced selections
                                  </small>
                                </div>
                              ) : (
                                <div className="weekQueued">
                                  <span>ODDS PENDING</span>
                                  <strong>Simulation queued</strong>
                                  <small>
                                    Starts when DraftKings posts a line
                                  </small>
                                </div>
                              )}
                              <button onClick={() => setGameDetail(event)}>
                                Open game <ChevronRight size={15} />
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  No scheduled events were returned for the next seven days.
                </div>
              )}
              <div className="modelNotice">
                <ShieldCheck />
                <div>
                  <strong>Schedule first, prices second</strong>
                  <p>
                    Schedule discovery does not consume the odds allowance.
                    Events remain visible before prices exist; EdgeLine only
                    generates a probability simulation after a valid DraftKings
                    market arrives. No placeholder odds or invented simulations
                    are used.
                  </p>
                </div>
              </div>
            </section>
          )}
          {panel === 'ready' && (
            <section id="ready">
              <div className="titleRow">
                <div>
                  <span className="eyebrow">MARKET-BASED SIMULATION</span>
                  <h2>Time-structured review candidates</h2>
                </div>
                <p>
                  100 auditable trials per card · cross-book market consensus
                  when matching prices are available
                </p>
              </div>
              {busy ? (
                <div className="loading">Building today’s market board…</div>
              ) : packs.length ? (
                <div className="readyGrid">
                  {packs.map((p, i) => (
                    <article
                      className={`readyCard ${i === 0 ? 'featured' : ''}`}
                      key={p.id}
                    >
                      <div className="cardFlag">
                        <span>{p.label}</span>
                        {i === 0 && <b>HIGHEST MODEL RANK</b>}
                      </div>
                      <h3>{p.name}</h3>
                      <div className="timePlan">
                        <Clock3 size={15} />
                        <div>
                          <strong>{p.window}</strong>
                          <span>{p.duration}</span>
                        </div>
                      </div>
                      {p.reviewAt && (
                        <p className="reviewCheckpoint">
                          Review checkpoint: {p.reviewAt}. Estimated event end
                          only; a cash-out offer and amount are not supplied by
                          this feed.
                        </p>
                      )}
                      <div className="sim">
                        <div
                          className="ring"
                          style={
                            {
                              '--score': `${p.wins * 3.6}deg`,
                            } as React.CSSProperties
                          }
                        >
                          <strong>{p.wins}</strong>
                          <small>/100</small>
                        </div>
                        <div>
                          <span>simulated wins</span>
                          <b>{p.chance.toFixed(1)}% modeled probability</b>
                          <small>
                            {p.legs.filter((q) => q.consensusBooks > 0).length}/
                            {p.legs.length} legs independently compared
                          </small>
                        </div>
                      </div>
                      <div className="miniLegs">
                        {p.legs.map((q) => {
                          const e = eventFor(q),
                            fair = decimalToAmerican(
                              1 / (modelProbability(q) / 100),
                            );
                          return (
                            <div key={q.id}>
                              <span>
                                {e?.sport} ·{' '}
                                {new Date(e!.startsAt).toLocaleTimeString([], { timeZone: USER_TIME_ZONE,
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                · Game Lines
                              </span>
                              <strong>{q.selection}</strong>
                              <small>
                                {q.betType} · DK {fmt(q.price)} · modeled fair{' '}
                                {fmt(fair)} · {q.consensusBooks || 0} comparison
                                books
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="comparison">
                        <div>
                          <span>DraftKings</span>
                          <strong>{fmt(p.odds)}</strong>
                        </div>
                        <div>
                          <span>Modeled fair line</span>
                          <strong>{fmt(p.fairOdds)}</strong>
                        </div>
                        <div>
                          <span>Estimate minus implied chance</span>
                          <strong>
                            {(p.chance - p.rawChance).toFixed(1)} pts
                          </strong>
                        </div>
                      </div>
                      <p>{p.chance > p.rawChance ? "Positive market-price discrepancy; independent validation pending." : "No positive price edge against this market estimate."}</p>
                      <div className="cardActions">
                        <button
                          className="inspect"
                          onClick={() => inspectPack(p)}
                        >
                          <Eye size={17} /> View 100 runs
                        </button>
                        <button
                          className="addTicket"
                          onClick={() => usePack(p)}
                        >
                          <Check size={17} /> Add to slip
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  No fresh tickets can be assembled from the current snapshot.
                </div>
              )}
              <div className="modelNotice">
                <ShieldCheck />
                <div>
                  <strong>How the ranking works</strong>
                  <p>
                    Every current DraftKings line remains in All Live Markets.
                    Candidate cards remove same-game duplication, order legs by
                    start time, run 100 auditable trials, and compare DraftKings
                    with matching no-vig prices from other books. DK no-vig is
                    used only when no independent match is available. This is
                    comparison data—not an instruction or profit guarantee.
                  </p>
                </div>
              </div>
            </section>
          )}
          {panel === 'simulations' && (
            <section id="simulations">
              <div className="titleRow">
                <div>
                  <span className="eyebrow">MARKET-BASED DIAGNOSTICS</span>
                  <h2>Market probability diagnostics</h2>
                </div>
                <p>
                  Ranked by market-derived expected value · 100-run visual audit
                  remains available in every detail view
                </p>
              </div>
              {busy ? (
                <div className="loading">
                  Running 10,000 trials for each current selection…
                </div>
              ) : topSimulations.length ? (
                <div className="simTable">
                  <div className="simTableHead">
                    <span>Rank / selection</span>
                    <span>DraftKings</span>
                    <span>10,000 simulations</span>
                    <span>Difference</span>
                    <span>Actions</span>
                  </div>
                  {topSimulations.map((item, i) => {
                    const qualifies =
                      !item.quote.stale &&
                      Date.parse(item.event.startsAt) > now &&
                      item.quote.consensusBooks >= 2 &&
                      item.conservativeEv > 0;
                    const tone = qualifies ? 'positive' : 'negative';
                    return (
                      <article className="simRow" key={item.quote.id}>
                        <div className="simIdentity">
                          <b>#{i + 1}</b>
                          <div>
                            <span>
                              {item.event.sport} ·{' '}
                              {new Date(item.event.startsAt).toLocaleString(
                                [],
                                { timeZone: USER_TIME_ZONE,
                                  weekday: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                },
                              )}
                            </span>
                            <strong>{item.quote.selection}</strong>
                            <small>
                              {item.event.away} at {item.event.home} ·{' '}
                              {item.quote.betType}
                            </small>
                          </div>
                        </div>
                        <div className="simMetric">
                          <span>{fmt(item.quote.price)}</span>
                          <strong>
                            {item.quote.impliedProbability.toFixed(1)}%
                          </strong>
                          <small>implied</small>
                        </div>
                        <div className="simMetric">
                          <span>
                            {item.summary.wins.toLocaleString()}/10,000
                          </span>
                          <strong>{item.summary.rate.toFixed(2)}%</strong>
                          <small>
                            {item.summary.lowerBound.toFixed(2)}% conservative ·{' '}
                            {item.conservativeEv.toFixed(2)}% EV
                          </small>
                          <small>
                            {item.quote.consensusBooks
                              ? `${item.quote.consensusBooks} comparison books`
                              : 'DK-only fallback'}
                          </small>
                        </div>
                        <div className={`gap ${tone}`}>
                          <strong>
                            {item.gap > 0 ? '+' : ''}
                            {item.gap.toFixed(2)} pts
                          </strong>
                          <span>
                            {qualifies
                              ? 'POSITIVE MODEL EV · UNVALIDATED'
                              : item.quote.stale
                                ? 'STALE · RECONFIRM PRICE'
                                : Date.parse(item.event.startsAt) <= now
                                  ? 'STARTED · RESEARCH ONLY'
                                  : 'NO BET · EDGE NOT PROVEN'}
                          </span>
                        </div>
                        <div className="rowActions">
                          <button onClick={() => inspectQuote(item.quote)}>
                            <Eye size={16} /> Details
                          </button>
                          <button
                            className={
                              selected.includes(item.quote.id) ? 'selected' : ''
                            }
                            onClick={() => toggle(item.quote)}
                          >
                            <Check size={16} />
                            {selected.includes(item.quote.id) ? 'Added' : 'Add'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">
                  No fresh selections are available for simulation.
                </div>
              )}
              <div className="modelNotice">
                <ShieldCheck />
                <div>
                  <strong>Read the difference correctly</strong>
                  <p>
                    The model first averages matching no-vig probabilities from
                    other sportsbooks, then compares that cross-book consensus
                    with DraftKings. A qualified label requires at least two
                    comparison books and positive conservative EV. DK-only
                    fallbacks remain research comparisons, never qualified bets.
                    These are market-price simulations, not player or score
                    forecasts. The lower bound describes sampling noise only;
                    profitability has not been validated. Started games and
                    stale quotes cannot qualify.
                  </p>
                </div>
              </div>
            </section>
          )}
          {panel === 'parlays' && (
            <section id="parlays">
              <div className="titleRow">
                <div>
                  <span className="eyebrow">HIGH-VARIANCE STRUCTURE LAB</span>
                  <h2>Daily and weekly 30-leg builders</h2>
                </div>
                <p>
                  Exactly one selection per event · DraftKings price beside
                  simulation-derived fair price
                </p>
              </div>
              <div className="megaGrid">
                {megaPlans.map((plan) => (
                  <article className="megaCard" key={plan.id}>
                    <div className="megaTop">
                      <div>
                        <span>{plan.horizon}</span>
                        <h3>{plan.name}</h3>
                      </div>
                      <b className={plan.complete ? 'complete' : ''}>
                        {plan.legs.length}/30 PRICED LEGS
                      </b>
                    </div>
                    <div className="megaWarning">
                      <ShieldCheck size={18} />
                      <span>
                        {plan.complete
                          ? 'Complete construction available. High variance; not a recommended default.'
                          : `Waiting for ${30 - plan.legs.length} additional independently priced games.`}
                      </span>
                    </div>
                    {plan.legs.some(q=>q.stale) && <p role="status">Snapshot research only: some quotes are older than five minutes. Slip loading is disabled until prices are refreshed.</p>}
                    <div className="megaMath">
                      <div>
                        <span>DraftKings combined</span>
                        <strong>{fmt(plan.draftKingsOdds)}</strong>
                        <small>
                          {plan.legs.length ? plan.decimalOdds.toExponential(3)+' decimal' : 'No priced legs'}
                        </small>
                      </div>
                      <div>
                        <span>Simulation fair odds</span>
                        <strong>{fmt(plan.simulationOdds)}</strong>
                        <small>
                          {fmtProbability(plan.simulationProbability)}
                        </small>
                      </div>
                      <div>
                        <span>Market-implied chance</span>
                        <strong>
                          {fmtProbability(plan.marketProbability)}
                        </strong>
                        <small>before no-vig adjustment</small>
                      </div>
                      <div>
                        <span>10,000-run result</span>
                        <strong>
                          {plan.summary.wins.toLocaleString()} wins
                        </strong>
                        <small>{fmtProbability(plan.summary.rate)}</small>
                      </div>
                    </div>
                    <div className="megaLegs">
                      {plan.legs.map((leg, index) => {
                        const event = eventFor(leg)!;
                        return (
                          <button
                            key={leg.id}
                            onClick={() => setGameDetail(event)}
                          >
                            <b>{index + 1}</b>
                            <span>
                              <strong>{leg.selection}</strong>
                              <small>
                                {event.sport} · {leg.betType} · DK{' '}
                                {fmt(leg.price)}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="addTicket"
                      disabled={!plan.legs.length || plan.legs.some(q=>q.stale)}
                      onClick={() =>
                        setSelected(plan.legs.map((leg) => leg.id))
                      }
                    >
                      <Check size={17} /> Load available legs into my slip
                    </button>
                  </article>
                ))}
              </div>
              <div className="modelNotice">
                <ShieldCheck />
                <div>
                  <strong>Integrity check</strong>
                  <p>
                    Thirty-leg parlays usually produce extremely small joint
                    probabilities and high variance. EdgeLine keeps these
                    requested structures visible, but never labels them safe or
                    profitable. Missing legs remain missing—no placeholder odds
                    are inserted.
                  </p>
                </div>
              </div>
            </section>
          )}
          {panel === 'ledger' && (
            <section id="ledger">
              <div className="titleRow">
                <div>
                  <span className="eyebrow">PERSONAL PAPER LEDGER</span>
                  <h2>Prove the model before risking money</h2>
                </div>
                <button
                  className="inspect"
                  onClick={exportLedger}
                  disabled={!paperTickets.length}
                >
                  Download results backup
                </button>
                <p>
                  Stored only in this browser · manually settle completed
                  tickets · measure actual ROI and calibration
                </p>
              </div>
              <div className="ledgerStats">
                <div>
                  <span>Paper tickets</span>
                  <strong>{paperTickets.length}</strong>
                </div>
                <div>
                  <span>Resolved record</span>
                  <strong>
                    {ledgerMetrics.wins}-
                    {ledgerMetrics.resolved - ledgerMetrics.wins}
                  </strong>
                </div>
                <div>
                  <span>Paper profit / loss</span>
                  <strong className={ledgerMetrics.profit >= 0 ? 'up' : 'down'}>
                    {ledgerMetrics.profit >= 0 ? '+' : '-'}$
                    {Math.abs(ledgerMetrics.profit).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Paper ROI</span>
                  <strong className={ledgerMetrics.roi >= 0 ? 'up' : 'down'}>
                    {ledgerMetrics.roi >= 0 ? '+' : ''}
                    {ledgerMetrics.roi.toFixed(1)}%
                  </strong>
                </div>
                <div>
                  <span>Brier score</span>
                  <strong>
                    {ledgerMetrics.brier === null
                      ? '—'
                      : ledgerMetrics.brier.toFixed(3)}
                  </strong>
                </div>
              </div>
              {paperTickets.length ? (
                <div className="ledgerList">
                  {paperTickets.map((ticket) => {
                    const movement = capturedPriceAdvantage(
                      ticket.legs,
                      data?.quotes || [],
                      now,
                    );
                    return (
                      <article className="ledgerTicket" key={ticket.id}>
                        <div className="ledgerTicketTop">
                          <div>
                            <span>
                              {new Date(ticket.createdAt).toLocaleString('en-US', { timeZone: USER_TIME_ZONE })} ·{' '}
                              {ticket.legs.length} leg
                              {ticket.legs.length === 1 ? '' : 's'}
                            </span>
                            <h3>
                              ${ticket.stake.toFixed(2)} paper stake ·{' '}
                              {fmt(decimalToAmerican(ticket.decimalOdds))}
                            </h3>
                          </div>
                          <b className={`ticketStatus ${ticket.status}`}>
                            {ticket.status.toUpperCase()}
                          </b>
                        </div>
                        <div className="ledgerMath">
                          <span>
                            Model <b>{fmtProbability(ticket.probability)}</b>
                          </span>
                          <span>
                            Potential return{' '}
                            <b>
                              ${(ticket.stake * ticket.decimalOdds).toFixed(2)}
                            </b>
                          </span>
                          <span>
                            Captured price advantage{' '}
                            <b
                              className={
                                movement === null
                                  ? ''
                                  : movement >= 0
                                    ? 'up'
                                    : 'down'
                              }
                            >
                              {movement === null
                                ? 'Unavailable — matching fresh lines needed'
                                : `${movement >= 0 ? '+' : ''}${movement.toFixed(1)}%`}
                            </b>
                          </span>
                        </div>
                        <div className="ledgerLegs">
                          {ticket.legs.map((leg) => (
                            <div key={leg.quoteId}>
                              <span>
                                {leg.sport} · {leg.betType}
                              </span>
                              <strong>{leg.selection}</strong>
                              <small>
                                {leg.matchup} · captured {fmt(leg.price)} ·{' '}
                                {leg.probability.toFixed(1)}% model
                              </small>
                            </div>
                          ))}
                        </div>
                        {ticket.status === 'open' && (
                          <div className="settleActions">
                            <span>
                              Settle after DraftKings grades the ticket:
                            </span>
                            <button
                              onClick={() => settleTicket(ticket.id, 'won')}
                            >
                              Mark won
                            </button>
                            <button
                              onClick={() => settleTicket(ticket.id, 'lost')}
                            >
                              Mark lost
                            </button>
                            <button
                              onClick={() => settleTicket(ticket.id, 'void')}
                            >
                              Mark void
                            </button>
                          </div>
                        )}
                        {ticket.status !== 'open' && (
                          <div className="settleActions">
                            <button
                              onClick={() => settleTicket(ticket.id, 'open')}
                            >
                              Reopen to correct result
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty ledgerEmpty">
                  <ClipboardList size={28} />
                  <strong>No paper results yet</strong>
                  <span>
                    Build a slip, save it as a paper ticket, then record the
                    final result. This is how EdgeLine learns whether an
                    apparent edge survives outside the screen.
                  </span>
                  <button onClick={() => setPanel('simulations')}>
                    Review top simulations
                  </button>
                </div>
              )}
              <div className="modelNotice">
                <ShieldCheck />
                <div>
                  <strong>Line movement is not closing-line value yet</strong>
                  <p>
                    Positive means your captured payout is higher than the
                    current matching payout. Missing, changed or stale lines
                    show unavailable. This is not a recorded closing line. Lower
                    Brier scores are better; a meaningful model record needs
                    many resolved bets.
                  </p>
                </div>
              </div>
            </section>
          )}
          {panel === 'board' && (
            <section id="board">
              <div className="filters">
                <label className="search">
                  <Search size={17} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search team or sport"
                  />
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  {sports.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <select value={when} onChange={(e) => setWhen(e.target.value)}>
                  {['All', 'Morning', 'Afternoon', 'Evening', 'Overnight'].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <div className="segments">
                  {[
                    ['all', 'All'],
                    ['h2h', 'Moneyline'],
                    ['spreads', 'Spread'],
                    ['totals', 'Total'],
                  ].map(([k, l]) => (
                    <button
                      className={market === k ? 'active' : ''}
                      onClick={() => setMarket(k)}
                      key={k}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {['Morning', 'Afternoon', 'Evening', 'Overnight'].map((block) => {
                const list = visible.filter(
                  (e) => period(e.startsAt) === block,
                );
                return list.length ? (
                  <section className="timeblock" key={block}>
                    <div className="sectionTitle">
                      <h2>{block}</h2>
                      <span>{list.length} events</span>
                    </div>
                    <div className="cards">
                      {list.map((e) => {
                        const qs = (data?.quotes || []).filter(
                          (q) =>
                            q.eventId === e.id &&
                            (market === 'all' || q.marketKey === market),
                        );
                        return (
                          <article className="event" key={e.id}>
                            <div className="eventTop">
                              <div>
                                <span className="sport">{e.sport}</span>
                                <time>
                                  {new Date(e.startsAt).toLocaleTimeString([], { timeZone: USER_TIME_ZONE,
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </time>
                              </div>
                              <div className="eventActions">
                                <button
                                  className="gameOpen"
                                  onClick={() => setGameDetail(e)}
                                >
                                  <Eye size={15} /> Open game
                                </button>
                                <button
                                  className={`heart ${favorites.includes(e.id) ? 'on' : ''}`}
                                  onClick={() =>
                                    setFavorites((x) =>
                                      x.includes(e.id)
                                        ? x.filter((i) => i !== e.id)
                                        : [...x, e.id],
                                    )
                                  }
                                  aria-label={
                                    favorites.includes(e.id)
                                      ? 'Remove game from favorites'
                                      : 'Add game to favorites'
                                  }
                                >
                                  <Heart size={17} />
                                </button>
                              </div>
                            </div>
                            <h3>
                              {e.away}
                              <small>at</small>
                              {e.home}
                            </h3>
                            {['h2h', 'spreads', 'totals'].map((k) => {
                              const rows = qs.filter((q) => q.marketKey === k);
                              return rows.length ? (
                                <div className="market" key={k}>
                                  <div className="marketLabel">
                                    <span>DraftKings · Game Lines</span>
                                    <b>{rows[0].betType}</b>
                                  </div>
                                  <div className="outcomes">
                                    {rows.map((q) => (
                                      <button
                                        key={q.id}
                                        className={`${selected.includes(q.id) ? 'picked' : ''} ${q.stale ? 'stale' : ''}`}
                                        onClick={() => toggle(q)}
                                      >
                                        <span>{q.selection}</span>
                                        <strong>{fmt(q.price)}</strong>
                                        {advanced && (
                                          <small>
                                            {modelProbability(q)}% model ·{' '}
                                            {q.consensusBooks
                                              ? `${q.consensusBooks} books`
                                              : 'DK fallback'}
                                          </small>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            })}
                            {!qs.length && (
                              <div className="oddsPending">
                                <Clock3 size={16} />
                                <div>
                                  <strong>DraftKings odds not posted</strong>
                                  <span>
                                    Scheduled · 100-run simulation queued
                                  </span>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null;
              })}
            </section>
          )}
          <section id="slip" className="slip">
            <div className="slipHead">
              <div>
                <span className="eyebrow">PHONE-READY TICKET</span>
                <h2>My manual bet slip</h2>
              </div>
              {chosen.length > 0 && (
                <button className="clear" onClick={() => setSelected([])}>
                  <Trash2 size={15} /> Clear
                </button>
              )}
            </div>
            {selected.length > chosen.length && (
              <div className="alert">
                {selected.length - chosen.length} saved selection(s) are no
                longer in this snapshot. Re-select current lines before saving a
                new paper ticket.
              </div>
            )}
            {!chosen.length ? (
              <div className="empty">
                Choose a ready ticket or tap a line in All available markets.
              </div>
            ) : (
              <>
                <div className="legs">
                  {chosen
                    .slice()
                    .sort(
                      (a, b) =>
                        Date.parse(eventFor(a)!.startsAt) -
                        Date.parse(eventFor(b)!.startsAt),
                    )
                    .map((q, i) => {
                      const e = eventFor(q)!;
                      return (
                        <div className="leg" key={q.id}>
                          <span className="number">{i + 1}</span>
                          <div>
                            <strong>{q.selection}</strong>
                            <p>
                              {e.away} at {e.home} ·{' '}
                              {new Date(e.startsAt).toLocaleString([], { timeZone: USER_TIME_ZONE,
                                weekday: 'short',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                            <small>
                              DraftKings <ChevronRight /> {e.sport}{' '}
                              <ChevronRight /> Game Lines <ChevronRight />{' '}
                              {q.betType}
                            </small>
                          </div>
                          <b>{fmt(q.price)}</b>
                          <button
                            onClick={() => toggle(q)}
                            aria-label={`Remove ${q.selection}`}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      );                    })}
                </div>
                <div className="slipMath">
                  <label>
                    Stake $
                    <input
                      type="number"
                      min="1"
                      value={stake}
                      onChange={(e) => setStake(Number(e.target.value))}
                    />
                  </label>
                  <div>
                    <span>Combined snapshot odds</span>
                    <strong>{fmt(combined)}</strong>
                  </div>
                  <div>
                    <span>Potential return</span>
                    <strong>${(stake * decimal).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Market-implied chance</span>
                    <strong>{(100 / decimal).toFixed(1)}%</strong>
                  </div>
                </div>
                {chosen.some((q) => q.stale) ? (
                  <div className="alert">
                    A selected price is older than five minutes. Refresh and
                    confirm it on your phone.
                  </div>
                ) : (
                  <div className="ready">
                    <ShieldCheck size={18} /> Ready to compare. Confirm every
                    selection and price in DraftKings before entry.
                  </div>
                )}
                {!validStake(stake) && (
                  <p role="alert">
                    Enter a paper stake greater than $0 and no more than
                    $1,000,000.
                  </p>
                )}
                <button
                  className="paperSave"
                  disabled={!validStake(stake) || !ledgerLoaded}
                  onClick={savePaperTicket}
                >
                  <ClipboardList size={18} /> Save as paper ticket
                </button>
              </>
            )}
          </section>
          <section id="guide" className="guide">
            <div>
              <span className="eyebrow">MATCH IT ON YOUR PHONE</span>
              <h2>Every leg, in order</h2>
            </div>
            <ol>
              <li>
                <b>1</b>
                <span>
                  Open DraftKings Sportsbook and choose the sport shown.
                </span>
              </li>
              <li>
                <b>2</b>
                <span>
                  Open the matchup, then <strong>Game Lines</strong>.
                </span>
              </li>
              <li>
                <b>3</b>
                <span>
                  Choose the displayed bet type and selection; confirm the price
                  still matches.
                </span>
              </li>
            </ol>
          </section>
        </main>
      </div>
      <nav className="mobile">
        <button onClick={() => navigate('week')}>7 Days</button>
        <button onClick={() => navigate('predictions')}>Predictions</button>
        <button onClick={() => navigate('timed')}>Parlays</button>
        <button onClick={() => navigate('tracker')}>Results</button>
        <button onClick={() => navigate('research')}>Research</button>
        <a href="#slip">
          Slip <b>{chosen.length}</b>
        </a>
      </nav>
      {gameDetail && (
        <div className="modal gameModal">
          <div>
            <button
              className="modalX"
              onClick={() => setGameDetail(null)}
              aria-label="Close game details"
            >
              <X />
            </button>
            <span className="eyebrow">GAME INTELLIGENCE</span>
            <h2>
              {gameDetail.away} at {gameDetail.home}
            </h2>
            <p>
              {gameDetail.sport} ·{' '}
              {new Date(gameDetail.startsAt).toLocaleString([], { timeZone: USER_TIME_ZONE,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </p>
            <div className="gameFacts">
              <div>
                <MapPin size={18} />
                <span>
                  <small>HOME LOCATION</small>
                  <strong>{gameDetail.home}</strong>
                  <em>
                    Exact venue and coordinates are not supplied by this feed.
                  </em>
                </span>
              </div>
              <div>
                <Clock3 size={18} />
                <span>
                  <small>START TIME</small>
                  <strong>{new Date(gameDetail.startsAt).toISOString()}</strong>
                  <em>Displayed above in your local time zone.</em>
                </span>
              </div>
            </div>
            <div className="gameDataStatus">
              <span className={openedGameQuotes.length ? 'readyState' : ''}>
                {openedGameQuotes.length ? 'PROVIDER SNAPSHOT' : 'ODDS PENDING'}
              </span>
              <span>Player reports reviewed separately below</span>
              <span>Venue weather feed not connected</span>
            </div>
            <GamePlayers key={gameDetail.id} sport={gameDetail.sport} home={gameDetail.home} away={gameDetail.away} />
            {openedGameQuotes.length ? (
              <div className="gameOdds">
                <div className="gameOddsHead">
                  <span>Selection</span>
                  <span>DK</span>
                  <span>Implied</span>
                  <span>Model</span>
                  <span>10K sim</span>
                  <span>Action</span>
                </div>
                {openedGameQuotes.map((quote) => {
                  const summary = simulationSummary([quote]);
                  return (
                    <div className="gameOddsRow" key={quote.id}>
                      <div>
                        <strong>{quote.selection}</strong>
                        <small>{quote.betType}</small>
                      </div>
                      <b>{fmt(quote.price)}</b>
                      <span>{quote.impliedProbability.toFixed(2)}%</span>
                      <span>
                        {modelProbability(quote).toFixed(2)}%
                        <small>
                          {quote.consensusBooks
                            ? `${quote.consensusBooks} books`
                            : 'DK fallback'}
                        </small>
                      </span>
                      <span>{summary.rate.toFixed(2)}%</span>
                      <div className="gameOddsActions">
                        <button onClick={() => inspectQuote(quote)}>
                          <Eye size={15} /> Sim
                        </button>
                        <button onClick={() => toggle(quote)}>
                          <Check size={15} /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty compactEmpty">
                DraftKings has not posted a supported moneyline, spread or
                total. This game remains queued; EdgeLine will not manufacture
                odds.
              </div>
            )}
            <div className="detailPath">
              Source: The Odds API schedule · DraftKings displayed price ·
              matching FanDuel, BetMGM, BetOnline and BetRivers prices used for
              cross-book consensus when available · refreshed{' '}
              {data?.feed.fetchedAt
                ? new Date(data.feed.fetchedAt).toLocaleString('en-US', { timeZone: USER_TIME_ZONE })
                : 'pending'}
            </div>
            <button className="primary" onClick={() => setGameDetail(null)}>
              Close game
            </button>
          </div>
        </div>
      )}
      {detail && (
        <div className="modal detailModal">
          <div>
            <button
              className="modalX"
              onClick={() => setDetail(null)}
              aria-label="Close simulation details"
            >
              <X />
            </button>
            <span className="eyebrow">10,000-RUN ENGINE · 100-RUN AUDIT</span>
            <h2>{detail.title}</h2>
            <p>{detail.subtitle}</p>
            <div className="detailComparison">
              <div>
                <span>DraftKings odds</span>
                <strong>{fmt(detail.odds)}</strong>
              </div>
              <div>
                <span>DK implied</span>
                <strong>{detail.impliedProbability.toFixed(1)}%</strong>
              </div>
              <div>
                <span>10K simulated</span>
                <strong>{detail.simulatedProbability.toFixed(2)}%</strong>
              </div>
              <div>
                <span>Conservative</span>
                <strong>{detail.conservativeProbability.toFixed(2)}%</strong>
              </div>
              <div>
                <span>Conservative EV</span>
                <strong>{detail.expectedValue.toFixed(2)}%</strong>
              </div>
            </div>
            <div className="runKey">
              <span>
                <i className="win" /> Win
              </span>
              <span>
                <i /> Loss
              </span>
              <b>Each square is one run</b>
            </div>
            <div className="runGrid">
              {detail.outcomes.map((hit, i) => (
                <i
                  key={i}
                  className={hit ? 'win' : ''}
                  title={`Run ${i + 1}: ${hit ? 'win' : 'loss'}`}
                />
              ))}
            </div>
            <div className="detailInput">
              <span>Model input</span>
              <strong>
                {detail.modelProbability.toFixed(1)}% probability ·{' '}
                {detail.modelSource}
              </strong>
              <small>
                The engine uses {detail.runs.toLocaleString()} deterministic
                trials. The 100 squares above are the visual audit sample. This
                narrows simulation noise, not model uncertainty.
              </small>
            </div>
            <div className="detailPath">{detail.path}</div>
            <button className="primary" onClick={() => setDetail(null)}>
              Close details
            </button>
          </div>
        </div>
      )}
      {tour && (
        <div className="modal">
          <div>
            <button className="modalX" onClick={closeTour}>
              <X />
            </button>
            <span className="eyebrow">THE NEW MARKET DESK</span>
            <h2>Pick. Match. Confirm.</h2>
            <p>
              Ready tickets use 100 price-weighted trials. Add one to your slip,
              then follow the exact DraftKings path on your phone.
            </p>
            <div className="tourSteps">
              <span>
                <b>01</b>Review a card
              </span>
              <ArrowRight />
              <span>
                <b>02</b>Add the ticket
              </span>
              <ArrowRight />
              <span>
                <b>03</b>Confirm live
              </span>
            </div>
            <button className="primary" onClick={closeTour}>
              Enter market desk
            </button>
          </div>
        </div>
      )}
    </>
  );
}
