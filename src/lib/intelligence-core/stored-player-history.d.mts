export interface StoredPlayerHistoryRow {
 playerId: string;
 eventId: string;
 upstreamId: string;
 date: string | null;
 completed: boolean;
 stats: Record<string, number>;
 observedAt: string | null;
 sourceUrl: string | null;
}
export function normalizeStoredPlayerHistory(payload: unknown, playerId: string): {
 status: string;
 rows: StoredPlayerHistoryRow[];
 warnings: string[];
};
