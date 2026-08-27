import { useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { TransactionsTable, type Transaction } from "../components/transactions-table";
import { LoadingPage, PageHeader, Pagination } from "../components/ui";
import { api, type PageData } from "../lib/api";

interface Account { id: string; username: string; display_name: string }

export function AdminTransactionsPage() {
  const [page, setPage] = useState(1); const [cardNo, setCardNo] = useState(""); const [userId, setUserId] = useState(""); const [type, setType] = useState(""); const [range, setRange] = useState(""); const [filters, setFilters] = useState("");
  const accounts = useQuery({ queryKey: ["account-options"], queryFn: () => api<PageData<Account>>("/api/admin/users?pageSize=100") });
  const query = useQuery({ queryKey: ["admin-transactions", page, filters], queryFn: () => api<PageData<Transaction>>(`/api/admin/transactions?page=${page}&${filters}`) });
  const submit = (event: FormEvent) => { event.preventDefault(); const p = new URLSearchParams(); if (cardNo.trim()) p.set("cardNo", cardNo.trim()); if (userId) p.set("userId", userId); if (type) p.set("type", type); if (range) p.set("range", range); setPage(1); setFilters(p.toString()); };
  if (query.isLoading) return <LoadingPage />;
  return <><PageHeader title="交易流水" description="查看和筛选系统全部不可变交易记录" /><div className="panel overflow-hidden"><form onSubmit={submit} className="grid gap-3 border-b border-black/5 p-5 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-black/30" /><input className="input !h-10 pl-9 font-mono" value={cardNo} onChange={(e) => setCardNo(e.target.value)} placeholder="完整卡号" /></div><select className="select w-full" value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">全部账号</option>{accounts.data?.items.map((item) => <option key={item.id} value={item.id}>{item.display_name}（{item.username}）</option>)}</select><select className="select w-full" value={type} onChange={(e) => setType(e.target.value)}><option value="">全部类型</option><option value="INITIAL">初始余额</option><option value="INCREASE">增加</option><option value="DECREASE">扣减</option></select><select className="select w-full" value={range} onChange={(e) => setRange(e.target.value)}><option value="">全部时间</option><option value="today">今天</option><option value="yesterday">昨天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option></select><button className="btn-secondary"><Filter className="size-4" />筛选</button></form><TransactionsTable items={query.data?.items ?? []} showOperator /><Pagination page={page} totalPages={query.data?.totalPages ?? 0} onChange={setPage} /></div></>;
}
