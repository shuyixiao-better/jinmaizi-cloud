import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import admin from "./routes/admin";
import auth from "./routes/auth";
import cards from "./routes/cards";
import my from "./routes/my";
import type { AppBindings, AppVariables } from "./types";
import { AppError } from "./utils/http";

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
  referrerPolicy: "same-origin",
}));
app.use("/api/*", logger((message) => console.log(JSON.stringify({ message }))));
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ success: false, message: "请求来源无效" }, 403);
    }
    const contentType = c.req.header("Content-Type") ?? "";
    if (c.req.method !== "DELETE" && !contentType.toLowerCase().includes("application/json")) {
      return c.json({ success: false, message: "仅接受 JSON 请求" }, 415);
    }
  }
  await next();
});

app.get("/api/health", (c) => c.json({ success: true, data: { status: "ok" } }));
app.route("/api/auth", auth);
app.route("/api/admin", admin);
app.route("/api/cards", cards);
app.route("/api/my", my);

app.notFound((c) => c.json({ success: false, message: "接口不存在" }, 404));
app.onError((error, c) => {
  if (error instanceof AppError) return c.json({ success: false, message: error.message }, error.status);
  if (error.name === "ZodError") return c.json({ success: false, message: "请求参数不正确" }, 400);
  console.error(JSON.stringify({
    message: "unhandled request error",
    error: error instanceof Error ? error.message : String(error),
    path: new URL(c.req.url).pathname,
  }));
  return c.json({ success: false, message: "操作失败，请稍后重试" }, 500);
});

export { app };
export default app;
