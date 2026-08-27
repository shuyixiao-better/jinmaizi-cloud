export type Role = "SUPER_ADMIN" | "SUB_ACCOUNT";
export interface User { id: string; username: string; displayName: string; role: Role; status: "ACTIVE" | "DISABLED" }
interface ApiSuccess<T> { success: true; data: T }
interface ApiFailure { success: false; message: string }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || !payload.success) {
    throw new ApiError("message" in payload ? payload.message : "操作失败，请稍后重试", response.status);
  }
  return payload.data;
}

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface PageData<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
