export type PolymarketCatalogEvent={
 source:string;upstreamId:string;eventId:string;title:string;
 active:boolean;closed:boolean;marketCount:number|null;
 division:'UNCLASSIFIED';livePriceVerified:false;archived:false;
};
export type PolymarketCatalogResult={
 source:string;sourceKind:'PUBLIC_EVENT_CATALOG';division:'UNCLASSIFIED';
 observedVia:'LIVE_HTTP_FETCH';count:number;items:PolymarketCatalogEvent[];
 storedInD1:false;validatedLicenseForReuse:false;
};
export function probePolymarketEvents(options?:{
 fetchImpl?:typeof fetch;signal?:AbortSignal;
}):Promise<PolymarketCatalogResult>;
