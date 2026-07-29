import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// "prefer" negotiates SSL when the server offers it (Supabase) and falls
// back to plaintext when it doesn't (local Docker Postgres), so the same
// client works against both without an extra env var.
export function createDb(url: string) {
  const client = postgres(url, { ssl: "prefer" });
  return drizzle(client);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db = createDb(process.env.DATABASE_URL);
