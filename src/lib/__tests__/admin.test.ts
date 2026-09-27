import { describe, expect, it } from "vitest";
import { sanitizeSearch } from "@/lib/admin";

describe("sanitizeSearch", () => {
  it("keeps names and e-mails searchable", () => {
    expect(sanitizeSearch("  maria.souza@ufba.br ")).toBe("maria.souza@ufba.br");
    expect(sanitizeSearch("João da Silva")).toBe("João da Silva");
  });

  it("strips characters that would change a PostgREST filter", () => {
    expect(sanitizeSearch("a,role.eq.superadmin)")).toBe("a role.eq.superadmin");
    expect(sanitizeSearch('%" or (1=1) *')).toBe("or 1=1");
    expect(sanitizeSearch("x".repeat(200))).toHaveLength(80);
  });
});
