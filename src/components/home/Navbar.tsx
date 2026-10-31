import Link from "next/link";

const TABS = [
  { key: "home", label: "홈", href: "/" },
  { key: "rankers", label: "랭커", href: "/rankers" },
  { key: "ai", label: "AI", href: "/ai" },
  { key: "mm", label: "MM 펌핑 추적", href: "/mm" },
] as const;

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
      <img src="/logo.png" alt="호반꿀" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
      <span className="text-base font-extrabold text-gray-900 dark:text-gray-100 sm:text-xl">
        호반꿀
      </span>
    </Link>
  );
}

// PC(lg 이상)는 왼쪽 고정 사이드바, 그보다 좁으면 위에는 로고만, 아래에는 고정 탭바.
// 사이드바가 폭 w-56을, 탭바가 높이 h-14를 차지하므로 Navbar를 쓰는 페이지는 맨 바깥 div에
// `pb-14 lg:pl-56 lg:pb-0`을 줘야 한다.
// active를 안 넘기면(운영자·트레이더 페이지 등) 어떤 메뉴도 선택 표시하지 않는다.
export default function Navbar({ active }: { active?: (typeof TABS)[number]["key"] }) {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 w-full items-center border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950 sm:px-6 lg:hidden">
        <Logo />
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-14 border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:hidden">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex flex-1 items-center justify-center whitespace-nowrap text-xs ${
              active === tab.key
                ? "font-bold text-gray-900 dark:text-gray-100"
                : "font-medium text-gray-500 dark:text-gray-400"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:flex">
        <div className="flex h-14 items-center px-5">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-lg px-3 py-2.5 text-base ${
                active === tab.key
                  ? "bg-gray-100 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
