import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type PropsWithChildren } from "react";
import { api, type User } from "./lib/api";
import { LoadingPage } from "./components/ui";

interface AuthValue { user: User | null; refresh: () => Promise<unknown> }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["me"], queryFn: () => api<{ user: User }>("/api/auth/me"), retry: false, staleTime: 60_000 });
  if (query.isLoading) return <LoadingPage />;
  return <AuthContext.Provider value={{ user: query.data?.user ?? null, refresh: () => client.invalidateQueries({ queryKey: ["me"] }) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
