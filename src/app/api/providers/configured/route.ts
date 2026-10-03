import {configuredProviders} from '@/lib/providers/config';
import {providerHealth} from '@/lib/providerRegistry';

export async function GET(){
 const providers=configuredProviders().map(p=>({
  id:p.id,
  name:p.name,
  capability:p.capability,
  priority:p.priority,
  timeoutMs:p.timeoutMs,
  enabled:p.enabled,
  bookmaker:p.bookmaker,
  marketRole:p.marketRole,
  consensusWeight:p.consensusWeight,
  urlConfigured:Boolean(p.url),
  keyConfigured:Boolean(p.apiKey),
  health:providerHealth({...p,capabilities:[p.capability]})
 }));
 return Response.json({count:providers.length,providers});
}
