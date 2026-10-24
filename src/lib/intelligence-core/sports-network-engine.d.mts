export type NetworkSource={sourceId:string;upstreamId:string;enabled:boolean;licenseApproved:boolean;sports:string[];lanes:string[];creditCost?:number};
export type QuoteObservation={providerId:string;upstreamId:string;bookmaker:string;eventId:string;marketKey:string;selectionKey:string;odds:number;observedAt:number};
export type EdgeCandidate={americanOdds:number;modelProbability:number;modelCalibrated?:boolean;sourceAudited?:boolean;independentUpstreams?:number;targetBookObserved?:boolean};
export declare const NETWORK_LANES:readonly {kind:string;cost:number;priority:number;maxAgeMs:number}[];
export declare function planSportsNetwork(options?:{sources?:NetworkSource[];sports?:string[];lanes?:string[];budgetCredits?:number;maxJobs?:number;now?:number;lastCollected?:Record<string,number>;disabledSports?:string[]}):any;
export declare function auditMarketObservations(observations:QuoteObservation[],options?:{now?:number;maxAgeMs?:number;targetBook?:string}):any;
export declare function evaluateVerifiedEdge(options?:EdgeCandidate):any;
