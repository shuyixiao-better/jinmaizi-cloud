# 金麦子云系统

金麦子云系统是一套部署在 Cloudflare 上的卡号余额管理后台。超级管理员维护子账号与卡号，子账号通过完整卡号查询并增加或扣减余额；所有金额变化均生成不可修改的交易流水，并提供统计与审计能力。

## 核心能力

- 超级管理员 / 子账号双角色，禁止公开注册
- HttpOnly Cookie 会话、后端权限中间件、密码 PBKDF2 Hash + 独立 Salt
- 子账号创建、编辑、启停、密码重置与旧会话失效
- 卡号创建、精确查询、启停与分页管理
- 金额使用整数分存储，前后端双重校验
- `request_id` 唯一幂等，避免重复增减
- D1 触发器在插入流水的同一 SQL 事务中原子更新余额
- 条件扣减防止余额为负，并通过测试覆盖并发扣减
- 管理员 / 子账号独立 Dashboard、交易统计与分页流水
- 重要操作审计日志
- 中文响应式 SaaS 管理后台

## 技术栈

- 前端：React、TypeScript、Vite、Tailwind CSS、React Router、TanStack Query
- 后端：Cloudflare Workers、Hono、Zod、Web Crypto API
- 数据库：Cloudflare D1 / SQLite
- 测试：Vitest、Cloudflare Vitest Plugin、Miniflare D1
- 部署：Cloudflare Workers Static Assets、Wrangler

## 项目结构

```text
jinmaizi-cloud/
├── migrations/              # D1 数据库迁移
├── scripts/                 # 管理员初始化脚本
├── src/
│   ├── worker/              # Hono API、鉴权、服务和工具
│   └── web/                 # React 管理后台
├── tests/                   # Workers + D1 集成测试
├── wrangler.jsonc           # Worker、D1、静态资源和可观测性配置
├── vite.config.ts
└── package.json
```

## 本地运行

环境要求：Node.js 20+、npm 10+。

```bash
npm install
npm run db:migrate:local
npm run seed:admin -- --username admin --password "请换成强密码"
npm run dev
```

浏览器打开 Vite 输出的本地地址。`npm run dev` 同时运行 React 前端、Worker API 和本地 D1。

如果不希望密码出现在命令历史中，可用环境变量：

PowerShell：

```powershell
$env:ADMIN_PASSWORD="请换成强密码"
npm run seed:admin -- --username admin
Remove-Item Env:ADMIN_PASSWORD
```

Bash：

```bash
ADMIN_PASSWORD="请换成强密码" npm run seed:admin -- --username admin
```

可通过 `--display-name "管理员姓名"` 自定义显示名称。重复用户名会被数据库唯一约束拒绝。

## 创建 Cloudflare D1

先登录 Cloudflare：

```bash
npx wrangler login
```

创建数据库：

```bash
npx wrangler d1 create jinmaizi-cloud-db
```

命令会返回真实 `database_id`。将 [wrangler.jsonc](./wrangler.jsonc) 中的占位值：

```text
00000000-0000-0000-0000-000000000000
```

替换为该 ID，然后重新生成绑定类型：

```bash
npm run cf-typegen
```

真实数据库 ID 不是密码，可以提交到仓库；当前仓库保留占位符，方便首次创建者配置自己的 D1。

## Migration

本地数据库：

```bash
npm run db:migrate:local
```

远程 D1：

```bash
npm run db:migrate:remote
```

也可以直接使用 Wrangler：

```bash
npx wrangler d1 migrations apply jinmaizi-cloud-db --local
npx wrangler d1 migrations apply jinmaizi-cloud-db --remote
```

Wrangler 会用 `d1_migrations` 表记录已执行的迁移，不需要手工建表。

## 创建远程超级管理员

远程 Migration 成功后执行：

```bash
npm run seed:admin -- --remote --username admin --password "请换成强密码" --display-name "超级管理员"
```

仓库中没有默认用户名或密码，也没有公开注册接口。

## 环境变量与 Secret

当前版本使用 256 位随机会话令牌，浏览器只保存 HttpOnly Cookie，D1 只保存令牌的 SHA-256 Hash，因此不需要固定 `SESSION_SECRET`。

如未来增加第三方密钥，请勿写入 `wrangler.jsonc`，生产环境使用：

```bash
npx wrangler secret put SECRET_NAME
```

本地密钥放入 `.dev.vars`；该文件已被 Git 忽略，可参考 `.dev.vars.example`。

## 检查与测试

```bash
npm run typecheck
npm test
npm run build
```

测试覆盖正确/错误密码、禁用账号、管理员接口 403、重复卡号、增加、扣减、余额不足、幂等和并发扣减。

## 部署到 Cloudflare

首次部署建议按顺序执行：

```bash
npx wrangler login
npm run db:migrate:remote
npm run seed:admin -- --remote --username admin --password "请换成强密码"
npm run deploy
```

也可以使用需求中指定的命令：

```bash
npm run build
npx wrangler deploy
```

Vite 构建会生成 Worker 和静态资源的输出配置，Wrangler 会把 React SPA 与 Hono API 部署到同一个 Worker。

## 资金一致性设计

应用层不会直接覆盖 `cards.balance_cents`。每次金额操作只尝试插入一条 `transactions` 记录，数据库触发器在同一 SQL 事务中完成以下步骤：

1. 校验卡号存在且处于启用状态；
2. 扣减时校验当前余额充足；
3. 原子执行 `balance_cents + amount` 或 `balance_cents - amount`；
4. `request_id UNIQUE` 阻止重复执行；
5. 交易表触发器禁止修改和删除历史流水。

因此不会出现“余额已变但没有流水”，也不会出现两个并发扣减导致负余额。初始余额同样通过 `INITIAL` 流水产生。

## 时间规则

- D1 中的时间统一保存为 UTC ISO 8601。
- 前端统一按 `Asia/Shanghai` 展示。
- 今天、昨天、近 7 天和近 30 天均按上海自然日计算。

## 常见问题

### 提示 `no such table`

尚未执行 Migration，或本地/远程参数用错。运行对应的 `db:migrate:local` 或 `db:migrate:remote`。

### D1 数据库 ID 无效

先运行 `npx wrangler d1 create jinmaizi-cloud-db`，再把返回的真实 ID 写入 `wrangler.jsonc`。

### 登录后立即回到登录页

检查系统时间是否正确，并确认浏览器允许当前站点 Cookie。生产环境 Cookie 自动使用 `Secure`。

### 修改或重置密码后被退出

这是预期行为。密码变化会提升 `session_version` 并删除旧会话，所有设备都需要重新登录。

### 重复提交返回成功但余额没有再次变化

这是幂等保护。相同 `request_id` 会返回第一次操作的结果，不会生成第二条流水。

### 如何备份生产数据

```bash
npx wrangler d1 export jinmaizi-cloud-db --remote --output backup.sql
```

请将备份存放在安全位置，不要提交到公开仓库。
