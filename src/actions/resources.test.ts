import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createResource } from "./resources";
import { createDb } from "@/db/client";
import { slugify } from "@/lib/slugify";

const testDb = createDb(process.env.TEST_DATABASE_URL!);

describe("createResource", () => {
  it("creates a resource with an auto-generated slug", async () => {
    const result = await createResource(
      {
        ownerId: randomUUID(),
        name: `Rehearsal Room ${randomUUID()}`,
        timezone: "America/Los_Angeles",
      },
      testDb,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.resource.timezone).toBe("America/Los_Angeles");
    expect(result.resource.slug).toBe(slugify(result.resource.name));
  });

  it("rejects a timezone that isn't a recognized IANA zone", async () => {
    const result = await createResource(
      {
        ownerId: randomUUID(),
        name: `Room ${randomUUID()}`,
        timezone: "Mars/Phobos",
      },
      testDb,
    );
    expect(result).toMatchObject({
      success: false,
      error: "Not a recognized IANA timezone",
    });
  });

  it("rejects a missing name", async () => {
    const result = await createResource(
      { ownerId: randomUUID(), name: "", timezone: "America/Los_Angeles" },
      testDb,
    );
    expect(result).toMatchObject({ success: false });
  });

  it("returns a friendly message on a real slug collision", async () => {
    const name = `Duplicate Room ${randomUUID()}`;
    await createResource(
      { ownerId: randomUUID(), name, timezone: "America/Los_Angeles" },
      testDb,
    );

    const result = await createResource(
      { ownerId: randomUUID(), name, timezone: "Europe/Madrid" },
      testDb,
    );

    expect(result).toEqual({
      success: false,
      error: "A resource with that name already exists",
    });
  });
});
