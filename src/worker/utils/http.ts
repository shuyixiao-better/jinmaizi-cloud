import type { Context } from "hono";
import type { AppBindings, AppVariables } from "../types";

type AppContext = Context<{ Bindings: AppBindings; Variables: AppVariables }>;

export class AppError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function ok<T>(c: AppContext, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true as const, data }, status);
}

export function getClientIp(c: AppContext): string | null {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? null;
}

export function getPagination(c: AppContext): { page: number; pageSize: number; offset: number } {
  const rawPage = Number(c.req.query("page") ?? 1);
  const rawPageSize = Number(c.req.query("pageSize") ?? 20);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isInteger(rawPageSize) ? Math.min(Math.max(rawPageSize, 1), 100) : 20;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function mapDatabaseError(error: unknown): AppError | null {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed: cards.card_no")) return new AppError(409, "卡号已存在");
  if (message.includes("UNIQUE constraint failed: users.username")) return new AppError(409, "用户名已存在");
  if (message.includes("UNIQUE constraint failed: transactions.request_id")) return new AppError(409, "重复提交");
  if (message.includes("INSUFFICIENT_BALANCE")) return new AppError(409, "余额不足，无法完成扣减");
  if (message.includes("CARD_DISABLED")) return new AppError(409, "卡号已被禁用");
  if (message.includes("CARD_NOT_FOUND")) return new AppError(404, "卡号不存在");
  return null;
}
