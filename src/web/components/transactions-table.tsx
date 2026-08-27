import { dateTime, money } from "../lib/format";
import { Empty, TypeBadge } from "./ui";

export interface Transaction {
  id: string; request_id: string; card_no: string; operator_username?: string;
  transaction_type: string; amount_cents: number; remark: string; created_at: string;
}

export function TransactionsTable({ items, showOperator = false }: { items: Transaction[]; showOperator?: boolean }) {
  if (!items.length) return <Empty text="还没有交易记录" />;
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>时间</th><th>交易单号</th><th>卡号</th>{showOperator && <th>操作账号</th>}<th>类型</th><th className="text-right!">金额</th><th>备注</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="whitespace-nowrap">{dateTime(item.created_at)}</td><td className="max-w-38 truncate font-mono text-xs text-black/40" title={item.request_id}>{item.request_id}</td><td className="font-semibold">{item.card_no}</td>{showOperator && <td>{item.operator_username}</td>}<td><TypeBadge type={item.transaction_type} /></td><td className={`text-right! font-semibold tabular-nums ${item.transaction_type === "DECREASE" ? "text-red-600!" : "text-emerald-700!"}`}>{item.transaction_type === "DECREASE" ? "-" : "+"}{money(item.amount_cents)}</td><td className="max-w-60 truncate" title={item.remark}>{item.remark || "—"}</td></tr>)}</tbody></table></div>;
}
