import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./components/layout";
import { AccountSummaryPage } from "./pages/account-summary";
import { AdminCardsPage } from "./pages/admin-cards";
import { AdminTransactionsPage } from "./pages/admin-transactions";
import { AdminUsersPage } from "./pages/admin-users";
import { AuditLogsPage } from "./pages/audit-logs";
import { CardQueryPage } from "./pages/card-query";
import { DashboardPage } from "./pages/dashboard";
import { LoginPage } from "./pages/login";
import { MyTransactionsPage } from "./pages/my-transactions";
import { ProfilePage } from "./pages/profile";

function ProtectedLayout() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === "SUPER_ADMIN" ? children : <Navigate to="/" replace />;
}
function SubAccountOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === "SUB_ACCOUNT" ? children : <Navigate to="/" replace />;
}

export function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedLayout />}><Route index element={<DashboardPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="cards/query" element={<SubAccountOnly><CardQueryPage /></SubAccountOnly>} /><Route path="my/transactions" element={<SubAccountOnly><MyTransactionsPage /></SubAccountOnly>} /><Route path="admin/cards" element={<AdminOnly><AdminCardsPage /></AdminOnly>} /><Route path="admin/users" element={<AdminOnly><AdminUsersPage /></AdminOnly>} /><Route path="admin/transactions" element={<AdminOnly><AdminTransactionsPage /></AdminOnly>} /><Route path="admin/summary" element={<AdminOnly><AccountSummaryPage /></AdminOnly>} /><Route path="admin/audit" element={<AdminOnly><AuditLogsPage /></AdminOnly>} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
