import {sportModelCatalog} from '@/lib/sportModels';
import {expertModelCatalog,expertSuiteStatus} from '@/lib/expertModelSuite';

export async function GET(){
 return Response.json({
  version:'v56',
  models:sportModelCatalog(),
  expertModels:expertModelCatalog(),
  expertStatus:expertSuiteStatus()
 });
}
