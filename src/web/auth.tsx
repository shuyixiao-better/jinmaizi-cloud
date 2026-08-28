import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type PropsWithChildren } from "react";
import { api, ApiError, type User } from "./lib/api";
import { LoadingPage } from "./components/ui";

interface AuthValue { user: User | null; refresh: () => Promise<unknown>; clear: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<{ user: User }>("/api/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  if (query.isLoading) return <LoadingPage />;
  const clear = async () => {
    await client.cancelQueries();
    client.removeQueries({ predicate: (item) => item.queryKey[0] !== "me" });
    client.setQueryData(["me"], null);
  };
  return <AuthContext.Provider value={{ user: query.data?.user ?? null, refresh: () => client.invalidateQueries({ queryKey: ["me"] }), clear }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
