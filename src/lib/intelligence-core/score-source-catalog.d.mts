export type ScoreSource={sport:string;label:string;endpoint:string;sourceId:string;upstreamId:string;classification:'SCORES_NOT_ODDS'};
export function scoreboardSource(sport:string):ScoreSource;
export const scoreSports:ReadonlyArray<{id:string;label:string;path:string}>;
