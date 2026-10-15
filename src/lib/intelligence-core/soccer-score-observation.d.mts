export type SoccerScoreObservation={leagueId:string;eventId:string;scheduledAt:string;observedAt:string;upstreamId:string;sourceApproved:false;licensedOdds:false;providerId:string;status:string};
export function extractSoccerScoreObservations(data:unknown,options?:{leagueId?:string;observedAt?:string;upstreamId?:string}):SoccerScoreObservation[];
