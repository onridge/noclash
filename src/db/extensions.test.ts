import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("btree_gist extension", () => {
  it("is installed", async () => {
    const db = createDb(process.env.TEST_DATABASE_URL!);
    const result = await db.execute(
      sql`SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
    );
    expect(result.length).toBe(1);
    await db.$client.end();
  });
});
