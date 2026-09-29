import {ingestOdds} from '@/lib/providers/ingest';

export async function GET(){
 const result=await ingestOdds();
 return Response.json({
  mode:result.mode,
  source:result.source,
  providerId:result.providerId,
  providerName:result.providerName,
  attempts:result.attempts,
  warnings:result.warnings,
  error:result.error,
  markets:result.markets
 });
}
