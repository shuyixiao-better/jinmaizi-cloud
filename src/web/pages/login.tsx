import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { api, json, type User } from "../lib/api";
import { Message, Spinner } from "../components/ui";

export function LoginPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { await api<{ user: User }>("/api/auth/login", json("POST", { username, password })); await refresh(); navigate("/", { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : "登录失败"); }
    finally { setLoading(false); }
  };
  return <div className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative hidden overflow-hidden bg-[#171611] p-14 text-white lg:flex lg:flex-col">
      <div className="absolute -right-30 -top-30 size-120 rounded-full bg-wheat-500/15 blur-3xl" />
      <div className="relative flex items-center gap-4"><img src="/brand/golden-wheat-logo.png" alt="Golden Wheat Hotel" className="size-16 object-contain" /><span className="text-xl font-bold">金麦子云系统</span></div>
      <div className="relative my-auto max-w-xl"><p className="mb-5 text-xs font-semibold tracking-[.28em] text-wheat-300">SECURE · TRACEABLE · RELIABLE</p><h1 className="text-5xl font-bold leading-[1.16] tracking-tight">每一次余额变化，<br />都有迹可循。</h1><p className="mt-7 max-w-lg text-lg leading-8 text-white/45">为卡号余额管理而生的轻量云端工作台。安全记账、实时统计、完整审计。</p><div className="mt-12 flex gap-7 text-sm text-white/45"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-wheat-400" />后端权限校验</span><span className="flex items-center gap-2"><LockKeyhole className="size-4 text-wheat-400" />资金操作幂等</span></div></div>
    </section>
    <section className="flex items-center justify-center bg-[#f8f7f3] p-6">
      <div className="w-full max-w-105"><div className="mb-9 lg:hidden"><div className="mb-7 flex items-center gap-3 font-bold"><img src="/brand/golden-wheat-logo.png" alt="Golden Wheat Hotel" className="size-12 object-contain" />金麦子云系统</div></div><p className="text-sm font-semibold text-wheat-700">欢迎回来</p><h2 className="mt-2 text-3xl font-bold tracking-tight">登录管理后台</h2><p className="mt-3 text-sm text-black/40">请输入管理员为你分配的账号和密码</p>
        <form onSubmit={submit} className="mt-9 space-y-5"><div><label className="label">用户名</label><div className="relative"><UserRound className="absolute left-3.5 top-3.5 size-4 text-black/30" /><input autoFocus autoComplete="username" className="input pl-10" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" /></div></div><div><label className="label">密码</label><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 size-4 text-black/30" /><input type="password" autoComplete="current-password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" /></div></div>{error && <Message type="error">{error}</Message>}<button disabled={loading || !username || password.length < 8} className="btn-primary !h-12 w-full">{loading ? <Spinner /> : "安全登录"}</button></form>
        <p className="mt-8 text-center text-xs text-black/30">系统不开放注册，如需账号请联系超级管理员</p></div>
    </section>
  </div>;
}
