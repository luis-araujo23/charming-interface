import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured on the server environment.");
  }

  return databaseUrl;
}

export function getDbPool() {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return globalThis.__pgPool;
}
