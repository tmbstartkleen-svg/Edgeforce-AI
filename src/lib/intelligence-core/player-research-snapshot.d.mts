export interface PlayerResearchSnapshot {
 status: string;
 reasons: string[];
 audit: { accepted: number; rejected: number };
 streak: {
  acceptedCount: number;
  rejectedCount: number;
  consecutive: number;
  last5: { hits:number; observed:number; hitRate:number|null };
  last10: { hits:number; observed:number; hitRate:number|null };
 };
}
export function buildPlayerResearchSnapshot(args: {
 playerId: string; sport: string; games: unknown[]; stat: string;
 threshold: number; asOf: string; providerId?: string;
 maxReportAgeMs?: number;
}): PlayerResearchSnapshot;
