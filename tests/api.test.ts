import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../src/worker/utils/crypto";

async function seedUser(role: "SUPER_ADMIN" | "SUB_ACCOUNT", status: "ACTIVE" | "DISABLED" = "ACTIVE") {
  const id = crypto.randomUUID();
  const username = `${role === "SUPER_ADMIN" ? "admin" : "user"}_${id.slice(0, 8)}`;
  const password = "StrongPass!2026";
  const hashed = await hashPassword(password, undefined, 100_000);
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, password_salt, password_iterations, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, username, username, hashed.hash, hashed.salt, hashed.iterations, role, status).run();
  return { id, username, password };
}

async function login(username: string, password: string) {
  const response = await SELF.fetch("https://example.com/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.com" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = response.headers.get("Set-Cookie")?.split(";")[0] ?? "";
  return { response, cookie };
}

async function createCard(cookie: string, initialAmountCents = 10_000) {
  const cardNo = `JM${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
  const response = await SELF.fetch("https://example.com/api/admin/cards", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.com" },
    body: JSON.stringify({ cardNo, initialAmountCents, remark: "测试卡" }),
  });
  const payload = await response.json<{ data: { id: string } }>();
  return { response, cardNo, id: payload.data?.id };
}

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

describe("登录与权限", () => {
  it("正确密码登录成功，错误密码失败", async () => {
    const user = await seedUser("SUPER_ADMIN");
    expect((await login(user.username, user.password)).response.status).toBe(200);
    expect((await login(user.username, "WrongPass!2026")).response.status).toBe(401);
  });
  it("禁用账号不能登录", async () => {
    const user = await seedUser("SUB_ACCOUNT", "DISABLED");
    expect((await login(user.username, user.password)).response.status).toBe(403);
  });
  it("子账号访问管理员 API 返回 403", async () => {
    const user = await seedUser("SUB_ACCOUNT");
    const { cookie } = await login(user.username, user.password);
    const response = await SELF.fetch("https://example.com/api/admin/users", { headers: { Cookie: cookie } });
    expect(response.status).toBe(403);
  });
});

describe("卡号与资金操作", () => {
  it("重复卡号创建失败", async () => {
    const admin = await seedUser("SUPER_ADMIN"); const { cookie } = await login(admin.username, admin.password);
    const card = await createCard(cookie);
    const duplicate = await SELF.fetch("https://example.com/api/admin/cards", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.com" }, body: JSON.stringify({ cardNo: card.cardNo, initialAmountCents: 100, remark: "重复" }) });
    expect(card.response.status).toBe(201); expect(duplicate.status).toBe(409);
  });
  it("增加、扣减、余额不足和幂等均保持账实一致", async () => {
    const admin = await seedUser("SUPER_ADMIN"); const { cookie: adminCookie } = await login(admin.username, admin.password);
    const card = await createCard(adminCookie, 10_000);
    const account = await seedUser("SUB_ACCOUNT"); const { cookie } = await login(account.username, account.password);
    const operate = (type: "increase" | "decrease", amountCents: number, requestId = crypto.randomUUID()) => SELF.fetch(`https://example.com/api/cards/${card.id}/${type}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.com" }, body: JSON.stringify({ requestId, amountCents, remark: "测试" }) });
    expect((await operate("increase", 5_000)).status).toBe(200);
    expect((await operate("decrease", 3_000)).status).toBe(200);
    expect((await operate("decrease", 20_000)).status).toBe(409);
    const requestId = crypto.randomUUID();
    expect((await operate("increase", 1_000, requestId)).status).toBe(200);
    expect((await operate("increase", 1_000, requestId)).status).toBe(200);
    const balance = await env.DB.prepare("SELECT balance_cents FROM cards WHERE id = ?").bind(card.id).first<{ balance_cents: number }>();
    const count = await env.DB.prepare("SELECT COUNT(*) count FROM transactions WHERE request_id = ?").bind(requestId).first<{ count: number }>();
    expect(balance?.balance_cents).toBe(13_000); expect(count?.count).toBe(1);
  });
  it("并发扣减只允许一笔成功", async () => {
    const admin = await seedUser("SUPER_ADMIN"); const { cookie: adminCookie } = await login(admin.username, admin.password);
    const card = await createCard(adminCookie, 10_000);
    const account = await seedUser("SUB_ACCOUNT"); const { cookie } = await login(account.username, account.password);
    const debit = () => SELF.fetch(`https://example.com/api/cards/${card.id}/decrease`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.com" }, body: JSON.stringify({ requestId: crypto.randomUUID(), amountCents: 8_000, remark: "并发测试" }) });
    const responses = await Promise.all([debit(), debit()]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const balance = await env.DB.prepare("SELECT balance_cents FROM cards WHERE id = ?").bind(card.id).first<{ balance_cents: number }>();
    expect(balance?.balance_cents).toBe(2_000);
  });
});
