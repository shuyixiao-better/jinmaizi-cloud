import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, superAdminMiddleware } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import type { AppBindings, AppVariables } from "../types";
import { hashPassword } from "../utils/crypto";
import { AppError, getPagination, mapDatabaseError, ok } from "../utils/http";
import { presetRange, resolveRange } from "../utils/time";

const admin = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
admin.use("/*", authMiddleware, superAdminMiddleware);

const usernameSchema = z.string().trim().regex(/^[A-Za-z0-9_.-]{3,32}$/, "用户名仅支持字母、数字、点、横线和下划线");
const passwordSchema = z.string().min(8, "密码至少 8 位").max(128);

admin.get("/dashboard", async (c) => {
  const today = presetRange("today");
  const batch = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) card_count, COALESCE(SUM(balance_cents), 0) total_balance_cents FROM cards"),
    c.env.DB.prepare("SELECT COUNT(*) user_count FROM users WHERE role = 'SUB_ACCOUNT'"),
    c.env.DB.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'INCREASE' THEN amount_cents ELSE 0 END), 0) increase_cents,
        COALESCE(SUM(CASE WHEN transaction_type = 'DECREASE' THEN amount_cents ELSE 0 END), 0) decrease_cents,
        SUM(CASE WHEN transaction_type != 'INITIAL' THEN 1 ELSE 0 END) transaction_count
       FROM transactions WHERE created_at >= ? AND created_at < ?`,
    ).bind(today.start, today.end),
  ]);
  const cards = batch[0]!;
  const users = batch[1]!;
  const stats = batch[2]!;
  const card = cards.results[0] as { card_count?: number; total_balance_cents?: number } | undefined;
  const user = users.results[0] as { user_count?: number } | undefined;
  const stat = stats.results[0] as { increase_cents?: number; decrease_cents?: number; transaction_count?: number } | undefined;
  const increase = Number(stat?.increase_cents ?? 0);
  const decrease = Number(stat?.decrease_cents ?? 0);
  return ok(c, {
    cardCount: Number(card?.card_count ?? 0),
    totalBalanceCents: Number(card?.total_balance_cents ?? 0),
    increaseCents: increase,
    decreaseCents: decrease,
    netCents: increase - decrease,
    transactionCount: Number(stat?.transaction_count ?? 0),
    userCount: Number(user?.user_count ?? 0),
  });
});

admin.get("/users", async (c) => {
  const { page, pageSize, offset } = getPagination(c);
  const batch = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) total FROM users WHERE role = 'SUB_ACCOUNT'"),
    c.env.DB.prepare(
      `SELECT u.id, u.username, u.display_name, u.status, u.created_at, u.last_login_at,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'INCREASE' THEN t.amount_cents ELSE 0 END), 0) increase_cents,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'DECREASE' THEN t.amount_cents ELSE 0 END), 0) decrease_cents,
        SUM(CASE WHEN t.transaction_type != 'INITIAL' THEN 1 ELSE 0 END) transaction_count
       FROM users u LEFT JOIN transactions t ON t.operator_user_id = u.id
       WHERE u.role = 'SUB_ACCOUNT' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(pageSize, offset),
  ]);
  const count = batch[0]!;
  const rows = batch[1]!;
  const total = Number((count.results[0] as { total?: number } | undefined)?.total ?? 0);
  return ok(c, { items: rows.results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

admin.post(
  "/users",
  zValidator("json", z.object({ username: usernameSchema, displayName: z.string().trim().min(1).max(64), password: passwordSchema })),
  async (c) => {
    const body = c.req.valid("json");
    const password = await hashPassword(body.password);
    const id = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        `INSERT INTO users (id, username, display_name, password_hash, password_salt, password_iterations, role, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'SUB_ACCOUNT', ?)`,
      ).bind(id, body.username, body.displayName, password.hash, password.salt, password.iterations, c.get("user").id).run();
    } catch (error) { throw mapDatabaseError(error) ?? error; }
    await writeAudit(c, "CREATE_SUB_ACCOUNT", "USER", id, { username: body.username });
    return ok(c, { id }, 201);
  },
);

admin.put(
  "/users/:id",
  zValidator("json", z.object({ username: usernameSchema, displayName: z.string().trim().min(1).max(64) })),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    try {
      const result = await c.env.DB.prepare(
        "UPDATE users SET username = ?, display_name = ?, updated_at = ? WHERE id = ? AND role = 'SUB_ACCOUNT'",
      ).bind(body.username, body.displayName, new Date().toISOString(), id).run();
      if (result.meta.changes === 0) throw new AppError(404, "子账号不存在");
    } catch (error) { if (error instanceof AppError) throw error; throw mapDatabaseError(error) ?? error; }
    await writeAudit(c, "UPDATE_SUB_ACCOUNT", "USER", id, { username: body.username });
    return ok(c, { updated: true });
  },
);

admin.post(
  "/users/:id/reset-password",
  zValidator("json", z.object({ password: passwordSchema })),
  async (c) => {
    const id = c.req.param("id");
    const password = await hashPassword(c.req.valid("json").password);
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?,
         session_version = session_version + 1, updated_at = ? WHERE id = ? AND role = 'SUB_ACCOUNT'`,
      ).bind(password.hash, password.salt, password.iterations, new Date().toISOString(), id),
      c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
    ]);
    if (results[0]!.meta.changes === 0) throw new AppError(404, "子账号不存在");
    await writeAudit(c, "RESET_PASSWORD", "USER", id);
    return ok(c, { reset: true });
  },
);

for (const status of ["enable", "disable"] as const) {
  admin.post(`/users/:id/${status}`, async (c) => {
    const id = c.req.param("id");
    const nextStatus = status === "enable" ? "ACTIVE" : "DISABLED";
    const statements = [
      c.env.DB.prepare(
        "UPDATE users SET status = ?, session_version = session_version + 1, updated_at = ? WHERE id = ? AND role = 'SUB_ACCOUNT'",
      ).bind(nextStatus, new Date().toISOString(), id),
    ];
    if (status === "disable") statements.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
    const results = await c.env.DB.batch(statements);
    if (results[0]!.meta.changes === 0) throw new AppError(404, "子账号不存在");
    await writeAudit(c, status === "enable" ? "ENABLE_SUB_ACCOUNT" : "DISABLE_SUB_ACCOUNT", "USER", id);
    return ok(c, { status: nextStatus });
  });
}

admin.get("/cards", async (c) => {
  const { page, pageSize, offset } = getPagination(c);
  const cardNo = (c.req.query("cardNo") ?? "").trim();
  const where = cardNo ? "WHERE card_no = ? COLLATE NOCASE" : "";
  const params: string[] = cardNo ? [cardNo] : [];
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) total FROM cards ${where}`).bind(...params),
    c.env.DB.prepare(
      `SELECT id, card_no, balance_cents, status, remark, created_at, updated_at FROM cards ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...params, pageSize, offset),
  ]);
  const count = batch[0]!;
  const rows = batch[1]!;
  const total = Number((count.results[0] as { total?: number } | undefined)?.total ?? 0);
  return ok(c, { items: rows.results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

admin.post(
  "/cards",
  zValidator("json", z.object({
    cardNo: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/, "卡号仅支持字母、数字、横线和下划线"),
    initialAmountCents: z.number().int().positive().max(100_000_000_000),
    remark: z.string().trim().max(500).default(""),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const cardId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO cards (id, card_no, balance_cents, remark, created_by) VALUES (?, ?, 0, ?, ?)",
        ).bind(cardId, body.cardNo, body.remark, user.id),
        c.env.DB.prepare(
          `INSERT INTO transactions
           (id, request_id, card_id, card_no, operator_user_id, operator_username, transaction_type, amount_cents, remark)
           VALUES (?, ?, ?, ?, ?, ?, 'INITIAL', ?, ?)`,
        ).bind(transactionId, `initial:${cardId}`, cardId, body.cardNo, user.id, user.username, body.initialAmountCents, body.remark || "初始余额"),
      ]);
    } catch (error) { throw mapDatabaseError(error) ?? error; }
    await writeAudit(c, "CREATE_CARD", "CARD", cardId, { cardNo: body.cardNo, initialAmountCents: body.initialAmountCents });
    return ok(c, { id: cardId }, 201);
  },
);

admin.put(
  "/cards/:id",
  zValidator("json", z.object({ remark: z.string().trim().max(500) })),
  async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("UPDATE cards SET remark = ?, updated_at = ? WHERE id = ?")
      .bind(c.req.valid("json").remark, new Date().toISOString(), id).run();
    if (result.meta.changes === 0) throw new AppError(404, "卡号不存在");
    await writeAudit(c, "UPDATE_CARD", "CARD", id);
    return ok(c, { updated: true });
  },
);

for (const status of ["enable", "disable"] as const) {
  admin.post(`/cards/:id/${status}`, async (c) => {
    const id = c.req.param("id");
    const nextStatus = status === "enable" ? "ACTIVE" : "DISABLED";
    const result = await c.env.DB.prepare("UPDATE cards SET status = ?, updated_at = ? WHERE id = ?")
      .bind(nextStatus, new Date().toISOString(), id).run();
    if (result.meta.changes === 0) throw new AppError(404, "卡号不存在");
    await writeAudit(c, status === "enable" ? "ENABLE_CARD" : "DISABLE_CARD", "CARD", id);
    return ok(c, { status: nextStatus });
  });
}

admin.get("/transactions", async (c) => {
  const { page, pageSize, offset } = getPagination(c);
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  const cardNo = c.req.query("cardNo")?.trim();
  const userId = c.req.query("userId")?.trim();
  const type = c.req.query("type")?.trim();
  if (cardNo) { conditions.push("t.card_no = ? COLLATE NOCASE"); values.push(cardNo); }
  if (userId) { conditions.push("t.operator_user_id = ?"); values.push(userId); }
  if (type && ["INITIAL", "INCREASE", "DECREASE"].includes(type)) { conditions.push("t.transaction_type = ?"); values.push(type); }
  const rangePreset = c.req.query("range");
  if (rangePreset) {
    const range = resolveRange(rangePreset, c.req.query("startDate"), c.req.query("endDate"));
    conditions.push("t.created_at >= ?", "t.created_at < ?"); values.push(range.start, range.end);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) total FROM transactions t ${where}`).bind(...values),
    c.env.DB.prepare(
      `SELECT t.id, t.request_id, t.card_no, t.operator_user_id, t.operator_username,
       t.transaction_type, t.amount_cents, t.remark, t.created_at
       FROM transactions t ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...values, pageSize, offset),
  ]);
  const count = batch[0]!;
  const rows = batch[1]!;
  const total = Number((count.results[0] as { total?: number } | undefined)?.total ?? 0);
  return ok(c, { items: rows.results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

admin.get("/account-summary", async (c) => {
  const range = resolveRange(c.req.query("range"), c.req.query("startDate"), c.req.query("endDate"));
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.display_name,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'INCREASE' THEN t.amount_cents ELSE 0 END), 0) increase_cents,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'DECREASE' THEN t.amount_cents ELSE 0 END), 0) decrease_cents,
      SUM(CASE WHEN t.transaction_type != 'INITIAL' THEN 1 ELSE 0 END) transaction_count
     FROM users u LEFT JOIN transactions t ON t.operator_user_id = u.id AND t.created_at >= ? AND t.created_at < ?
     WHERE u.role = 'SUB_ACCOUNT' GROUP BY u.id ORDER BY transaction_count DESC, u.created_at DESC`,
  ).bind(range.start, range.end).all();
  return ok(c, { items: rows.results, range });
});

admin.get("/audit-logs", async (c) => {
  const { page, pageSize, offset } = getPagination(c);
  const batch = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) total FROM audit_logs"),
    c.env.DB.prepare(
      `SELECT id, user_id, username, action, resource_type, resource_id, ip, user_agent, details, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).bind(pageSize, offset),
  ]);
  const count = batch[0]!;
  const rows = batch[1]!;
  const total = Number((count.results[0] as { total?: number } | undefined)?.total ?? 0);
  return ok(c, { items: rows.results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

export default admin;
