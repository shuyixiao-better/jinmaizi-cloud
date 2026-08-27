import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

export function Spinner() { return <LoaderCircle className="size-5 animate-spin" />; }
export function LoadingPage() { return <div className="flex min-h-80 items-center justify-center text-black/35"><Spinner /></div>; }
export function Empty({ text = "暂无数据" }: { text?: string }) { return <div className="py-14 text-center text-sm text-black/40">{text}</div>; }
export function StatusBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-black/45"}`}>{active ? "正常" : "已禁用"}</span>;
}
export function TypeBadge({ type }: { type: string }) {
  const style = type === "INCREASE" ? "bg-emerald-50 text-emerald-700" : type === "DECREASE" ? "bg-red-50 text-red-700" : "bg-wheat-100 text-wheat-800";
  const text = type === "INCREASE" ? "增加" : type === "DECREASE" ? "扣减" : "初始";
  return <span className={`badge ${style}`}>{text}</span>;
}
export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1.5 text-sm text-black/45">{description}</p></div>{action}</div>;
}
export function Modal({ open, title, children, onClose }: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button aria-label="关闭" onClick={onClose} className="rounded-lg p-1.5 text-black/40 hover:bg-black/5"><X className="size-5" /></button></div>
      {children}
    </div>
  </div>;
}
export function Message({ type, children }: PropsWithChildren<{ type: "error" | "success" }>) {
  const Icon = type === "error" ? AlertCircle : CheckCircle2;
  return <div className={`flex gap-2 rounded-xl p-3 text-sm ${type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}><Icon className="mt-0.5 size-4 shrink-0" />{children}</div>;
}
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4 text-sm"><span className="mr-2 text-black/40">第 {page} / {totalPages} 页</span><button className="btn-secondary !size-9 !p-0" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="size-4" /></button><button className="btn-secondary !size-9 !p-0" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight className="size-4" /></button></div>;
}
