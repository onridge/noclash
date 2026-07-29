import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDb } from "../db/client";

export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL is not set");
  }

  const target = new URL(testUrl);
  const dbName = target.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error(`TEST_DATABASE_URL has no database name: ${testUrl}`);
  }

  // CREATE DATABASE can't run against the database being created, so connect
  // to the server's default maintenance database instead.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { ssl: "prefer", max: 1 });
  try {
    const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (existing.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const db = createDb(testUrl);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.$client.end();
}
