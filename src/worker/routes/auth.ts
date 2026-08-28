import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { authMiddleware, SESSION_COOKIE } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import type { AppBindings, AppVariables, UserRow } from "../types";
import { createSessionToken, hashPassword, sha256, verifyPassword } from "../utils/crypto";
import { AppError, getClientIp, ok } from "../utils/http";

const auth = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(128),
});

auth.post("/login", zValidator("json", credentialsSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .bind(username).first<UserRow>();
  const valid = user ? await verifyPassword(password, user.password_hash, user.password_salt, user.password_iterations) : false;
  if (!user || !valid) {
    await writeAudit(c, "LOGIN_FAILED", "AUTH", null, { username }, user ? { id: user.id, username: user.username } : null);
    throw new AppError(401, "用户名或密码错误");
  }
  if (user.status !== "ACTIVE") {
    await writeAudit(c, "LOGIN_FAILED_DISABLED", "AUTH", user.id, undefined, { id: user.id, username: user.username });
    throw new AppError(403, "账号已被禁用");
  }

  const token = createSessionToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const appUser = {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    sessionVersion: user.session_version,
  };
  c.set("user", appUser);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, session_version, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(tokenHash, user.id, user.session_version, expiresAt, getClientIp(c), c.req.header("User-Agent")?.slice(0, 500) ?? null),
    c.env.DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), user.id),
  ]);
  await writeAudit(c, "LOGIN", "AUTH", user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return ok(c, { user: appUser });
});

auth.use("/me", authMiddleware);
auth.get("/me", (c) => ok(c, { user: c.get("user") }));

auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256(token);
    const actor = await c.env.DB.prepare(
      `SELECT u.id, u.username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    ).bind(tokenHash).first<{ id: string; username: string }>();
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    if (actor) await writeAudit(c, "LOGOUT", "AUTH", actor.id, undefined, actor);
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return ok(c, { loggedOut: true });
});

auth.use("/change-password", authMiddleware);
auth.post(
  "/change-password",
  zValidator("json", z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(8).max(128) })),
  async (c) => {
    const current = c.get("user");
    const body = c.req.valid("json");
    if (body.currentPassword === body.newPassword) throw new AppError(400, "新密码不能与当前密码相同");
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(current.id).first<UserRow>();
    if (!user || !(await verifyPassword(body.currentPassword, user.password_hash, user.password_salt, user.password_iterations))) {
      throw new AppError(400, "当前密码不正确");
    }
    const password = await hashPassword(body.newPassword);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?",
      ).bind(password.hash, password.salt, password.iterations, new Date().toISOString(), current.id),
      c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(current.id),
    ]);
    await writeAudit(c, "CHANGE_PASSWORD", "USER", current.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return ok(c, { changed: true });
  },
);

export default auth;
