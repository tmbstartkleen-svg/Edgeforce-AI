export type USSelection = { eventSlug: string; marketSlug: string; outcomeId: string };
export type USReadinessEnvironment = Record<string, unknown>;
export type USReadinessOptions = { fetchImpl?: typeof fetch; now?: number };
export class PolymarketUSReadinessError extends Error { status: number; constructor(code: string, status?: number); }
export function connectionConfiguration(env?: USReadinessEnvironment): Record<string, unknown>;
export function searchUSMarkets(query: string, options?: USReadinessOptions): Promise<unknown>;
export function prepareUSCombo(selections: USSelection[], options?: USReadinessOptions): Promise<Record<string, unknown>>;
export function retailReadAuthHeaders(env: USReadinessEnvironment, path: string, now?: number): Promise<Record<string, string>>;
export function checkUSConnection(env: USReadinessEnvironment, options?: USReadinessOptions): Promise<Record<string, unknown>>;
export function polymarketUSReadinessGateway(request: Request, env?: USReadinessEnvironment, options?: USReadinessOptions): Promise<Response>;
