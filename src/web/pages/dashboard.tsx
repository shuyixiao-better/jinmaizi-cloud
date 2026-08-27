import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowUpRight, CreditCard, Users, WalletCards } from "lucide-react";
import { useAuth } from "../auth";
import { LoadingPage, PageHeader } from "../components/ui";
import { TransactionsTable, type Transaction } from "../components/transactions-table";
import { api } from "../lib/api";
import { money, shanghaiGreeting } from "../lib/format";

function StatCard({ title, value, icon: Icon, tone = "neutral" }: { title: string; value: string; icon: typeof Activity; tone?: "up" | "down" | "neutral" }) {
  const style = tone === "up" ? "bg-emerald-50 text-emerald-700" : tone === "down" ? "bg-red-50 text-red-700" : "bg-wheat-100 text-wheat-800";
  return <div className="panel p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-black/40">{title}</p><p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p></div><div className={`grid size-10 place-items-center rounded-xl ${style}`}><Icon className="size-5" /></div></div></div>;
}

interface AdminStats { cardCount: number; totalBalanceCents: number; increaseCents: number; decreaseCents: number; netCents: number; transactionCount: number; userCount: number }
interface MyStats { increaseCents: number; decreaseCents: number; netCents: number; transactionCount: number; recentTransactions: Transaction[] }

export function DashboardPage() {
  const { user } = useAuth();
  const greeting = shanghaiGreeting();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const query = useQuery({ queryKey: ["dashboard", user?.role], queryFn: () => api<AdminStats | MyStats>(isAdmin ? "/api/admin/dashboard" : "/api/my/dashboard") });
  if (query.isLoading) return <LoadingPage />;
  if (!query.data) return null;
  if (isAdmin) {
    const d = query.data as AdminStats;
    return <><PageHeader title={`${greeting}，${user?.displayName ?? "管理员"}`} description="这里是金麦子云系统今天的整体运行情况" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="卡号总数" value={d.cardCount.toLocaleString()} icon={CreditCard} /><StatCard title="当前卡内总余额" value={money(d.totalBalanceCents)} icon={WalletCards} /><StatCard title="今日增加" value={money(d.increaseCents)} icon={ArrowUpRight} tone="up" /><StatCard title="今日扣减" value={money(d.decreaseCents)} icon={ArrowDownRight} tone="down" /><StatCard title="今日净变化" value={money(d.netCents, true)} icon={Activity} tone={d.netCents >= 0 ? "up" : "down"} /><StatCard title="今日交易" value={`${d.transactionCount.toLocaleString()} 笔`} icon={Activity} /><StatCard title="子账号数量" value={d.userCount.toLocaleString()} icon={Users} /></div><div className="panel mt-6 overflow-hidden"><div className="border-b border-black/5 p-6"><h2 className="font-bold">运营提示</h2><p className="mt-1 text-sm text-black/40">金额变化实时汇总，初始余额不计入今日增减统计。</p></div><div className="grid gap-4 p-6 sm:grid-cols-3"><div className="rounded-xl bg-[#f8f7f3] p-4"><p className="text-xs text-black/40">平均卡余额</p><p className="mt-2 text-lg font-bold">{money(d.cardCount ? Math.round(d.totalBalanceCents / d.cardCount) : 0)}</p></div><div className="rounded-xl bg-[#f8f7f3] p-4"><p className="text-xs text-black/40">今日资金方向</p><p className={`mt-2 text-lg font-bold ${d.netCents >= 0 ? "text-emerald-700" : "text-red-600"}`}>{d.netCents >= 0 ? "净增加" : "净扣减"}</p></div><div className="rounded-xl bg-[#f8f7f3] p-4"><p className="text-xs text-black/40">系统状态</p><p className="mt-2 text-lg font-bold text-emerald-700">运行正常</p></div></div></div></>;
  }
  const d = query.data as MyStats;
  return <><PageHeader title={`${greeting}，${user?.displayName ?? ""}`} description="以下仅展示你本人今天的操作数据" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="今日增加" value={money(d.increaseCents)} icon={ArrowUpRight} tone="up" /><StatCard title="今日扣减" value={money(d.decreaseCents)} icon={ArrowDownRight} tone="down" /><StatCard title="今日净变化" value={money(d.netCents, true)} icon={Activity} tone={d.netCents >= 0 ? "up" : "down"} /><StatCard title="今日交易" value={`${d.transactionCount} 笔`} icon={WalletCards} /></div><div className="panel mt-6 overflow-hidden"><div className="border-b border-black/5 p-5"><h2 className="font-bold">我的最近交易</h2><p className="mt-1 text-xs text-black/40">只显示当前登录账号的操作记录</p></div><TransactionsTable items={d.recentTransactions} /></div></>;
}
