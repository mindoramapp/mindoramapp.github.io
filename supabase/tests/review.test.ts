// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorOf, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

const upsertCard = (userId: string, mapId: string, nodeId = "root", intervalDays = 1) =>
  t.as(
    userId,
    `insert into review_cards (user_id, map_id, node_id, interval_days, reps, due_at, last_grade)
     values ($1, $2, $3, $4, 1, now() + interval '1 day', 'good')
     on conflict (user_id, map_id, node_id) do update
       set interval_days = excluded.interval_days, reps = review_cards.reps + 1
     returning reps`,
    [userId, mapId, nodeId, intervalDays],
  );

describe("review_cards", () => {
  it("lets the owner save and update review progress for their map", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);

    await upsertCard(user.id, mapId);
    const [row] = await upsertCard(user.id, mapId, "root", 3);
    expect(row).toEqual({ reps: 2 });
  });

  it("never exposes or accepts progress on someone else's map", async () => {
    const owner = await t.createUser();
    const intruder = await t.createUser();
    const mapId = await t.createMap(owner.id);
    await upsertCard(owner.id, mapId);

    expect(
      await t.as(intruder.id, "select * from review_cards where map_id = $1", [mapId]),
    ).toHaveLength(0);
    expect(await errorOf(upsertCard(intruder.id, mapId))).toMatch(/row-level security/);
  });

  it("does not accept a forged user_id", async () => {
    const alice = await t.createUser();
    const bob = await t.createUser();
    const mapId = await t.createMap(alice.id);
    const message = await errorOf(
      t.as(bob.id, "insert into review_cards (user_id, map_id, node_id) values ($1, $2, 'root')", [
        alice.id,
        mapId,
      ]),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("requires invited access", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    await t.admin("update user_profiles set status = 'blocked' where user_id = $1", [user.id]);
    expect(await errorOf(upsertCard(user.id, mapId))).toMatch(/row-level security/);
  });

  it("rejects out-of-range scheduling values", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    const message = await errorOf(
      t.as(
        user.id,
        "insert into review_cards (user_id, map_id, node_id, ease) values ($1, $2, 'root', 9)",
        [user.id, mapId],
      ),
    );
    expect(message).toMatch(/check constraint/);
  });

  it("removes progress together with the map and keeps the map version untouched", async () => {
    const user = await t.createUser();
    const mapId = await t.createMap(user.id);
    await upsertCard(user.id, mapId);

    const [{ version }] = await t.admin<{ version: number }>(
      "select version from mind_maps where id = $1",
      [mapId],
    );
    expect(version).toBe(1);

    await t.as(user.id, "delete from mind_maps where id = $1", [mapId]);
    expect(await t.admin("select * from review_cards where map_id = $1", [mapId])).toHaveLength(0);
  });
});

describe("review limit per plan", () => {
  const canReview = async (userId: string, mapId: string) =>
    (await t.as<{ ok: boolean }>(userId, "select can_review_map($1) as ok", [mapId]))[0].ok;

  it("lets Free review one map and blocks a second one", async () => {
    const user = await t.createUser();
    const first = await t.createMap(user.id);
    const second = await t.createMap(user.id);

    expect(await canReview(user.id, second)).toBe(true); // nothing reviewed yet
    await upsertCard(user.id, first);
    await upsertCard(user.id, first, "other"); // more cards on the same map are fine
    expect(await canReview(user.id, first)).toBe(true);
    expect(await canReview(user.id, second)).toBe(false);
    expect(await errorOf(upsertCard(user.id, second))).toMatch(/row-level security/);
  });

  it("reviews every map on a paid plan", async () => {
    const user = await t.createUser({ plan: "plus" });
    for (let i = 0; i < 3; i++) await upsertCard(user.id, await t.createMap(user.id));
    expect(await t.as(user.id, "select distinct map_id from review_cards")).toHaveLength(3);
  });

  it("keeps maps already under review after a downgrade, without progress loss", async () => {
    const user = await t.createUser({ plan: "plus" });
    const maps = [await t.createMap(user.id), await t.createMap(user.id)];
    for (const mapId of maps) await upsertCard(user.id, mapId);
    await t.admin("update subscriptions set status = 'expired' where user_id = $1", [user.id]);

    for (const mapId of maps) {
      expect(await canReview(user.id, mapId)).toBe(true);
      await upsertCard(user.id, mapId, "root", 5);
    }
    expect(await canReview(user.id, await t.createMap(user.id))).toBe(false);
  });
});
