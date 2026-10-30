export const FRESH_PRICE_MS = 5 * 60 * 1000;

export function quoteIdentity(
  eventId: string,
  marketKey: string,
  selection: string,
) {
  return `${eventId}:${marketKey}:${encodeURIComponent(selection)}`;
}

export function isFreshPrice(updatedAt: string, now = Date.now()) {
  const age = now - Date.parse(updatedAt);
  return Number.isFinite(age) && age >= -60000 && age <= FRESH_PRICE_MS;
}

type SavedLeg = {
  eventId: string;
  selection: string;
  betType: string;
  price: number;
};
type CurrentLine = SavedLeg & { updatedAt: string; stale: boolean };

export function decimalPrice(american: number) {
  return american < 0 ? 1 + 100 / -american : 1 + american / 100;
}

// A missing or changed handicap must never masquerade as zero movement.
export function capturedPriceAdvantage(
  legs: SavedLeg[],
  quotes: CurrentLine[],
  now = Date.now(),
) {
  if (!legs.length) return null;
  let captured = 1;
  let current = 1;
  for (const leg of legs) {
    const quote = quotes.find(
      (item) =>
        item.eventId === leg.eventId &&
        item.selection === leg.selection &&
        item.betType === leg.betType &&
        !item.stale &&
        isFreshPrice(item.updatedAt, now),
    );
    if (!quote) return null;
    captured *= decimalPrice(leg.price);
    current *= decimalPrice(quote.price);
  }
  return (captured / current - 1) * 100;
}

export function validStake(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 1000000;
}
