import { logout } from "../actions";
import AdminSidebar from "./AdminSidebar";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F6F8] dark:bg-gray-950">
      <AdminSidebar logoutAction={logout} />

      <main className="min-w-0 flex-1 p-6 pt-16 sm:p-8">{children}</main>
    </div>
  );
}
