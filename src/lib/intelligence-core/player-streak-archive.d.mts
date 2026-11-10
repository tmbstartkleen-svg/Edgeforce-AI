export type StoredPlayerGame = {
  eventId?: string; event_id?: string; athleteId?: string; athlete_id?: string;
  statDate?: string | Date; stat_date?: string | Date;
  eventStatus?: string | null; event_status?: string | null;
  source?: string | null; raw?: Record<string, unknown> | null;
  stats?: Record<string, unknown> | null;
};
export type NormalizedStoredGame = {
  eventId:string; playerId:string; date:string; completed:true;
  stats:Record<string,unknown>; source:string; sourceUrl:string;
  sourceLinkType:string; completionEvidence:string;
};
export function normalizeStoredPlayerGames(
  rows:StoredPlayerGame[],
  playerId:string
):{ games:NormalizedStoredGame[]; omitted:Array<{eventId:string|null;reasons:string[]}>; archivedRows:number; sourceAuthenticated:false };
