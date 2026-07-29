import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("test database harness", () => {
  it("connects to the migrated test database", async () => {
    const db = createDb(process.env.TEST_DATABASE_URL!);
    const result = await db.execute(sql`SELECT 1 as one`);
    expect(result[0]).toEqual({ one: 1 });
    await db.$client.end();
  });
});
