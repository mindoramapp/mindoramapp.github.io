// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorOf, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

interface Request {
  id: string;
  code: string;
  plan_id: string;
  amount_cents: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
}

const request = async (userId: string, planId: string) =>
  (await t.as<Request>(userId, "select * from create_pix_request($1)", [planId]))[0];
const confirm = async (adminId: string, requestId: string) =>
  (await t.as<Request>(adminId, "select * from admin_confirm_pix($1, 'ok')", [requestId]))[0];
const planOf = async (userId: string) =>
  (await t.admin<{ id: string }>("select (effective_plan($1)).id", [userId]))[0].id;
const daysBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;

describe("offer", () => {
  it("sells Free, Estudante (R$ 9,90/month or R$ 49,90/semester) and Pro (R$ 19,90)", async () => {
    const plans = await t.admin<{
      id: string;
      price_cents: number;
      billing_period_days: number;
      limits: { max_maps: number | null; max_review_maps: number | null };
    }>(
      "select id, price_cents, billing_period_days, limits from plans where is_active order by sort_order",
    );
    expect(
      plans.map((p) => [
        p.id,
        p.price_cents,
        p.billing_period_days,
        p.limits.max_maps,
        p.limits.max_review_maps,
      ]),
    ).toEqual([
      ["free", 0, 30, 5, 1],
      ["plus", 990, 30, 30, null],
      ["plus_semester", 4990, 183, 30, null],
      ["pro", 1990, 30, null, null],
    ]);
  });
});

describe("PIX orders", () => {
  it("takes the amount from the plan and gives a short unique code", async () => {
    const user = await t.createUser();
    const order = await request(user.id, "plus");
    expect(order.amount_cents).toBe(990);
    expect(order.status).toBe("pending");
    expect(order.code).toMatch(/^MND-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("keeps a single open order per person", async () => {
    const user = await t.createUser();
    const first = await request(user.id, "plus");
    const second = await request(user.id, "pro");
    const rows = await t.as<Request>(user.id, "select * from payment_requests order by created_at");
    expect(rows.map((r) => [r.id === first.id, r.status])).toEqual([
      [true, "canceled"],
      [false, "pending"],
    ]);
    expect(second.amount_cents).toBe(1990);
  });

  it("refuses the free plan, retired plans and unknown plans", async () => {
    const user = await t.createUser();
    for (const plan of ["free", "gold", "nope"]) {
      expect(await errorOf(request(user.id, plan))).toBe("PLAN_NOT_AVAILABLE");
    }
  });

  it("requires invited access and limits abuse", async () => {
    const pending = await t.createUser({ invited: false });
    expect(await errorOf(request(pending.id, "plus"))).toBe("ACCESS_DENIED");

    const spammer = await t.createUser();
    for (let i = 0; i < 10; i++) await request(spammer.id, "plus");
    expect(await errorOf(request(spammer.id, "plus"))).toBe("TOO_MANY_REQUESTS");
  });

  it("does not let users write orders or subscriptions directly", async () => {
    const user = await t.createUser();
    const forged = await errorOf(
      t.as(
        user.id,
        "insert into payment_requests (code, user_id, plan_id, amount_cents) values ('X', $1, 'pro', 1)",
        [user.id],
      ),
    );
    expect(forged).toMatch(/row-level security|permission denied/);
    const order = await request(user.id, "pro");
    expect(
      await t.as(
        user.id,
        "update payment_requests set status = 'confirmed' where id = $1 returning 1",
        [order.id],
      ),
    ).toHaveLength(0);
  });

  it("lets the payer report the payment and cancel, but never confirm", async () => {
    const user = await t.createUser();
    const order = await request(user.id, "plus");
    const [reported] = await t.as<{ reported_paid_at: string; payer_note: string }>(
      user.id,
      "select * from report_pix_paid($1, 'Paguei pela conta da minha mãe')",
      [order.id],
    );
    expect(reported.reported_paid_at).not.toBeNull();
    expect(reported.payer_note).toBe("Paguei pela conta da minha mãe");
    expect(await errorOf(confirm(user.id, order.id))).toBe("ACCESS_DENIED");
    expect(await planOf(user.id)).toBe("free");
  });

  it("hides one person's orders from another", async () => {
    const alice = await t.createUser();
    const bob = await t.createUser();
    const order = await request(alice.id, "plus");
    expect(
      await t.as(bob.id, "select * from payment_requests where id = $1", [order.id]),
    ).toHaveLength(0);
    expect(await errorOf(t.as(bob.id, "select * from report_pix_paid($1)", [order.id]))).toBe(
      "REQUEST_NOT_FOUND",
    );
  });
});

describe("admin confirmation and the 30-day period", () => {
  it("activates the plan for 30 days when the admin confirms", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const order = await request(user.id, "plus");
    const done = await confirm(admin.id, order.id);

    expect(done.status).toBe("confirmed");
    expect(daysBetween(done.period_start!, done.period_end!)).toBeCloseTo(30);
    expect(await planOf(user.id)).toBe("plus");
    expect(await errorOf(confirm(admin.id, order.id))).toBe("REQUEST_NOT_PENDING");
  });

  it("adds a renewal after the current end instead of losing the remaining days", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const first = await confirm(admin.id, (await request(user.id, "pro")).id);
    const renewal = await confirm(admin.id, (await request(user.id, "pro")).id);

    expect(renewal.period_start).toEqual(first.period_end);
    expect(daysBetween(first.period_start!, renewal.period_end!)).toBeCloseTo(60);
  });

  it("gives six months for the semester plan", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const done = await confirm(admin.id, (await request(user.id, "plus_semester")).id);
    expect(done.status).toBe("confirmed");
    expect(daysBetween(done.period_start!, done.period_end!)).toBeCloseTo(183);
    expect(await planOf(user.id)).toBe("plus_semester");
  });

  it("keeps the days already paid when switching between monthly and semester Estudante", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const monthly = await confirm(admin.id, (await request(user.id, "plus")).id);
    const semester = await confirm(admin.id, (await request(user.id, "plus_semester")).id);
    expect(semester.period_start).toEqual(monthly.period_end);
    expect(daysBetween(monthly.period_start!, semester.period_end!)).toBeCloseTo(213);
  });

  it("starts an upgrade to a different plan now", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const monthly = await confirm(admin.id, (await request(user.id, "plus")).id);
    const pro = await confirm(admin.id, (await request(user.id, "pro")).id);
    expect(pro.period_start).not.toEqual(monthly.period_end);
    expect(daysBetween(pro.period_start!, pro.period_end!)).toBeCloseTo(30);
  });

  it("goes back to Free when the period ends, keeping every map", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    await confirm(admin.id, (await request(user.id, "plus")).id);
    for (let i = 0; i < 8; i++) await t.createMap(user.id);

    await t.admin(
      "update subscriptions set current_period_end = now() - interval '1 minute' where user_id = $1",
      [user.id],
    );
    expect(await planOf(user.id)).toBe("free");
    expect(await t.as(user.id, "select id from mind_maps")).toHaveLength(8);
    expect(await errorOf(t.createMap(user.id))).toBe("PLAN_LIMIT:max_maps");
  });

  it("rejects an order and lets the admin end a plan early", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    const rejected = (
      await t.as<Request>(admin.id, "select * from admin_reject_pix($1, 'Pix não encontrado')", [
        (await request(user.id, "plus")).id,
      ])
    )[0];
    expect(rejected.status).toBe("rejected");
    expect(await planOf(user.id)).toBe("free");

    await confirm(admin.id, (await request(user.id, "plus")).id);
    await t.as(admin.id, "select admin_end_subscription($1)", [user.id]);
    expect(await planOf(user.id)).toBe("free");
  });

  it("gives the admin a table with dates, days elapsed/remaining and the open order", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    await confirm(admin.id, (await request(user.id, "plus")).id);
    await t.admin(
      "update payment_requests set period_start = now() - interval '21 days', period_end = now() + interval '9 days' where user_id = $1",
      [user.id],
    );
    await t.admin(
      "update subscriptions set current_period_end = now() + interval '9 days' where user_id = $1",
      [user.id],
    );
    await request(user.id, "plus");

    const rows = await t.as<Record<string, unknown>>(
      admin.id,
      "select * from admin_billing_overview()",
    );
    const row = rows.find((r) => r.user_id === user.id)!;
    expect(row).toMatchObject({
      email: user.email,
      plan_id: "plus",
      subscription_status: "active",
      days_elapsed: 21,
      days_remaining: 9,
      payments_count: 1,
      total_paid_cents: 990,
    });
    expect((row.pending_request as { status: string }).status).toBe("pending");
    expect(await errorOf(t.as(user.id, "select * from admin_billing_overview()"))).toBe(
      "ACCESS_DENIED",
    );
  });
});

describe("billing settings", () => {
  it("are readable by users and editable only by admins", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const user = await t.createUser();
    await t.as(
      admin.id,
      "update billing_settings set pix_key = 'pix@exemplo.com', receiver_name = 'GABRIEL', receiver_city = 'SALVADOR'",
    );

    expect(await t.as(user.id, "select pix_key from billing_settings")).toEqual([
      { pix_key: "pix@exemplo.com" },
    ]);
    expect(
      await t.as(user.id, "update billing_settings set pix_key = 'golpe' returning 1"),
    ).toHaveLength(0);
  });
});
