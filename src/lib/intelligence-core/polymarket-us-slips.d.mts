export type USSelection = { eventSlug: string; marketSlug: string; outcomeId: string };
export type USSlipEnvironment = Record<string, unknown>;
export type USSlipOptions = { fetchImpl?: typeof fetch; now?: number };
export class PolymarketUSSlipError extends Error { status: number; constructor(code: string, status?: number); }
export function connectionConfiguration(env?: USSlipEnvironment): Record<string, unknown>;
export function searchUSMarkets(query: string, options?: USSlipOptions): Promise<unknown>;
export function prepareUSCombo(selections: USSelection[], options?: USSlipOptions): Promise<Record<string, unknown>>;
export function retailAuthHeaders(env: USSlipEnvironment, method: string, path: string, now?: number): Promise<Record<string, string>>;
export function checkUSConnection(env: USSlipEnvironment, options?: USSlipOptions): Promise<Record<string, unknown>>;
export function createUSCombo(selections: USSelection[], env: USSlipEnvironment, options?: USSlipOptions): Promise<Record<string, unknown>>;
export function polymarketUSSlipGateway(request: Request, env?: USSlipEnvironment, options?: USSlipOptions): Promise<Response>;
