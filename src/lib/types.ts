import type {ContextQuality} from './contextQuality';
export type RiskProfile='Conservative'|'Moderate'|'Aggressive';
export type MarketRole='SHARP'|'PUBLIC'|'REFERENCE'|'NEUTRAL';

export type MarketConsensus={
 providerCount:number;
 bookCount:number;
 targetBook:string;
 targetBookFound:boolean;
 consensusProbability:number;
 consensusFairOdds:number;
 dispersion:number;
 agreement:number;
 minProbability:number;
 maxProbability:number;
 bestOdds:number;
 bestBook?:string;
 sharpProbability?:number;
 publicProbability?:number;
 sharpPublicGap?:number;
 marketStructure:'SHARP_OVER_PUBLIC'|'PUBLIC_OVER_SHARP'|'ALIGNED'|'MIXED'|'UNCLASSIFIED';
 outlierBooks:string[];
 books:string[];
};

export type PlayerContext={
 name:string;
 team?:string;
 status?:string;
 starter?:boolean;
 availability?:number;
 projection?:number;
 stdDev?:number;
 minutes?:number;
 usage?:number;
 statKey?:string;
};

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
 rawImpliedProb?:number;
 sourceBook?:string;
 sourceProviderId?:string;
 marketRole?:MarketRole;
 sourceProviderWeight?:number;
 consensus?:MarketConsensus;
 marketProb:number;
 modelProb:number;
 confidence:number;
 sourceAgeMin:number;
 period:'AM'|'PM';
 sportFeatures?:Record<string,number>;
 contextSources?:string[];
 playerContext?:PlayerContext;
 contextQuality?:ContextQuality;
};

export type ModelVoteSnapshot={
 name:string;
 prob:number;
 baseWeight:number;
 learnedMultiplier:number;
 weight:number;
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
 modelVotes?:ModelVoteSnapshot[];
 grade:'ELITE'|'STRONG'|'WATCH'|'PASS';
};
