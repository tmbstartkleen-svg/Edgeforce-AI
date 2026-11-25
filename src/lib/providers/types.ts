import type {Market,MarketRole as CoreMarketRole} from '../types';
import type {ProviderCapability} from '../providerRegistry';

export type MarketRole=CoreMarketRole;

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
 marketRole:MarketRole;
 consensusWeight:number;
};

export type ProviderFailureKind=
 'CONFIGURATION'|'DEADLINE'|'TIMEOUT'|'NETWORK'|'HTTP'|'AUTH'|'RATE_LIMITED'|'QUOTA_EXHAUSTED'|
 'REDIRECT_BLOCKED'|'INVALID_JSON'|'INVALID_PAYLOAD'|'BODY_READ_FAILED'|'BODY_TOO_LARGE'|
 'QUOTA_UNVERIFIED'|'CREDIT_RESERVE'|'CREDIT_PAUSED'|'NO_MARKETS'|'CACHE_STALE';

/** Redacted observation evidence. httpStatus exists only when an HTTP response was received. */
export type ProviderRequestDiagnostic={
 stage:'PREFLIGHT'|'BOOTSTRAP'|'FALLBACK'|'EXPANSION';
 endpoint:'SPORTS_CATALOG'|'UPCOMING_ODDS'|'SPORT_ODDS';
 attempted:boolean;responseReceived:boolean;startedAt:string;observedAt?:string;elapsedMs:number;
 httpStatus?:number;responseBytes:number;quota:{remaining?:number;used?:number;last?:number};
 failureKind?:ProviderFailureKind;failurePhase?:'REQUEST'|'RESPONSE_BODY'|'VALIDATION'|'BUDGET';
 bodyFailureKind?:ProviderFailureKind;providerErrorCode?:string;transportCode?:string;transportErrorName?:string;
};

export type ProviderDiagnostics={
 schemaVersion:1;requests:ProviderRequestDiagnostic[];failureKind?:ProviderFailureKind;
 cacheHit:boolean;cacheAgeMs:number;
 quotaEvidence:'CURRENT_RESPONSE'|'CACHED_RESPONSE'|'UNAVAILABLE';quotaObservedAt?:string;
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
 retryAfterMs?:number;
 diagnostics?:ProviderDiagnostics;
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
