import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppBindings, AppVariables, UserRow } from "../types";
import { AppError } from "../utils/http";
import { sha256 } from "../utils/crypto";

const SESSION_COOKIE = "jm_session";

export const authMiddleware = createMiddleware<{ Bindings: AppBindings; Variables: AppVariables }>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw new AppError(401, "请先登录");
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, u.session_version
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND s.session_version = u.session_version`,
  ).bind(tokenHash, new Date().toISOString()).first<Pick<UserRow, "id" | "username" | "display_name" | "role" | "status" | "session_version">>();
  if (!row) throw new AppError(401, "登录已过期，请重新登录");
  if (row.status !== "ACTIVE") throw new AppError(403, "账号已被禁用");
  c.set("user", {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    sessionVersion: row.session_version,
  });
  c.set("sessionTokenHash", tokenHash);
  await next();
});

export const superAdminMiddleware = createMiddleware<{ Bindings: AppBindings; Variables: AppVariables }>(async (c, next) => {
  if (c.get("user").role !== "SUPER_ADMIN") throw new AppError(403, "无权访问管理员功能");
  await next();
});

export { SESSION_COOKIE };
