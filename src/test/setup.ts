import { beforeEach } from "vitest";
import { createDb } from "../db/client";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set");
}

const db = createDb(process.env.TEST_DATABASE_URL);

// Generic on purpose: works with zero tables today and keeps working once
// Phase 1 adds real ones, with no changes needed here.
beforeEach(async () => {
  const tables = await db.$client<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((t) => `"${t.table_name}"`).join(", ");
  await db.$client.unsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
});
