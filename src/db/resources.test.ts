import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { resources } from "./schema";

const db = createDb(process.env.TEST_DATABASE_URL!);

function validResource(overrides: Partial<typeof resources.$inferInsert> = {}) {
  return {
    ownerId: randomUUID(),
    name: "Room A",
    slug: `room-${randomUUID()}`,
    timezone: "Europe/Madrid",
    ...overrides,
  };
}

describe("resources table constraints", () => {
  it("accepts a valid row", async () => {
    const [row] = await db.insert(resources).values(validResource()).returning();
    expect(row?.slotMinutes).toBe(60);
    expect(row?.bufferMinutes).toBe(0);
    expect(row?.maxAdvanceDays).toBe(60);
  });

  it("rejects a duplicate slug", async () => {
    const slug = `room-${randomUUID()}`;
    await db.insert(resources).values(validResource({ slug }));
    await expect(
      db.insert(resources).values(validResource({ slug })),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("rejects slot_minutes below 5", async () => {
    await expect(
      db.insert(resources).values(validResource({ slotMinutes: 4 })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects slot_minutes above 480", async () => {
    await expect(
      db.insert(resources).values(validResource({ slotMinutes: 481 })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects negative buffer_minutes", async () => {
    await expect(
      db.insert(resources).values(validResource({ bufferMinutes: -1 })),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
