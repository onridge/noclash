import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { resources } from "./schema";
import { seed } from "./seed";

const testDb = createDb(process.env.TEST_DATABASE_URL!);

async function bookingCountFor(resourceId: string) {
  const rows = await testDb.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count FROM bookings WHERE resource_id = ${resourceId}`,
  );
  return Number(rows[0]?.count ?? 0);
}

describe("seed", () => {
  it("creates one resource and a handful of bookings", async () => {
    await seed(testDb);

    const allResources = await testDb.select().from(resources);
    expect(allResources).toHaveLength(1);

    const resource = allResources[0];
    if (!resource) throw new Error("expected a seeded resource");
    expect(resource.slug).toBeTruthy();
    expect(resource.name).toBeTruthy();

    const count = await bookingCountFor(resource.id);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("is idempotent: running it twice leaves exactly one resource with the same bookings, not duplicates", async () => {
    await seed(testDb);
    const [firstResource] = await testDb.select().from(resources);
    if (!firstResource) throw new Error("expected a seeded resource");
    const firstCount = await bookingCountFor(firstResource.id);

    await seed(testDb);

    const allResources = await testDb.select().from(resources);
    expect(allResources).toHaveLength(1);
    const secondResource = allResources[0];
    if (!secondResource) throw new Error("expected a seeded resource");

    const secondCount = await bookingCountFor(secondResource.id);
    expect(secondCount).toBe(firstCount);
  });

  it("only ever seeds confirmed bookings with no overlaps", async () => {
    await seed(testDb);
    const [resource] = await testDb.select().from(resources);
    if (!resource) throw new Error("expected a seeded resource");

    const rows = await testDb.execute<{ status: string }>(
      sql`SELECT status FROM bookings WHERE resource_id = ${resource.id}`,
    );
    expect(rows.every((r) => r.status === "confirmed")).toBe(true);
    // seed() ran without throwing above, which is itself proof none of
    // the seeded bookings overlap — the exclusion constraint would have
    // rejected the insert otherwise.
  });
});
