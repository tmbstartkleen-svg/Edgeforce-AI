export type RiskProfile='Conservative'|'Moderate'|'Aggressive';

export type Market={
 id:string;
 sport:string;
 league:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 home:string;
 away:string;
 odds:number;
 marketProb:number;
 modelProb:number;
 confidence:number;
 sourceAgeMin:number;
 period:'AM'|'PM';
 sportFeatures?:Record<string,number>;
};

export type Ranked=Market & {
 fairOdds:number;
 edge:number;
 expectedValue:number;
 kelly:number;
 recommendedStake:number;
 agreement:number;
 sportModelProbability:number;
 sportAdjustment:number;
 sportFactors:string[];
 grade:'ELITE'|'STRONG'|'WATCH'|'PASS';
};
