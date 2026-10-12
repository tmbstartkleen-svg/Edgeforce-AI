import {probePolymarketEvents} from './polymarket-source.mjs';
/**
 * Restricted one-shot collection runner. No automatic schedules or DB writes.
 * Re-uses the public Gamma adapter and enforces approved-source contracts.
 */
export async function runApprovedCatalogProbe({source,fetchImpl,now=Date.now(),signal}={}){
 if(!source||source.sourceId!=='polymarket-gamma'||
    source.upstreamId!=='polymarket'||source.enabled!==true||
    source.licenseApproved!==true||source.permissionScope!=='READ_PUBLIC_API')
  throw Error('SOURCE_NOT_APPROVED');
 if(!Number.isFinite(now))throw Error('INVALID_COLLECTION_TIME');
 const output=await probePolymarketEvents({fetchImpl,signal});
 if(output.count>5)throw Error('COLLECTION_LIMIT_EXCEEDED');
 return {status:'OBSERVED_NOT_PERSISTED',sourceId:source.sourceId,upstreamId:source.upstreamId,
  collectionTimestamp:new Date(now).toISOString(),items:output.items,
  division:'UNCLASSIFIED',storedInD1:false,scheduled:false,
  count:output.count,licensePolicy:'REQUIRES_OWNER_CONFIRMATION_FOR_PRODUCTION_REUSE'};
}
