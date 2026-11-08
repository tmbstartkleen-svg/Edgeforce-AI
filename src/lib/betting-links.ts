/**
 * Betting link safety boundary.
 * A market page is NOT a preloaded slip. Never infer a sportsbook selection
 * token from a team name, generic outcome ID, or market slug.
 */
export type BettingVenue = 'DRAFTKINGS' | 'POLYMARKET_US';
export type LinkKind = 'PRELOADED_SELECTION' | 'MARKET_ONLY';
export type BettingLink = {
  venue: BettingVenue;
  url: string;
  kind: LinkKind;
  eventId: string;
  outcomeId?: string;
  verifiedAt?: string;
  verificationMethod?: 'USER_CONFIRMED' | 'PROVIDER_VERIFIED';
};
const allowedHosts: Record<BettingVenue, string[]> = {
  DRAFTKINGS: ['sportsbook.draftkings.com'],
  POLYMARKET_US: ['polymarket.us', 'www.polymarket.us']
};
export function validateBettingLink(link: BettingLink, now = Date.now()): BettingLink {
  const parsed = new URL(link.url);
  if (parsed.protocol !== 'https:' || !allowedHosts[link.venue].includes(parsed.hostname))
    throw new Error('UNTRUSTED_BETTING_LINK');
  if (!link.eventId.trim()) throw new Error('MISSING_EVENT_ID');
  if (link.kind === 'PRELOADED_SELECTION') {
    if (!link.outcomeId?.trim()) throw new Error('MISSING_SELECTION_ID');
    if (!link.verifiedAt || !link.verificationMethod) throw new Error('UNVERIFIED_PRELOAD');
    const age = now - Date.parse(link.verifiedAt);
    if (!Number.isFinite(age) || age < 0 || age > 5 * 60_000)
      throw new Error('STALE_PRELOAD_VERIFICATION');
  }
  return link;
}
export function classifyBettingLink(link: BettingLink, now = Date.now()) {
  try {
    return validateBettingLink(link, now);
  } catch {
    return { ...link, kind: 'MARKET_ONLY' as const, outcomeId: undefined,
      verifiedAt: undefined, verificationMethod: undefined };
  }
}
