import type { Context } from "hono";
import type { AppBindings, AppVariables, AuthUser } from "../types";
import { getClientIp } from "../utils/http";

type AppContext = Context<{ Bindings: AppBindings; Variables: AppVariables }>;

export async function writeAudit(
  c: AppContext,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details?: Record<string, unknown>,
  actor?: Pick<AuthUser, "id" | "username"> | null,
): Promise<void> {
  const current = actor === undefined ? c.get("user") : actor;
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, username, action, resource_type, resource_id, ip, user_agent, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    current?.id ?? null,
    current?.username ?? "anonymous",
    action,
    resourceType,
    resourceId,
    getClientIp(c),
    c.req.header("User-Agent")?.slice(0, 500) ?? null,
    details ? JSON.stringify(details) : null,
  ).run();
}
