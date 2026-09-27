// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorOf, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("admin user management", () => {
  it("counts users on the server", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    await t.createUser();
    await t.createUser({ invited: false });
    await t.createUser({ status: "blocked" });
    const [{ s }] = await t.as<{ s: Record<string, number> }>(
      admin.id,
      "select admin_user_stats() as s",
    );
    expect(s).toMatchObject({ total: 4, admins: 1, pending: 1, blocked: 1 });
    expect(s.granted).toBe(3);
  });

  it("blocks and reactivates an account, cutting access immediately", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    await t.createMap(user.id);

    await t.as(admin.id, "select admin_set_user_status($1, 'blocked')", [user.id]);
    expect(await t.as(user.id, "select id from mind_maps")).toHaveLength(0);

    await t.as(admin.id, "select admin_set_user_status($1, 'active')", [user.id]);
    expect(await t.as(user.id, "select id from mind_maps")).toHaveLength(1);
  });

  it("never lets the panel lock itself out or be used by non-admins", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const otherAdmin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();

    expect(
      await errorOf(t.as(admin.id, "select admin_set_user_status($1, 'blocked')", [admin.id])),
    ).toBe("CANNOT_BLOCK_ADMIN");
    expect(
      await errorOf(t.as(admin.id, "select admin_set_user_status($1, 'blocked')", [otherAdmin.id])),
    ).toBe("CANNOT_BLOCK_ADMIN");
    expect(
      await errorOf(t.as(user.id, "select admin_set_user_status($1, 'blocked')", [admin.id])),
    ).toBe("ACCESS_DENIED");
    expect(await errorOf(t.as(user.id, "select admin_user_stats()"))).toBe("ACCESS_DENIED");
  });
});
