import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import type { AppBindings, AppVariables, CardRow } from "../types";
import { AppError, mapDatabaseError, ok } from "../utils/http";

const cards = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
cards.use("/*", authMiddleware);

cards.get("/query", async (c) => {
  const cardNo = (c.req.query("cardNo") ?? "").trim();
  if (cardNo.length < 3 || cardNo.length > 64) throw new AppError(400, "请输入完整卡号");
  const card = await c.env.DB.prepare(
    "SELECT id, card_no, balance_cents, status FROM cards WHERE card_no = ? COLLATE NOCASE",
  ).bind(cardNo).first<Pick<CardRow, "id" | "card_no" | "balance_cents" | "status">>();
  if (!card) throw new AppError(404, "卡号不存在");
  return ok(c, {
    id: card.id,
    cardNo: card.card_no,
    balanceCents: card.balance_cents,
    status: card.status,
  });
});

const operationSchema = z.object({
  requestId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000_000),
  remark: z.string().trim().max(500).default(""),
});
type OperationBody = z.infer<typeof operationSchema>;

async function operateCard(
  c: Context<{ Bindings: AppBindings; Variables: AppVariables }>,
  cardId: string,
  body: OperationBody,
  transactionType: "INCREASE" | "DECREASE",
) {
  const user = c.get("user");
  const { requestId, amountCents, remark } = body;
  const existing = await c.env.DB.prepare(
    `SELECT t.id, t.transaction_type, t.amount_cents, t.card_id, c.balance_cents
     FROM transactions t JOIN cards c ON c.id = t.card_id WHERE t.request_id = ?`,
  ).bind(requestId).first<{ id: string; transaction_type: string; amount_cents: number; card_id: string; balance_cents: number }>();
  if (existing) {
    if (existing.card_id !== cardId || existing.transaction_type !== transactionType || existing.amount_cents !== amountCents) {
      throw new AppError(409, "request_id 已用于其他操作");
    }
    return ok(c, { transactionId: existing.id, balanceCents: existing.balance_cents, idempotent: true });
  }

  const card = await c.env.DB.prepare("SELECT id, card_no FROM cards WHERE id = ?").bind(cardId)
    .first<Pick<CardRow, "id" | "card_no">>();
  if (!card) throw new AppError(404, "卡号不存在");
  const transactionId = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      `INSERT INTO transactions
       (id, request_id, card_id, card_no, operator_user_id, operator_username, transaction_type, amount_cents, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(transactionId, requestId, card.id, card.card_no, user.id, user.username, transactionType, amountCents, remark).run();
  } catch (error) {
    const mapped = mapDatabaseError(error);
    if (mapped?.message === "重复提交") {
      const duplicate = await c.env.DB.prepare(
        `SELECT t.id, t.transaction_type, t.amount_cents, t.card_id, c.balance_cents
         FROM transactions t JOIN cards c ON c.id = t.card_id WHERE t.request_id = ?`,
      ).bind(requestId).first<{ id: string; transaction_type: string; amount_cents: number; card_id: string; balance_cents: number }>();
      if (duplicate && duplicate.card_id === cardId && duplicate.transaction_type === transactionType && duplicate.amount_cents === amountCents) {
        return ok(c, { transactionId: duplicate.id, balanceCents: duplicate.balance_cents, idempotent: true });
      }
    }
    throw mapped ?? error;
  }
  const updated = await c.env.DB.prepare("SELECT balance_cents FROM cards WHERE id = ?").bind(card.id)
    .first<{ balance_cents: number }>();
  await writeAudit(c, transactionType, "CARD", card.id, { transactionId, requestId, amountCents, remark });
  return ok(c, { transactionId, balanceCents: updated?.balance_cents ?? 0, idempotent: false });
}

cards.post("/:id/increase", zValidator("json", operationSchema), (c) => operateCard(c, c.req.param("id"), c.req.valid("json"), "INCREASE"));
cards.post("/:id/decrease", zValidator("json", operationSchema), (c) => operateCard(c, c.req.param("id"), c.req.valid("json"), "DECREASE"));

export default cards;
