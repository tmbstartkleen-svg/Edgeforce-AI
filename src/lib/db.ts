import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;
  if (!url) return null;
  if (!client) {
    client = postgres(url, {
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return client;
}

export async function dbHealth() {
  try {
    const sql = db();
    if (!sql) return { configured: false, ok: false };
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
