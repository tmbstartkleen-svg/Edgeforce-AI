export declare function decimalOdds(american:number):number;
export declare function impliedProbability(american:number):number;
export declare function validatedQuote(quote:Record<string,any>,options?:{now?:number;maxAgeMs?:number}):{ok:boolean;reason?:string;quote?:Record<string,any>};
export declare function scanArbitrage(quotes:Record<string,any>[],options?:{now?:number;maxAgeMs?:number;maxMarkets?:number;bankroll?:number}):any;
export declare function screenValueEdges(quotes:Record<string,any>[],forecasts:Record<string,any>[],options?:{now?:number;targetBook?:string;maxAgeMs?:number}):any;
