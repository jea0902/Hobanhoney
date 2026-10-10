import Link from "next/link";
import { getOnlineCount } from "@/lib/presence";
import ThemeToggle from "@/components/ThemeToggle";

const TABS = [
  { key: "home", label: "홈", href: "/" },
  { key: "rankers", label: "랭커", href: "/rankers" },
  { key: "ai", label: "AI", href: "/ai" },
] as const;

// 네이버 증권처럼 화면 전체 폭에 탭을 두고, 선택된 탭은 굵은 밑줄로 표시한다.
// active를 안 넘기면(소개·가이드·운영자 페이지 등) 어떤 탭도 선택 표시하지 않는다.
export default async function Navbar({ active }: { active?: (typeof TABS)[number]["key"] }) {
  const onlineCount = await getOnlineCount();

  return (
    <header className="sticky top-0 z-20 h-14 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex h-full items-center gap-4 sm:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
            <img src="/logo.png" alt="호반꿀" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
            <span className="text-base font-extrabold text-gray-900 dark:text-gray-100 sm:text-xl">
              호반꿀
            </span>
          </Link>

          <nav className="flex h-full items-center gap-4 sm:gap-7">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex h-full items-center border-b-[3px] text-sm sm:text-lg ${
                  active === tab.key
                    ? "border-gray-900 font-bold text-gray-900 dark:border-gray-100 dark:text-gray-100"
                    : "border-transparent font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {onlineCount}명 접속 중
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
