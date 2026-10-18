// Pure ingestion evidence gate. Only classifies observations, never approves wagering.
export type IngestEvidence={kind:string;observedAt:number;collectedAt:number;sourceId:string;upstreamId:string;eventId:string;payloadBytes:number};
export function assessIngestEvidence(item:IngestEvidence,now=Date.now()){
 const reasons:string[]=[];
 if(!['score','odds','injury','lineup','player-stat','weather','prediction-market','result'].includes(item.kind))reasons.push('UNKNOWN_KIND');
 if(!item.sourceId?.trim()||!item.upstreamId?.trim()||!item.eventId?.trim())reasons.push('MISSING_IDENTITY');
 if(!Number.isFinite(item.observedAt)||!Number.isFinite(item.collectedAt)||item.observedAt<=0||item.collectedAt<=0)reasons.push('INVALID_TIMESTAMP');
 if(item.observedAt>now+60000||item.collectedAt>now+60000)reasons.push('FUTURE_TIMESTAMP');
 if(item.observedAt>item.collectedAt+60000)reasons.push('SOURCE_AFTER_COLLECTION');
 const maxAge=item.kind==='odds'?120000:item.kind==='score'?300000:86400000;
 if(now-item.observedAt>maxAge)reasons.push('STALE_OBSERVATION');
 if(now-item.collectedAt>300000)reasons.push('STALE_COLLECTION');
 if(!Number.isSafeInteger(item.payloadBytes)||item.payloadBytes<1||item.payloadBytes>32768)reasons.push('INVALID_PAYLOAD_SIZE');
 return {acceptedForPilot:reasons.length===0,reasons,sourceIndependentlyVerified:false,approvedForBetting:false,productionCutoverAuthorized:false};
}
