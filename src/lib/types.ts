export type RiskProfile='Conservative'|'Moderate'|'Aggressive';
export type Market={id:string;sport:string;league:string;event:string;selection:string;market:string;startTime:string;home:string;away:string;odds:number;marketProb:number;modelProb:number;confidence:number;sourceAgeMin:number;period:'AM'|'PM'};
export type Ranked=Market & {fairOdds:number;edge:number;expectedValue:number;kelly:number;recommendedStake:number;agreement:number;grade:'ELITE'|'STRONG'|'WATCH'|'PASS'};
