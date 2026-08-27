import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AppBindings, AppVariables } from "../types";
import { getPagination, ok } from "../utils/http";
import { presetRange } from "../utils/time";

const my = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
my.use("/*", authMiddleware);

my.get("/dashboard", async (c) => {
  const user = c.get("user");
  const range = presetRange("today");
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'INCREASE' THEN amount_cents ELSE 0 END), 0) increase_cents,
        COALESCE(SUM(CASE WHEN transaction_type = 'DECREASE' THEN amount_cents ELSE 0 END), 0) decrease_cents,
        COUNT(*) transaction_count
       FROM transactions WHERE operator_user_id = ? AND transaction_type != 'INITIAL' AND created_at >= ? AND created_at < ?`,
    ).bind(user.id, range.start, range.end),
    c.env.DB.prepare(
      `SELECT id, request_id, card_no, transaction_type, amount_cents, remark, created_at
       FROM transactions WHERE operator_user_id = ? AND transaction_type != 'INITIAL'
       ORDER BY created_at DESC LIMIT 8`,
    ).bind(user.id),
  ]);
  const stats = batch[0]!;
  const recent = batch[1]!;
  const value = stats.results[0] as { increase_cents: number; decrease_cents: number; transaction_count: number } | undefined;
  return ok(c, {
    increaseCents: value?.increase_cents ?? 0,
    decreaseCents: value?.decrease_cents ?? 0,
    netCents: (value?.increase_cents ?? 0) - (value?.decrease_cents ?? 0),
    transactionCount: value?.transaction_count ?? 0,
    recentTransactions: recent.results,
  });
});

my.get("/transactions", async (c) => {
  const user = c.get("user");
  const { page, pageSize, offset } = getPagination(c);
  const batch = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) total FROM transactions WHERE operator_user_id = ? AND transaction_type != 'INITIAL'").bind(user.id),
    c.env.DB.prepare(
      `SELECT id, request_id, card_no, transaction_type, amount_cents, remark, created_at
       FROM transactions WHERE operator_user_id = ? AND transaction_type != 'INITIAL'
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).bind(user.id, pageSize, offset),
  ]);
  const count = batch[0]!;
  const rows = batch[1]!;
  const total = Number((count.results[0] as { total?: number } | undefined)?.total ?? 0);
  return ok(c, { items: rows.results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

export default my;
