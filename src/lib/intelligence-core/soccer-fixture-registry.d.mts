export type SoccerCandidate={id:string;league:string;code:string};
export const soccerCandidates:readonly SoccerCandidate[];
export function soccerCandidate(id:string):SoccerCandidate&{scoreboardUrl:string;status:string;oddsLicensed:boolean;enabled:boolean};
export function reconcileFixtureCoverage(input?:{targetFixtures?:Array<{leagueId:string;eventId:string}>;observedFixtures?:Array<{leagueId:string;eventId:string}>}):{targetFixtureCount:number;observedFixtureCount:number;missingFixtureCount:number;missingFixtures:Array<{leagueId:string;eventId:string}>;complete:boolean;requiresCurrentLicensedDraftKingsInventory:boolean};
