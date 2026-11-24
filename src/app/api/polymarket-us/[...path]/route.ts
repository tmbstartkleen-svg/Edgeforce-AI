import {polymarketUSReadinessGateway} from '@/lib/intelligence-core/polymarket-us-readiness.mjs';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 return polymarketUSReadinessGateway(request,process.env);
}
export async function POST(request:Request){
 return polymarketUSReadinessGateway(request,process.env);
}
