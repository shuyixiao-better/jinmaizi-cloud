import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, Filter, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { TransactionsTable, type Transaction } from "../components/transactions-table";
import { LoadingPage, Message, PageHeader, Pagination, Spinner } from "../components/ui";
import { api, type PageData } from "../lib/api";
import { previousMonthDateRange } from "../lib/format";
import { downloadTransactionReport } from "../lib/transaction-report";

interface Account { id: string; username: string; display_name: string }
interface DateSelection { startDate: string; endDate: string }

const initialDates = previousMonthDateRange();

function transactionParams(
  cardNo: string,
  userId: string,
  type: string,
  dates: DateSelection,
): URLSearchParams {
  const params = new URLSearchParams();
  if (cardNo.trim()) params.set("cardNo", cardNo.trim());
  if (userId) params.set("userId", userId);
  if (type) params.set("type", type);
  params.set("range", "custom");
  params.set("startDate", dates.startDate);
  params.set("endDate", dates.endDate);
  return params;
}

export function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [cardNo, setCardNo] = useState("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [filters, setFilters] = useState(() => transactionParams("", "", "", initialDates).toString());
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const accounts = useQuery({ queryKey: ["account-options"], queryFn: () => api<PageData<Account>>("/api/admin/users?pageSize=100") });
  const query = useQuery({ queryKey: ["admin-transactions", page, filters], queryFn: () => api<PageData<Transaction>>(`/api/admin/transactions?page=${page}&${filters}`) });

  const validateDates = (dates: DateSelection): boolean => {
    if (!dates.startDate || !dates.endDate) { setNotice({ type: "error", text: "请选择开始日期和结束日期" }); return false; }
    if (dates.startDate > dates.endDate) { setNotice({ type: "error", text: "开始日期不能晚于结束日期" }); return false; }
    return true;
  };

  const applyFilters = (dates: DateSelection = { startDate, endDate }) => {
    if (!validateDates(dates)) return;
    setNotice(null);
    setPage(1);
    setFilters(transactionParams(cardNo, userId, type, dates).toString());
  };

  const submit = (event: FormEvent) => { event.preventDefault(); applyFilters(); };
  const selectPreviousMonth = () => {
    const dates = previousMonthDateRange();
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    applyFilters(dates);
  };

  const exportExcel = async () => {
    const dates = { startDate, endDate };
    if (!validateDates(dates)) return;
    const params = transactionParams(cardNo, userId, type, dates);
    setNotice(null);
    setExporting(true);
    setPage(1);
    setFilters(params.toString());
    try {
      params.set("pageSize", "100");
      params.set("page", "1");
      const first = await api<PageData<Transaction>>(`/api/admin/transactions?${params}`);
      const items = [...first.items];
      for (let nextPage = 2; nextPage <= first.totalPages; nextPage += 1) {
        params.set("page", String(nextPage));
        const result = await api<PageData<Transaction>>(`/api/admin/transactions?${params}`);
        items.push(...result.items);
      }
      await downloadTransactionReport(items, dates.startDate, dates.endDate);
      setNotice({ type: "success", text: `已下载 ${items.length} 笔交易流水 Excel 文件` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "导出失败，请稍后重试" });
    } finally { setExporting(false); }
  };

  if (query.isLoading) return <LoadingPage />;
  return <>
    <PageHeader title="交易流水" description="按日期查询全部不可变交易记录，并下载 Excel 明细" />
    <div className="panel overflow-hidden">
      <form onSubmit={submit} className="border-b border-black/5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_.8fr_1fr_1fr]">
          <div><label className="label !mb-1.5">卡号</label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-black/30" /><input className="input !h-10 pl-9 font-mono" value={cardNo} onChange={(event) => setCardNo(event.target.value)} placeholder="全部卡号" /></div></div>
          <div><label className="label !mb-1.5">操作账号</label><select className="select w-full" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">全部账号</option>{accounts.data?.items.map((item) => <option key={item.id} value={item.id}>{item.display_name}（{item.username}）</option>)}</select></div>
          <div><label className="label !mb-1.5">交易类型</label><select className="select w-full" value={type} onChange={(event) => setType(event.target.value)}><option value="">全部类型</option><option value="INITIAL">初始余额</option><option value="INCREASE">增加</option><option value="DECREASE">扣减</option></select></div>
          <div><label className="label !mb-1.5">开始日期</label><input aria-label="开始日期" type="date" className="input !h-10" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></div>
          <div><label className="label !mb-1.5">结束日期</label><input aria-label="结束日期" type="date" className="input !h-10" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={selectPreviousMonth}><CalendarRange className="size-4" />上个月</button>
          <button className="btn-secondary"><Filter className="size-4" />查询</button>
          <button type="button" className="btn-primary" disabled={exporting} onClick={exportExcel}>{exporting ? <Spinner /> : <Download className="size-4" />}{exporting ? "正在生成 Excel" : "下载 Excel"}</button>
          <span className="ml-auto text-sm text-black/40">当前共 {query.data?.total ?? 0} 笔</span>
        </div>
        {notice && <div className="mt-4"><Message type={notice.type}>{notice.text}</Message></div>}
        {query.error && <div className="mt-4"><Message type="error">{query.error instanceof Error ? query.error.message : "交易流水加载失败"}</Message></div>}
      </form>
      <TransactionsTable items={query.data?.items ?? []} showOperator />
      <Pagination page={page} totalPages={query.data?.totalPages ?? 0} onChange={setPage} />
    </div>
  </>;
}
