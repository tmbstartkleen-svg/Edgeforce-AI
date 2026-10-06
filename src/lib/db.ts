import postgres from 'postgres';
import {AsyncLocalStorage} from 'node:async_hooks';

type SqlClient = ReturnType<typeof postgres>;
type DatabaseScope = {
  url: string | undefined;
  client: SqlClient | null;
  initError?: string;
  closed: boolean;
};
export type DatabaseExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

// Only Node/Vercel may keep a socket pool across requests. Workers reuse isolates,
// but their sockets belong to the request that created them.
let client: SqlClient | null = null;
let clientInitError: string | undefined;
const databaseScopes = new AsyncLocalStorage<DatabaseScope>();

function databaseUrl(env: Record<string, unknown> = process.env) {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'NEON_DATABASE_URL']) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

/** Isolate a Worker invocation, including response streaming and waitUntil work. */
export function withDatabaseScope<T>(
  work: (context: DatabaseExecutionContext) => T | Promise<T>,
  env: Record<string, unknown>,
  context: DatabaseExecutionContext,
): Promise<T> {
  const scope: DatabaseScope = {url: databaseUrl(env), client: null, closed: false};
  return databaseScopes.run(scope, async () => {
    const pending: Promise<unknown>[] = [];
    const scopedContext = new Proxy(context, {
      get(target, key) {
        if (key === 'waitUntil') return (promise: Promise<unknown>) => {
          const task = Promise.resolve(promise);
          pending.push(task);
          target.waitUntil(task);
        };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    try {
      const result = await work(scopedContext);
      // A streamed response may still be reading the database after fetch returns.
      // Pipe without buffering and close the pool only when the body and background
      // tasks settle. Cancellation propagates to the original response body.
      if (result instanceof Response && result.body && result.status !== 101) {
        const stream = new TransformStream<Uint8Array, Uint8Array>();
        pending.push(result.body.pipeTo(stream.writable));
        return new Response(stream.readable, result) as T;
      }
      return result;
    } finally {
      context.waitUntil((async () => {
        // Tasks can register further work while they are running.
        for (let index = 0; index < pending.length;) {
          const batch = pending.slice(index);
          index = pending.length;
          await Promise.allSettled(batch);
        }
        scope.closed = true;
        const localClient = scope.client;
        scope.client = null;
        if (localClient) await localClient.end({timeout: 5});
      })());
    }
  });
}

export function db() {
  const scope = databaseScopes.getStore();
  if (scope?.closed) throw new Error('Database request scope is already closed');
  if (!scope && process.env.DEPLOYMENT_PLATFORM === 'cloudflare') {
    throw new Error('Cloudflare database access requires a request scope');
  }
  const url = scope ? scope.url : databaseUrl();
  if (!url) return null;
  const existing = scope ? scope.client : client;
  if (existing) return existing;
  try {
    const created = postgres(url, {
      max: scope ? 2 : 4,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    if (scope) {
      scope.client = created;
      scope.initError = undefined;
    } else {
      client = created;
      clientInitError = undefined;
    }
    return created;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database client initialization failed';
    if (scope) scope.initError = message;
    else clientInitError = message;
    return null;
  }
}

export async function dbHealth() {
  const scope = databaseScopes.getStore();
  const configured = Boolean(scope ? scope.url : databaseUrl());
  try {
    const sql = db();
    const error = scope ? scope.initError : clientInitError;
    if (!sql) return {configured, ok: false, ...(error ? {error} : {})};
    await sql`select 1 as ok`;
    return {configured: true, ok: true};
  } catch (error) {
    return {configured, ok: false, error: error instanceof Error ? error.message : 'db error'};
  }
}
