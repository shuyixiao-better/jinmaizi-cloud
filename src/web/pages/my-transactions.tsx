import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TransactionsTable, type Transaction } from "../components/transactions-table";
import { LoadingPage, PageHeader, Pagination } from "../components/ui";
import { api, type PageData } from "../lib/api";

export function MyTransactionsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["my-transactions", page], queryFn: () => api<PageData<Transaction>>(`/api/my/transactions?page=${page}`) });
  if (query.isLoading) return <LoadingPage />;
  return <><PageHeader title="我的交易" description="查看你本人完成的全部增加和扣减记录" /><div className="panel overflow-hidden"><TransactionsTable items={query.data?.items ?? []} /><Pagination page={page} totalPages={query.data?.totalPages ?? 0} onChange={setPage} /></div></>;
}
