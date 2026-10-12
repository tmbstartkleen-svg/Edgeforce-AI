export type D1SportsMarketQuote={sourceId:string;upstreamId:string;sourceEventId:string;sport:string;league:string;home:string;away:string;startTime:string;market:string;selection:string;bookmaker:string;odds:number;observedAt:number};
export type D1SportsDb={prepare(query:string):{bind(...args:unknown[]):{first():Promise<{upstream_id:string}|null>;run():Promise<{meta?:{changes?:number}}>}}};
export function appendSportsMarketSnapshot(db:D1SportsDb,quote:D1SportsMarketQuote,options?:{sourceApproved?:boolean;now?:number}):Promise<{written:number;payloadSha256:string;legacyNeonModified:false}>;
export function recentSportsMarketSnapshots(db:D1SportsDb,options?:{limit?:number}):Promise<unknown[]>;
