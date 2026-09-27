import { describe, expect, it } from "vitest";
import { isMissingDatabaseObject } from "@/lib/feedback";

describe("isMissingDatabaseObject", () => {
  it("recognizes a migration that wasn't applied", () => {
    expect(
      isMissingDatabaseObject({ code: "PGRST202", message: "Could not find the function" }),
    ).toBe(true);
    expect(isMissingDatabaseObject({ code: "PGRST205", message: "Could not find the table" })).toBe(
      true,
    );
    expect(isMissingDatabaseObject({ code: "42883" })).toBe(true);
  });

  it("does not confuse other failures with a missing migration", () => {
    expect(isMissingDatabaseObject({ code: "42501", message: "ACCESS_DENIED" })).toBe(false);
    expect(isMissingDatabaseObject(new Error("Failed to fetch"))).toBe(false);
    expect(isMissingDatabaseObject(null)).toBe(false);
  });
});
