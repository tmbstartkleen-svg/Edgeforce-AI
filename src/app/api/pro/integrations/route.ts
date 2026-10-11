import {proIntegrations} from '@/lib/proIntegrations';
export const dynamic='force-dynamic';
export async function GET(){
 return Response.json({ok:true,connections:proIntegrations()},{
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 });
}
