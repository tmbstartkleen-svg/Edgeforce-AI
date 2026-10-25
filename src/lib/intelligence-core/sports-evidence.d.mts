export type SimulationEvidence={percent:number;low:number;high:number;runs:number;modelVersion:string;createdAt:string;status:string;calibrated:boolean};
export type SportsCoverageRow={id:string;label:string;family:string;observations:number;latest:string|null;status:string;sources:string[]};
export function monteCarloForQuote(quote:Record<string,unknown>,runs:Record<string,unknown>[],evidence:Record<string,unknown>[],now?:number):SimulationEvidence|null;
export function buildSportsCoverage(registry:{id:string;label:string;family:string}[],sourceRows:Record<string,unknown>[],now?:number):SportsCoverageRow[];
