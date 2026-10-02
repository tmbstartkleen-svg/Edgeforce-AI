import type {Market} from '../types';
import type {ProviderCapability} from '../providerRegistry';

export type ProviderConfig={
 id:string;
 name:string;
 capability:ProviderCapability;
 url:string;
 apiKey?:string;
 authHeader?:string;
 authScheme?:string;
 priority:number;
 timeoutMs:number;
 enabled:boolean;
 bookmaker?:string;
 maxAgeMin:number;
 failureThreshold:number;
 quarantineMin:number;
};

export type ProviderFetchResult<T>={
 ok:boolean;
 providerId:string;
 providerName:string;
 capability:ProviderCapability;
 latencyMs:number;
 receivedAt:string;
 status?:number;
 data?:T;
 error?:string;
};

export type NormalizedOddsResult={
 markets:Market[];
 rawCount:number;
 warnings:string[];
};

export type GenericEnvelope={
 data?:unknown;
 results?:unknown;
 markets?:unknown;
 events?:unknown;
 [key:string]:unknown;
};
