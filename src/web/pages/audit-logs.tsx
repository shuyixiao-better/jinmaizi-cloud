import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Empty, LoadingPage, PageHeader, Pagination } from "../components/ui";
import { api, type PageData } from "../lib/api";
import { actionLabel, dateTime } from "../lib/format";

interface Audit { id: string; username: string; action: string; resource_type: string; resource_id: string | null; ip: string | null; user_agent: string | null; details: string | null; created_at: string }

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["audit-logs", page], queryFn: () => api<PageData<Audit>>(`/api/admin/audit-logs?page=${page}`) });
  if (query.isLoading) return <LoadingPage />;
  return <><PageHeader title="审计日志" description="查看登录、账号、卡号和金额等重要操作记录" /><div className="panel overflow-hidden">{query.data?.items.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>时间</th><th>操作账号</th><th>操作</th><th>资源</th><th>IP 地址</th><th>详情</th></tr></thead><tbody>{query.data.items.map((item) => <tr key={item.id}><td className="whitespace-nowrap">{dateTime(item.created_at)}</td><td className="font-mono">{item.username}</td><td><span className="badge bg-wheat-100 text-wheat-800">{actionLabel(item.action)}</span></td><td><div>{item.resource_type}</div><div className="mt-1 max-w-34 truncate font-mono text-xs text-black/35">{item.resource_id ?? "—"}</div></td><td className="font-mono text-xs">{item.ip ?? "—"}</td><td className="max-w-75 truncate text-xs text-black/45" title={item.details ?? ""}>{item.details ?? "—"}</td></tr>)}</tbody></table></div> : <Empty text="暂无审计日志" />}<Pagination page={page} totalPages={query.data?.totalPages ?? 0} onChange={setPage} /></div></>;
}
