import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// "prefer" negotiates SSL when the server offers it (Supabase) and falls
// back to plaintext when it doesn't (local Docker Postgres), so the same
// client works against both without an extra env var.
const client = postgres(process.env.DATABASE_URL, { ssl: "prefer" });

export const db = drizzle(client);
