import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CreditCard, Search, ShieldCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { api, json } from "../lib/api";
import { money, yuanToCents } from "../lib/format";
import { Message, Modal, PageHeader, Spinner, StatusBadge } from "../components/ui";

interface Card { id: string; cardNo: string; balanceCents: number; status: "ACTIVE" | "DISABLED" }
interface OperationResult { transactionId: string; balanceCents: number; idempotent: boolean }

export function CardQueryPage() {
  const client = useQueryClient();
  const [cardNo, setCardNo] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [operation, setOperation] = useState<"increase" | "decrease" | null>(null);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [confirming, setConfirming] = useState(false);
  const requestIdRef = useRef("");
  const cents = yuanToCents(amount);
  const nextBalance = card && cents ? card.balanceCents + (operation === "increase" ? cents : -cents) : card?.balanceCents ?? 0;
  const queryCard = async (event: FormEvent) => { event.preventDefault(); setError(""); setSearching(true); setCard(null); try { setCard(await api<Card>(`/api/cards/query?cardNo=${encodeURIComponent(cardNo.trim())}`)); } catch (err) { setError(err instanceof Error ? err.message : "查询失败"); } finally { setSearching(false); } };
  const mutation = useMutation({
    mutationFn: (_submission: { requestId: string }) => {
      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
      return api<OperationResult>(`/api/cards/${card?.id}/${operation}`, json("POST", { requestId: requestIdRef.current, amountCents: cents, remark }));
    },
    onSuccess: async (result) => { setCard((value) => value ? { ...value, balanceCents: result.balanceCents } : value); setOperation(null); setConfirming(false); requestIdRef.current = ""; setAmount(""); setRemark(""); await client.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const close = () => { if (!mutation.isPending) { setOperation(null); setConfirming(false); requestIdRef.current = ""; setAmount(""); setRemark(""); mutation.reset(); } };
  return <><PageHeader title="卡号查询" description="必须输入完整卡号，不支持模糊查询或浏览全部卡号" /><div className="panel p-5 sm:p-7"><form onSubmit={queryCard} className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row"><div className="relative flex-1"><CreditCard className="absolute left-3.5 top-3.5 size-4 text-black/30" /><input className="input pl-10 font-mono uppercase" value={cardNo} onChange={(e) => setCardNo(e.target.value)} placeholder="请输入完整卡号，例如 JM00001" /></div><button className="btn-primary !h-11 px-6" disabled={searching || cardNo.trim().length < 3}>{searching ? <Spinner /> : <><Search className="size-4" />查询</>}</button></form>{error && <div className="mx-auto mt-5 max-w-2xl"><Message type="error">{error}</Message></div>}</div>
    {card && <div className="panel relative mt-6 overflow-hidden"><div className="absolute right-0 top-0 h-full w-1 bg-wheat-400" /><div className="grid gap-7 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:p-8"><div><p className="text-xs font-medium tracking-wide text-black/40">卡号</p><p className="mt-2 font-mono text-xl font-bold tracking-wide">{card.cardNo}</p></div><div><p className="text-xs font-medium tracking-wide text-black/40">当前余额</p><p className="mt-2 text-3xl font-bold tabular-nums">{money(card.balanceCents)}</p></div><div className="sm:text-right"><p className="mb-2 text-xs text-black/40">状态</p><StatusBadge active={card.status === "ACTIVE"} /></div></div><div className="flex flex-col gap-3 border-t border-black/5 bg-[#fafaf8] p-5 sm:flex-row sm:justify-end"><button className="btn-secondary !border-emerald-200 !text-emerald-700" disabled={card.status !== "ACTIVE"} onClick={() => setOperation("increase")}><ArrowUp className="size-4" />增加金额</button><button className="btn-secondary !border-red-200 !text-red-700" disabled={card.status !== "ACTIVE"} onClick={() => setOperation("decrease")}><ArrowDown className="size-4" />扣减金额</button></div></div>}
    <Modal open={operation !== null} title={operation === "increase" ? "增加金额" : "扣减金额"} onClose={close}>
      {!confirming ? <form onSubmit={(e) => { e.preventDefault(); if (cents && (operation === "increase" || cents <= (card?.balanceCents ?? 0))) setConfirming(true); }} className="space-y-4"><div className="rounded-xl bg-[#f7f6f2] p-4"><p className="text-xs text-black/40">当前余额</p><p className="mt-1 text-xl font-bold">{money(card?.balanceCents ?? 0)}</p></div><div><label className="label">{operation === "increase" ? "增加" : "扣减"}金额（元）</label><input autoFocus inputMode="decimal" className="input text-lg font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />{amount && !cents && <p className="mt-1.5 text-xs text-red-600">请输入大于 0 且最多两位小数的有效金额</p>}{operation === "decrease" && cents && card && cents > card.balanceCents && <p className="mt-1.5 text-xs text-red-600">余额不足，无法完成扣减</p>}</div><div><label className="label">备注（选填）</label><textarea className="input !h-23 py-3" maxLength={500} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="例如：客户充值、订单退款、业务扣减" /></div><div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={close}>取消</button><button className="btn-primary" disabled={!cents || (operation === "decrease" && cents > (card?.balanceCents ?? 0))}>下一步确认</button></div></form> : <div className="space-y-5"><div className="flex gap-3 rounded-xl bg-wheat-50 p-4 text-sm text-wheat-900"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>请仔细核对金额。确认后系统将立即写入不可修改的交易流水。</p></div><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt className="text-black/45">当前余额</dt><dd className="font-semibold">{money(card?.balanceCents ?? 0)}</dd></div><div className="flex justify-between"><dt className="text-black/45">{operation === "increase" ? "增加金额" : "扣减金额"}</dt><dd className={operation === "increase" ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>{operation === "increase" ? "+" : "-"}{money(cents ?? 0)}</dd></div><div className="flex justify-between border-t border-black/6 pt-3"><dt className="font-medium">操作后余额</dt><dd className="text-lg font-bold">{money(nextBalance)}</dd></div></dl>{mutation.error && <Message type="error">{mutation.error.message}</Message>}<div className="flex justify-end gap-3"><button className="btn-secondary" disabled={mutation.isPending} onClick={() => setConfirming(false)}>返回修改</button><button className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate({ requestId: crypto.randomUUID() })}>{mutation.isPending ? <Spinner /> : `确认${operation === "increase" ? "增加" : "扣减"}`}</button></div></div>}
    </Modal></>;
}
