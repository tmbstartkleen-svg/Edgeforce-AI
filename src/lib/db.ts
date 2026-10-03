import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;
let clientInitError: string | undefined;

function databaseUrl(){
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;
}

export function db() {
  const url = databaseUrl();
  if (!url) return null;
  if (!client) {
    try {
      client = postgres(url, {
        max: 4,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      });
      clientInitError = undefined;
    } catch (error) {
      clientInitError = error instanceof Error ? error.message : 'database client initialization failed';
      return null;
    }
  }
  return client;
}

export async function dbHealth() {
  const configured = Boolean(databaseUrl());
  const sql = db();
  if (!sql) return { configured, ok: false, ...(clientInitError ? { error: clientInitError } : {}) };
  try {
    await sql`select 1 as ok`;
    return { configured: true, ok: true };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'db error',
    };
  }
}
