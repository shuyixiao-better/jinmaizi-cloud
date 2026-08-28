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

## Cloudflare 部署手册

生产环境由一个 Cloudflare Worker 同时提供 React 前端、Hono API 和 D1 数据库访问，不需要单独部署前端。当前绑定的生产资源如下：

| 项目 | 当前值 |
| --- | --- |
| Worker | `jinmaizi-cloud` |
| D1 数据库 | `jinmaizi-cloud-db` |
| 主域名 | `https://jinmaizicloud.shop` |
| `www` 域名 | `https://www.jinmaizicloud.shop` |
| 健康检查 | `https://jinmaizicloud.shop/api/health` |

### 部署前准备

- Node.js 20 或更高版本
- npm 10 或更高版本
- 能管理当前 Cloudflare 账号的浏览器登录权限
- 在 PowerShell 中进入项目目录：

```powershell
Set-Location E:\WebstormProjects\jinmaizi-cloud
```

首次下载项目或 `package-lock.json` 发生变化时安装依赖：

```powershell
npm install
```

### 第一次部署到当前 Cloudflare 账号

以下步骤按顺序执行。当前仓库已经配置好 D1 数据库 ID 和两个生产域名，不要重复创建数据库。

#### 1. 登录 Cloudflare

```powershell
npx wrangler login
npx wrangler whoami
```

第一条命令会打开浏览器授权页。授权完成后，`whoami` 应显示正确的 Cloudflare 账号。

#### 2. 初始化远程 D1 数据库

```powershell
npm run db:migrate:remote
```

Wrangler 会询问是否继续，输入 `y` 或选择 `yes`。迁移记录保存在远程 D1 的 `d1_migrations` 表中；已经成功执行过的迁移不会重复执行。

#### 3. 创建或重置超级管理员

推荐通过临时环境变量提供密码，避免密码直接出现在命令历史中：

```powershell
$env:ADMIN_PASSWORD="请替换为至少 8 位的强密码"
npm run seed:admin -- --remote --username admin --display-name "超级管理员"
Remove-Item Env:ADMIN_PASSWORD
```

看到“超级管理员 admin 已创建（远程数据库）”才表示成功。同名管理员已存在时，这条命令会更新密码、恢复启用状态并使旧会话失效，因此也可以用于管理员密码重置。

#### 4. 构建并发布

```powershell
npm run deploy
```

`npm run deploy` 等价于：

```powershell
npm run build
npx wrangler deploy
```

构建过程会同时生成 Worker 和 React 静态资源，Wrangler 随后将二者作为同一个应用发布。部署输出中应包含：

```text
jinmaizicloud.shop (custom domain)
www.jinmaizicloud.shop (custom domain)
```

#### 5. 验证部署

```powershell
Invoke-RestMethod https://jinmaizicloud.shop/api/health
Invoke-WebRequest https://jinmaizicloud.shop/login -Method Head
Invoke-WebRequest https://www.jinmaizicloud.shop/login -Method Head
```

健康检查应返回 `status: ok`，两个登录地址应返回 HTTP `200`。

### 修改代码后如何重新部署

仅修改前端页面、样式、Worker API 或其他 TypeScript 代码时，不需要重新创建 D1，也不需要重新创建管理员。推荐执行：

```powershell
npm run typecheck
npm test
npm run deploy
```

如果只需要快速发布，并且已经在本地确认功能正常，最少只需：

```powershell
npm run deploy
```

该命令本身会先执行生产构建，构建失败时不会继续发布。发布完成后刷新生产页面即可；静态资源文件名包含内容 Hash，通常不需要手工清理 Cloudflare 缓存。

如果出现登录过期或 `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN`，先重新登录再发布：

```powershell
npx wrangler login
npm run deploy
```

### 数据库结构修改后的部署

只有修改数据库表、索引或触发器时才需要新建 Migration。不要直接手工修改生产数据库结构。

```powershell
npx wrangler d1 migrations create jinmaizi-cloud-db migration_name
```

编辑 `migrations` 目录中新生成的 SQL 文件后，先在本地数据库验证：

```powershell
npm run db:migrate:local
npm test
```

生产变更前建议先备份，再执行远程迁移和部署：

```powershell
npx wrangler d1 export jinmaizi-cloud-db --remote --output backup.sql
npm run db:migrate:remote
npm run deploy
```

数据库迁移应尽量保持向后兼容。普通代码更新没有新增 Migration 时，不要重复运行 `db:migrate:remote`。

### 更换 Cloudflare 账号或重新创建 D1

本项目当前数据库已经存在，正常部署不要执行本节。只有换账号或明确需要新数据库时才运行：

```powershell
npx wrangler d1 create jinmaizi-cloud-db
```

将命令返回的 `database_id` 更新到 [wrangler.jsonc](./wrangler.jsonc) 的 `DB` 绑定，然后执行：

```powershell
npm run cf-typegen
npm run db:migrate:remote
```

数据库 ID 不是密码，但应确认它属于当前准备部署的 Cloudflare 账号。

### 域名、DNS 与 SSL

`wrangler.jsonc` 已同时绑定裸域名和 `www` 域名：

```text
jinmaizicloud.shop
www.jinmaizicloud.shop
```

域名注册商处需要使用 Cloudflare 分配的 Nameserver。站点在 Cloudflare 中变为 `Active` 后，`npm run deploy` 会维护两个 Worker Custom Domain。Universal SSL 会自动覆盖 `jinmaizicloud.shop` 和 `*.jinmaizicloud.shop`。

当边缘证书页面显示“待验证（TXT）”且同时提示“Cloudflare 将代表您进行验证，无需执行任何操作”时，不要手工复制 `_acme-challenge` TXT，也不需要购买高级证书。首次签发可能需要一段时间，等待证书状态变为“有效”即可。

### 查看线上日志

```powershell
npx wrangler tail jinmaizi-cloud
```

保持命令运行，然后在浏览器中复现问题；终端会显示 Worker 请求和异常日志。按 `Ctrl+C` 停止。

### 查看版本与回滚

```powershell
npx wrangler versions list
npx wrangler rollback
```

回滚只恢复 Worker 代码版本，不会自动回滚 D1 数据库结构或生产数据。因此涉及数据库的发布必须先做好备份并谨慎设计迁移。

## 环境变量与 Secret

当前版本使用 256 位随机会话令牌，浏览器只保存 HttpOnly Cookie，D1 只保存令牌的 SHA-256 Hash，因此不需要固定 `SESSION_SECRET`。

如未来增加第三方密钥，请勿写入 `wrangler.jsonc`，生产环境使用：

```powershell
npx wrangler secret put SECRET_NAME
```

本地密钥放入 `.dev.vars`；该文件已被 Git 忽略，可参考 `.dev.vars.example`。

## 检查与测试

```powershell
npm run typecheck
npm test
npm run build
```

测试覆盖正确/错误密码、禁用账号、管理员接口 403、重复卡号、增加、扣减、余额不足、幂等和并发扣减。

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

### 远程迁移提示 `incomplete input: SQLITE_ERROR`

这是 Wrangler 在 Windows 上解析 D1 触发器迁移时可能出现的分句问题。仓库已通过 `.gitattributes` 强制 `migrations/*.sql` 使用 LF 换行，并避免在触发器正文中使用容易被误判的 `CASE ... END`。请确认使用修改后的迁移文件，然后重新运行：

```bash
npm run db:migrate:remote
```

失败的 D1 Migration 会整体回滚，因此不需要删除或重建刚创建的数据库。

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
