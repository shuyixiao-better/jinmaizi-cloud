import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoadingPage, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { money } from "../lib/format";

interface Summary { id: string; username: string; display_name: string; increase_cents: number; decrease_cents: number; transaction_count: number }
interface Result { items: Summary[]; range: { start: string; end: string } }

export function AccountSummaryPage() {
  const [range, setRange] = useState("today");
  const query = useQuery({ queryKey: ["account-summary", range], queryFn: () => api<Result>(`/api/admin/account-summary?range=${range}`) });
  if (query.isLoading) return <LoadingPage />;
  return <><PageHeader title="账号交易统计" description="按业务时区（Asia/Shanghai）统计每个子账号的资金操作" action={<select className="select" value={range} onChange={(e) => setRange(e.target.value)}><option value="today">今天</option><option value="yesterday">昨天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option></select>} /><div className="panel overflow-hidden"><div className="table-wrap"><table className="data-table"><thead><tr><th>子账号</th><th className="text-right!">增加金额</th><th className="text-right!">扣减金额</th><th className="text-right!">净变化</th><th className="text-right!">交易笔数</th></tr></thead><tbody>{query.data?.items.map((item) => { const net = Number(item.increase_cents) - Number(item.decrease_cents); return <tr key={item.id}><td><div className="font-semibold">{item.display_name}</div><div className="mt-1 font-mono text-xs text-black/40">@{item.username}</div></td><td className="text-right! font-semibold text-emerald-700!">{money(Number(item.increase_cents))}</td><td className="text-right! font-semibold text-red-600!">{money(Number(item.decrease_cents))}</td><td className={`text-right! font-bold ${net >= 0 ? "text-emerald-700!" : "text-red-600!"}`}>{money(net, true)}</td><td className="text-right!">{item.transaction_count ?? 0} 笔</td></tr>; })}</tbody></table></div>{!query.data?.items.length && <div className="py-14 text-center text-sm text-black/40">暂无子账号</div>}</div></>;
}
