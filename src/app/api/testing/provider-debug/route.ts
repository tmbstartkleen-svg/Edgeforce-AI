import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
  const providers=configuredProviders('ODDS');

  return Response.json({
    count:providers.length,
    providers:providers.map(p=>({
      id:p.id,
      name:p.name,
      url:p.url,
      enabled:p.enabled,
      bookmaker:p.bookmaker,
      priority:p.priority
    }))
  });
}
