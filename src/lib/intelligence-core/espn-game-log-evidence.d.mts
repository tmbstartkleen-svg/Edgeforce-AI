export interface EspnVerifiedGameLogRow {
 playerId: string;
 eventId: string;
 upstreamId: string;
 date: string;
 completed: true;
 stats: Record<string,number>;
 observedAt: string;
 sourceUrl: string;
}
export function normalizeEspnGameLogEvidence(input: {
 athleteId: string;
 payload: unknown;
 observedAt: string;
}): {
 rows: EspnVerifiedGameLogRow[];
 excluded: {eventId:string|null;reason:string}[];
 modelProbability: null;
 approvedForBetting: false;
};
