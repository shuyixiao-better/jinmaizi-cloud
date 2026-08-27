import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const username = valueOf("--username");
const password = valueOf("--password") ?? process.env.ADMIN_PASSWORD;
const displayName = valueOf("--display-name") ?? "超级管理员";
const remote = args.includes("--remote");

if (!username || !/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
  console.error("请提供有效用户名：--username admin"); process.exit(1);
}
if (!password || password.length < 8 || password.length > 128) {
  console.error("请通过 --password 或 ADMIN_PASSWORD 提供 8-128 位密码"); process.exit(1);
}

const salt = randomBytes(16);
const iterations = 210_000;
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64");
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `INSERT INTO users (id, username, display_name, password_hash, password_salt, password_iterations, role)
VALUES (${sqlString(randomUUID())}, ${sqlString(username)}, ${sqlString(displayName)}, ${sqlString(hash)}, ${sqlString(salt.toString("base64"))}, ${iterations}, 'SUPER_ADMIN');`;
const commandArgs = ["wrangler", "d1", "execute", "jinmaizi-cloud-db", remote ? "--remote" : "--local", "--command", sql];
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", commandArgs, { stdio: "inherit", shell: false });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`超级管理员 ${username} 已创建（${remote ? "远程" : "本地"}数据库）。`);
