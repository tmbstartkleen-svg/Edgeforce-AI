import { polymarketUSSlipGateway } from '@/lib/intelligence-core/polymarket-us-slips.mjs';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return polymarketUSSlipGateway(request, process.env);
}
export async function POST(request: Request) {
  return polymarketUSSlipGateway(request, process.env);
}
