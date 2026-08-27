export type Role = "SUPER_ADMIN" | "SUB_ACCOUNT";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  sessionVersion: number;
}

export type AppBindings = Env;
export type AppVariables = { user: AuthUser; sessionTokenHash: string };

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: Role;
  status: UserStatus;
  session_version: number;
  created_at: string;
  last_login_at: string | null;
}

export interface CardRow {
  id: string;
  card_no: string;
  balance_cents: number;
  status: "ACTIVE" | "DISABLED";
  remark: string;
  created_at: string;
  updated_at: string;
}
