export interface AgentSpec { id:string; lane:string; activeMs:number; idleMs:number; cost:number; priority:number }
export interface AgentTask { agentId:string; lane:string; budgetUnits:number; scheduledAt:number }
export const AGENTS: readonly AgentSpec[];
export function planAgentRuns(options?:{
 now?:number; activeEvent?:boolean; availableBudget?:number; maxTasks?:number;
 lastRuns?:Record<string,number>; disabled?:string[]; cooldowns?:Record<string,number>;
 circuitOpen?:string[]; supported?:string[];
}):{tasks:AgentTask[]; remainingBudget:number; skipped:number};
export interface Observation {
 provider:string; upstreamId:string; eventId:string; marketId:string|null;
 kind:string; observedAt:number; ingestedAt:number; value:unknown; sourceClass:'EXTERNAL_OBSERVATION'
}
export function normalizeObservation(input:Record<string,unknown>,now?:number):Observation;
export function classifyFreshness(input:{observedAt:number;now?:number;maxAgeMs?:number}):'INVALID'|'STALE'|'FRESH';
export function sourceCoverage(observations?:Array<{upstreamId?:string}>):{independentUpstreams:number;crossProviderVerified:boolean};
