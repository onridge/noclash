import { describe, expect, it } from "vitest";
import { mapPostgresError } from "./errors";

describe("mapPostgresError", () => {
  it("maps 23P01 to a user-facing message", () => {
    expect(mapPostgresError({ code: "23P01" })).toBe(
      "That slot was just taken.",
    );
  });

  it("unwraps a Drizzle-style wrapped error (cause.code)", () => {
    expect(mapPostgresError({ cause: { code: "23P01" } })).toBe(
      "That slot was just taken.",
    );
  });

  it("unwraps nested causes", () => {
    expect(
      mapPostgresError({ cause: { cause: { code: "23P01" } } }),
    ).toBe("That slot was just taken.");
  });

  it("maps 40P01 (deadlock, the other real outcome of a booking race)", () => {
    expect(mapPostgresError({ code: "40P01" })).toBe(
      "Something went wrong booking that slot — please try again.",
    );
  });

  it("returns null for an unrecognized Postgres error code", () => {
    expect(mapPostgresError({ code: "23505" })).toBeNull();
  });

  it("returns null for a plain Error with no code", () => {
    expect(mapPostgresError(new Error("boom"))).toBeNull();
  });

  it("returns null for non-object values", () => {
    expect(mapPostgresError("not an error")).toBeNull();
    expect(mapPostgresError(null)).toBeNull();
    expect(mapPostgresError(undefined)).toBeNull();
  });
});
