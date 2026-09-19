import Link from "next/link";

export default function Navbar({ active = "home" }: { active?: "home" | "rankers" }) {
  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
          <img src="/logo.png" alt="호반꿀" className="h-12 w-12 object-contain" />
          <span className="text-lg font-bold text-gray-900">호반꿀</span>
        </div>

        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className={
              active === "home"
                ? "border-b-2 border-gray-900 text-sm font-semibold text-gray-900"
                : "text-sm font-medium text-gray-500 hover:text-gray-900"
            }
          >
            홈
          </Link>
          <Link
            href="/rankers"
            className={
              active === "rankers"
                ? "border-b-2 border-gray-900 text-sm font-semibold text-gray-900"
                : "text-sm font-medium text-gray-500 hover:text-gray-900"
            }
          >
            랭커 포지션
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            실시간
          </span>
          <SearchIcon />
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-gray-400"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
