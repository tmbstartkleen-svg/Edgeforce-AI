export type ClosureCertificateReport={
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 closed:boolean;
 blockers:string[];
 evidence:Record<string,unknown>;
 source:string;
 workflowRunId:string|null;
};

export type ClosureCertificateEntry={
 sequence:number;
 previousHash:string|null;
 certificate:{
  releaseVersion:string;
  modelVersion:string;
  migrationVersion:number;
  commitSha:string;
  workflowRunId:string|null;
  source:string;
  closed:boolean;
  blockers:string[];
  evidence:Record<string,unknown>;
  recordedAt:string;
 };
 hash:string;
};

const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

function normalize(value:unknown):unknown{
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object'){
  const out:Record<string,unknown>={};
  for(const key of Object.keys(value as Record<string,unknown>).sort()){
   const next=(value as Record<string,unknown>)[key];
   if(next!==undefined)out[key]=normalize(next);
  }
  return out;
 }
 if(typeof value==='number'&&!Number.isFinite(value))return null;
 return value;
}

export function stableClosureStringify(value:unknown){
 return JSON.stringify(normalize(value));
}

async function sha256Hex(value:string){
 const cryptoApi=globalThis.crypto;
 if(!cryptoApi?.subtle)throw new Error('Web Crypto SHA-256 is unavailable');
 const digest=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function cleanEvidence(value:unknown){
 const evidence={...obj(value)};
 delete evidence.certificateChain;
 delete evidence.certificateHead;
 delete evidence.certificateCount;
 delete evidence.certificateChainVerified;
 return evidence;
}

function certificateFor(report:ClosureCertificateReport,recordedAt:string){
 return {
  releaseVersion:String(report.releaseVersion||''),
  modelVersion:String(report.modelVersion||''),
  migrationVersion:Number(report.migrationVersion||0),
  commitSha:String(report.commitSha||''),
  workflowRunId:report.workflowRunId?String(report.workflowRunId):null,
  source:String(report.source||''),
  closed:Boolean(report.closed),
  blockers:Array.isArray(report.blockers)?report.blockers.map(String):[],
  evidence:cleanEvidence(report.evidence),
  recordedAt
 };
}

export async function verifyClosureCertificateChain(value:unknown){
 const chain=Array.isArray(value)?value as ClosureCertificateEntry[]:[];
 let previousHash:string|null=null;
 for(let index=0;index<chain.length;index++){
  const entry=chain[index];
  if(!entry||typeof entry!=='object'){
   return {valid:false,count:chain.length,verified:index,head:previousHash,error:'invalid certificate entry'};
  }
  if(Number(entry.sequence)!==index+1){
   return {valid:false,count:chain.length,verified:index,head:previousHash,error:'certificate sequence mismatch'};
  }
  if((entry.previousHash||null)!==previousHash){
   return {valid:false,count:chain.length,verified:index,head:previousHash,error:'certificate previous hash mismatch'};
  }
  const unsigned={sequence:entry.sequence,previousHash:entry.previousHash||null,certificate:entry.certificate};
  const expected=await sha256Hex(stableClosureStringify(unsigned));
  if(String(entry.hash||'')!==expected){
   return {valid:false,count:chain.length,verified:index,head:previousHash,error:'certificate hash mismatch'};
  }
  previousHash=expected;
 }
 return {valid:true,count:chain.length,verified:chain.length,head:previousHash,error:null};
}

export async function appendClosureCertificate(
 existingEvidence:unknown,
 report:ClosureCertificateReport,
 recordedAt=new Date().toISOString()
){
 const existing=obj(existingEvidence);
 const chain=Array.isArray(existing.certificateChain)?existing.certificateChain as ClosureCertificateEntry[]:[];
 const verification=await verifyClosureCertificateChain(chain);
 if(!verification.valid)throw new Error(`existing closure certificate chain is invalid: ${verification.error||'unknown error'}`);
 const certificate=certificateFor(report,recordedAt);
 const sequence=chain.length+1;
 const previousHash=verification.head;
 const unsigned={sequence,previousHash,certificate};
 const hash=await sha256Hex(stableClosureStringify(unsigned));
 const entry:ClosureCertificateEntry={...unsigned,hash};
 const next=[...chain,entry];
 return {
  entry,
  chain:next,
  count:next.length,
  head:hash,
  evidence:{
   ...cleanEvidence(report.evidence),
   certificateChain:next,
   certificateHead:hash,
   certificateCount:next.length,
   certificateChainVerified:true
  }
 };
}

export async function verifyClosureEvidenceChain(value:unknown){
 const evidence=obj(value);
 const chain=Array.isArray(evidence.certificateChain)?evidence.certificateChain:[];
 const verification=await verifyClosureCertificateChain(chain);
 const expectedCount=Math.max(0,Number(evidence.certificateCount||0));
 const expectedHead=String(evidence.certificateHead||'')||null;
 const metadataMatch=verification.valid
  &&verification.count>0
  &&expectedCount===verification.count
  &&expectedHead===verification.head;
 return {
  valid:metadataMatch,
  structuralValid:verification.valid,
  count:verification.count,
  expectedCount,
  head:verification.head,
  expectedHead,
  verified:verification.verified,
  error:metadataMatch?null:verification.error||'certificate chain metadata mismatch'
 };
}
