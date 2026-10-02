import {getProductionProviderHealth} from '@/lib/productionHealth';
import {latestFeedIntegrity} from '@/lib/feedIntegrityStore';

export const dynamic='force-dynamic';

export async function GET(){
  const [providers,integrityHistory]=await Promise.all([
    getProductionProviderHealth(),
    latestFeedIntegrity(12).catch(()=>[])
  ]);
  return Response.json({
    ok:true,
    providers,
    integrityHistory,
    generatedAt:new Date().toISOString()
  },{headers:{'Cache-Control':'no-store'}});
}
