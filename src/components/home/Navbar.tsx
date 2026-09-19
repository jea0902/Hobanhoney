import Link from "next/link";
import { getOnlineCount } from "@/lib/presence";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Navbar({
  active = "home",
}: {
  active?: "home" | "rankers" | "founder";
}) {
  const onlineCount = await getOnlineCount();

  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
          <img src="/logo.png" alt="호반꿀" className="h-9 w-9 object-contain sm:h-12 sm:w-12" />
          <span className="text-base font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
            호반꿀
          </span>
        </div>

        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/"
            className={
              active === "home"
                ? "border-b-2 border-gray-900 text-xs font-semibold text-gray-900 dark:border-gray-100 dark:text-gray-100 sm:text-sm"
                : "text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 sm:text-sm"
            }
          >
            홈
          </Link>
          <Link
            href="/rankers"
            className={
              active === "rankers"
                ? "border-b-2 border-gray-900 text-xs font-semibold text-gray-900 dark:border-gray-100 dark:text-gray-100 sm:text-sm"
                : "text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 sm:text-sm"
            }
          >
            랭커 포지션
          </Link>
          <Link
            href="/founder"
            className={
              active === "founder"
                ? "border-b-2 border-gray-900 text-xs font-semibold text-gray-900 dark:border-gray-100 dark:text-gray-100 sm:text-sm"
                : "text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 sm:text-sm"
            }
          >
            운영자 포지션
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {onlineCount}명 접속 중
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
