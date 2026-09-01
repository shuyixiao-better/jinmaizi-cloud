import {
  Activity, CreditCard, FileClock, LayoutDashboard, LogOut, Menu, Search, ShieldCheck,
  UserRound, Users, WalletCards, X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api, json } from "../lib/api";

const adminItems = [
  ["/", "工作台", LayoutDashboard], ["/admin/cards", "卡号管理", CreditCard],
  ["/admin/transactions", "交易流水", WalletCards], ["/admin/users", "子账号管理", Users],
  ["/admin/summary", "账号交易统计", Activity], ["/admin/audit", "审计日志", ShieldCheck],
] as const;
const userItems = [
  ["/", "工作台", LayoutDashboard], ["/cards/query", "卡号查询", Search], ["/my/transactions", "我的交易", FileClock],
] as const;

export function AppLayout() {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const items = user.role === "SUPER_ADMIN" ? adminItems : userItems;
  const logout = async () => { try { await api("/api/auth/logout", json("POST")); } finally { await clear(); navigate("/login"); } };
  const sidebar = <>
    <div className="flex h-19 items-center gap-3 border-b border-white/8 px-5">
      <img src="/brand/golden-wheat-logo.png" alt="Golden Wheat Hotel" className="size-12 shrink-0 object-contain" />
      <div><div className="font-bold tracking-wide text-white">金麦子云系统</div><div className="mt-0.5 text-[10px] tracking-[.2em] text-white/35">JINMAIZI CLOUD</div></div>
      <button className="ml-auto text-white/50 lg:hidden" onClick={() => setOpen(false)}><X /></button>
    </div>
    <nav className="flex-1 space-y-1 p-3">
      <div className="px-3 pb-2 pt-3 text-[10px] font-semibold tracking-[.18em] text-white/30">管理菜单</div>
      {items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-white/10 font-semibold text-white" : "text-white/55 hover:bg-white/6 hover:text-white"}`}><Icon className="size-[18px]" />{label}</NavLink>)}
      <NavLink to="/profile" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-white/10 font-semibold text-white" : "text-white/55 hover:bg-white/6 hover:text-white"}`}><UserRound className="size-[18px]" />个人中心</NavLink>
    </nav>
    <div className="border-t border-white/8 p-3"><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 transition hover:bg-red-500/10 hover:text-red-300"><LogOut className="size-[18px]" />退出登录</button></div>
  </>;
  return <div className="min-h-screen bg-[#f6f6f4]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#171611] lg:flex">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><aside onClick={(e) => e.stopPropagation()} className="flex h-full w-72 flex-col bg-[#171611]">{sidebar}</aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-19 items-center border-b border-black/5 bg-white/85 px-4 backdrop-blur-xl sm:px-7">
        <button className="mr-3 rounded-lg p-2 hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
        <div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-sm font-semibold">{user.displayName}</div><div className="text-xs text-black/40">{user.role === "SUPER_ADMIN" ? "超级管理员" : "子账号"}</div></div><div className="grid size-10 place-items-center rounded-full bg-wheat-100 font-bold text-wheat-800">{user.displayName.slice(0, 1)}</div></div>
      </header>
      <main className="mx-auto max-w-400 p-4 sm:p-7"><Outlet /></main>
    </div>
  </div>;
}
