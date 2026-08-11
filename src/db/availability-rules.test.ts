import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { availabilityRules, resources } from "./schema";

const db = createDb(process.env.TEST_DATABASE_URL!);

async function insertResource() {
  const [row] = await db
    .insert(resources)
    .values({
      ownerId: randomUUID(),
      name: "Room A",
      slug: `room-${randomUUID()}`,
      timezone: "Europe/Madrid",
    })
    .returning();
  if (!row) throw new Error("insert did not return a row");
  return row.id;
}

function validRule(
  resourceId: string,
  overrides: Partial<typeof availabilityRules.$inferInsert> = {},
) {
  return {
    resourceId,
    weekday: 1,
    startsAt: "09:00",
    endsAt: "17:00",
    ...overrides,
  };
}

describe("availability_rules table constraints", () => {
  it("accepts a valid weekly rule", async () => {
    const resourceId = await insertResource();
    const [row] = await db
      .insert(availabilityRules)
      .values(validRule(resourceId))
      .returning();
    expect(row?.weekday).toBe(1);
    expect(row?.startsAt).toBe("09:00:00");
    expect(row?.endsAt).toBe("17:00:00");
    expect(row?.effectiveFrom).toBeNull();
    expect(row?.effectiveTo).toBeNull();
  });

  it("accepts optional effective_from/effective_to", async () => {
    const resourceId = await insertResource();
    const [row] = await db
      .insert(availabilityRules)
      .values(
        validRule(resourceId, {
          effectiveFrom: "2026-09-01",
          effectiveTo: "2026-12-31",
        }),
      )
      .returning();
    expect(row?.effectiveFrom).toBe("2026-09-01");
    expect(row?.effectiveTo).toBe("2026-12-31");
  });

  it("rejects weekday below 0", async () => {
    const resourceId = await insertResource();
    await expect(
      db.insert(availabilityRules).values(validRule(resourceId, { weekday: -1 })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects weekday above 6", async () => {
    const resourceId = await insertResource();
    await expect(
      db.insert(availabilityRules).values(validRule(resourceId, { weekday: 7 })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects endsAt at or before startsAt", async () => {
    const resourceId = await insertResource();
    await expect(
      db.insert(availabilityRules).values(
        validRule(resourceId, { startsAt: "17:00", endsAt: "09:00" }),
      ),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects a resource_id that doesn't exist", async () => {
    await expect(
      db.insert(availabilityRules).values(validRule(randomUUID())),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("cascades on resource deletion", async () => {
    const resourceId = await insertResource();
    await db.insert(availabilityRules).values(validRule(resourceId));

    await db.delete(resources).where(eq(resources.id, resourceId));

    const remaining = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.resourceId, resourceId));
    expect(remaining).toHaveLength(0);
  });
});
