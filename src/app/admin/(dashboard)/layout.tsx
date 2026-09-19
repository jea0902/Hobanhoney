import Link from "next/link";
import { logout } from "../actions";

const NAV_ITEMS = [
  { href: "/admin", label: "유튜버 포지션" },
  { href: "/admin/rankers", label: "랭커" },
  { href: "/admin/logs", label: "로그" },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F6F8]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 px-2 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
          <img src="/logo.png" alt="호반꿀" className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold text-gray-900">호반꿀 관리자</span>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            로그아웃
          </button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
