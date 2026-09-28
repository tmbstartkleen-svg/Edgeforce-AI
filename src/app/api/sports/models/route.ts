import {sportModelCatalog} from '@/lib/sportModels';
export async function GET(){return Response.json({version:'v8',models:sportModelCatalog()})}
