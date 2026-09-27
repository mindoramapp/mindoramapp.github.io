// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { Entitlements } from "@/features/subscriptions";
import { createTestDb, errorOf, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

const nodesJson = (count: number) =>
  JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      position: { x: 0, y: 0 },
      data: { label: "x" },
    })),
  );

describe("authorization", () => {
  it("never exposes one user's maps to another", async () => {
    const alice = await t.createUser();
    const bob = await t.createUser();
    const mapId = await t.createMap(alice.id);

    expect(await t.as(bob.id, "select id from mind_maps where id = $1", [mapId])).toHaveLength(0);
    expect(
      await t.as(bob.id, "update mind_maps set title = 'hack' where id = $1 returning id", [mapId]),
    ).toHaveLength(0);
    expect(
      await t.as(bob.id, "delete from mind_maps where id = $1 returning id", [mapId]),
    ).toHaveLength(0);
    const [row] = await t.admin<{ title: string }>("select title from mind_maps where id = $1", [
      mapId,
    ]);
    expect(row.title).toBe("Mapa");
  });

  it("ignores a forged owner_id", async () => {
    const alice = await t.createUser();
    const bob = await t.createUser();
    const message = await errorOf(
      t.as(
        bob.id,
        "insert into mind_maps (owner_id, owner_email, title, mode) values ($1, 'x', 'forjado', 'study')",
        [alice.id],
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("blocks accounts that were not invited or were blocked", async () => {
    const pending = await t.createUser({ invited: false });
    const blocked = await t.createUser({ status: "blocked" });
    const blockedMap = await t.admin<{ id: string }>(
      "insert into mind_maps (owner_id, owner_email, title, mode) values ($1, 'x', 'antigo', 'study') returning id",
      [blocked.id],
    );

    for (const user of [pending, blocked]) {
      const message = await errorOf(
        t.as(
          user.id,
          "insert into mind_maps (owner_id, owner_email, title, mode) values ($1, 'x', 'm', 'study')",
          [user.id],
        ),
      );
      expect(message).toMatch(/row-level security/);
    }
    expect(await t.as(blocked.id, "select id from mind_maps")).toHaveLength(0);
    expect(blockedMap).toHaveLength(1);
  });

  it("does not let users grant themselves a plan, access or admin role", async () => {
    const user = await t.createUser({ invited: false });

    const message = await errorOf(
      t.as(
        user.id,
        "insert into subscriptions (user_id, plan_id, status) values ($1, 'gold', 'active')",
        [user.id],
      ),
    );
    expect(message).toMatch(/row-level security/);
    expect(
      await t.as(
        user.id,
        "update user_profiles set role = 'superadmin', access_granted_at = now() returning 1",
      ),
    ).toHaveLength(0);
    expect(await t.as(user.id, "update plans set price_cents = 0 returning 1")).toHaveLength(0);
  });

  it("does not let users look up other people's plan or invite status", async () => {
    const alice = await t.createUser({ plan: "gold" });
    const bob = await t.createUser();

    expect(await errorOf(t.as(bob.id, "select effective_plan($1)", [alice.id]))).toMatch(
      /permission denied/,
    );
    expect(await errorOf(t.as(bob.id, "select plan_limit($1, 'max_maps')", [alice.id]))).toMatch(
      /permission denied/,
    );
    expect(await t.as(bob.id, "select has_app_access($1) as v", [alice.id])).toEqual([
      { v: false },
    ]);
    expect(await t.as(bob.id, "select has_app_access() as v")).toEqual([{ v: true }]);

    const admin = await t.createUser({ role: "superadmin" });
    expect(await t.as(admin.id, "select has_app_access($1) as v", [alice.id])).toEqual([
      { v: true },
    ]);
  });

  it("publishes plans to anonymous visitors", async () => {
    await t.db.exec("set role anon;");
    const plans = (await t.db.query<{ id: string }>("select id from plans order by sort_order"))
      .rows;
    await t.db.exec("reset role;");
    expect(plans.map((plan) => plan.id)).toEqual(["free", "bronze", "silver", "gold"]);
  });
});

describe("plan limits", () => {
  it("allows 3 active maps on FREE and blocks the 4th with a PLAN_LIMIT error", async () => {
    const user = await t.createUser();
    for (let i = 0; i < 3; i++) await t.createMap(user.id);
    expect(await errorOf(t.createMap(user.id))).toBe("PLAN_LIMIT:max_maps");
  });

  it("does not count maps in the trash, but checks the limit when restoring", async () => {
    const user = await t.createUser();
    const trashed = await t.createMap(user.id, 1, { deleted: true });
    for (let i = 0; i < 3; i++) await t.createMap(user.id);

    const message = await errorOf(
      t.as(user.id, "update mind_maps set deleted_at = null where id = $1", [trashed]),
    );
    expect(message).toBe("PLAN_LIMIT:max_maps");
  });

  it("keeps full-row upserts of existing maps working at the limit (current production client)", async () => {
    const user = await t.createUser();
    const ids = [
      await t.createMap(user.id),
      await t.createMap(user.id),
      await t.createMap(user.id),
    ];
    const rows = await t.as<{ version: number }>(
      user.id,
      `insert into mind_maps (id, owner_id, owner_email, title, mode, nodes, edges)
       values ($1, $2, 'x', 'Renomeado', 'brainstorm', '[]', '[]')
       on conflict (id) do update set title = excluded.title, nodes = excluded.nodes
       returning version`,
      [ids[0], user.id],
    );
    expect(rows[0].version).toBe(2);
  });

  it("limits nodes per map, but lets over-limit maps be edited after a downgrade", async () => {
    expect(await errorOf(t.createMap((await t.createUser()).id, 51))).toBe(
      "PLAN_LIMIT:max_nodes_per_map",
    );

    // Built on Gold, then the subscription expired (back to FREE, 50 nodes).
    const user = await t.createUser({ plan: "gold" });
    const mapId = await t.createMap(user.id, 80);
    await t.admin("update subscriptions set status = 'expired' where user_id = $1", [user.id]);

    await t.as(user.id, "update mind_maps set nodes = $2 where id = $1", [mapId, nodesJson(70)]);
    expect(
      await errorOf(
        t.as(user.id, "update mind_maps set nodes = $2 where id = $1", [mapId, nodesJson(71)]),
      ),
    ).toBe("PLAN_LIMIT:max_nodes_per_map");
  });

  it("limits folders", async () => {
    const user = await t.createUser();
    const insertFolder = () =>
      t.as(
        user.id,
        "insert into mind_folders (owner_id, owner_email, name) values ($1, 'x', 'Pasta')",
        [user.id],
      );
    await insertFolder();
    expect(await errorOf(insertFolder())).toBe("PLAN_LIMIT:max_folders");
  });

  it("applies the limits of the subscribed plan", async () => {
    const bronze = await t.createUser({ plan: "bronze" });
    for (let i = 0; i < 10; i++) await t.createMap(bronze.id);
    expect(await errorOf(t.createMap(bronze.id))).toBe("PLAN_LIMIT:max_maps");
    await t.createMap((await t.createUser({ plan: "bronze" })).id, 100);

    const gold = await t.createUser({ plan: "gold" });
    for (let i = 0; i < 12; i++) await t.createMap(gold.id);
    await t.createMap(gold.id, 600);

    const admin = await t.createUser({ role: "superadmin" });
    for (let i = 0; i < 5; i++) await t.createMap(admin.id);
  });

  it("refuses content edits to maps in the trash", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id, 1, { deleted: true });
    expect(
      await errorOf(
        t.as(user.id, "update mind_maps set nodes = $2 where id = $1", [mapId, nodesJson(2)]),
      ),
    ).toBe("MAP_IN_TRASH");
  });
});

describe("subscription status → effective plan", () => {
  const planOf = async (status: string, extra: string) => {
    const user = await t.createUser();
    await t.admin(
      `insert into subscriptions (user_id, plan_id, status, current_period_end, grace_until)
       values ($1, 'silver', $2, ${extra})`,
      [user.id, status],
    );
    const [row] = await t.admin<{ id: string }>("select (effective_plan($1)).id", [user.id]);
    return row.id;
  };

  it("keeps paid benefits while active, trialing, in grace or until a canceled period ends", async () => {
    expect(await planOf("active", "now() + interval '10 days', null")).toBe("silver");
    expect(await planOf("trialing", "now() + interval '10 days', null")).toBe("silver");
    expect(await planOf("past_due", "now() - interval '1 day', now() + interval '3 days'")).toBe(
      "silver",
    );
    expect(await planOf("canceled", "now() + interval '5 days', null")).toBe("silver");
  });

  it("falls back to FREE when grace or the paid period is over, or the subscription expired", async () => {
    expect(await planOf("past_due", "now() - interval '10 days', now() - interval '1 day'")).toBe(
      "free",
    );
    expect(await planOf("canceled", "now() - interval '1 day', null")).toBe("free");
    expect(await planOf("expired", "now() + interval '5 days', null")).toBe("free");
  });

  it("preserves every map after a downgrade and only blocks new ones", async () => {
    const user = await t.createUser({ plan: "silver" });
    for (let i = 0; i < 6; i++) await t.createMap(user.id);
    await t.admin("update subscriptions set status = 'expired' where user_id = $1", [user.id]);

    expect(await t.as(user.id, "select id from mind_maps")).toHaveLength(6);
    expect(await errorOf(t.createMap(user.id))).toBe("PLAN_LIMIT:max_maps");
  });
});

describe("save_map (versioned autosave)", () => {
  type SaveResult = { ok: boolean; version: number };
  const save = (userId: string, mapId: string, expected: number, title = "Novo título") =>
    t.as<SaveResult>(userId, "select ok, version from save_map($1, $2, $3, $4, '[]')", [
      mapId,
      expected,
      title,
      nodesJson(2),
    ]);

  it("saves when the caller has the latest version and bumps it", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    expect(await save(user.id, mapId, 1, "Primeiro")).toEqual([{ ok: true, version: 2 }]);
    expect(await save(user.id, mapId, 2, "Segundo")).toEqual([{ ok: true, version: 3 }]);
    // Saving identical content is a no-op: nothing to conflict with, version unchanged.
    expect(await save(user.id, mapId, 3, "Segundo")).toEqual([{ ok: true, version: 3 }]);
  });

  it("never lets a stale tab overwrite newer content", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    await save(user.id, mapId, 1, "Aba nova");

    expect(await save(user.id, mapId, 1, "Aba velha")).toEqual([{ ok: false, version: 2 }]);
    const [row] = await t.admin<{ title: string }>("select title from mind_maps where id = $1", [
      mapId,
    ]);
    expect(row.title).toBe("Aba nova");
  });

  it("treats another user's map as not found", async () => {
    const owner = await t.createUser();
    const intruder = await t.createUser();
    const mapId = await t.createMap(owner.id);
    expect(await errorOf(save(intruder.id, mapId, 1))).toBe("MAP_NOT_FOUND");
  });

  it("does not bump the version for viewport-only changes", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    const [row] = await t.as<{ version: number }>(
      user.id,
      `update mind_maps set viewport = '{"x":5,"y":5,"zoom":2}', last_opened_at = now()
       where id = $1 returning version`,
      [mapId],
    );
    expect(row.version).toBe(1);
  });
});

describe("get_my_entitlements", () => {
  it("returns plan, limits and usage for the signed-in user", async () => {
    const user = await t.createUser({ plan: "silver" });
    await t.createMap(user.id);
    await t.createMap(user.id, 1, { deleted: true });

    const [row] = await t.as<{ e: Entitlements }>(user.id, "select get_my_entitlements() as e");
    expect(row.e.plan).toMatchObject({ id: "silver", name: "Prata", price_cents: 1000 });
    expect(row.e.limits.max_maps).toBe(50);
    expect(row.e.subscription?.status).toBe("active");
    expect(row.e.usage).toEqual({ maps: 1, folders: 0 });
  });
});
