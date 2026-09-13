const MENU_ITEMS = ["홈", "피드", "커뮤니티"];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-gray-200 bg-white">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="text-lg font-bold text-gray-900">호반꿀</span>
          </div>
          <nav className="flex items-center gap-6">
            {MENU_ITEMS.map((label) => (
              <a
                key={label}
                href="#"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex w-72 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
            <SearchIcon />
            <input
              type="text"
              placeholder="/를 눌러 검색하세요"
              readOnly
              className="w-full bg-transparent text-sm text-gray-400 outline-none placeholder:text-gray-400"
            />
          </div>
          <button className="rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white">
            로그인
          </button>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#F59E0B" />
      {/* 꿀단지 + 꿀 한 방울 */}
      <circle cx="14" cy="7.5" r="1.4" fill="white" />
      <rect x="9" y="10.5" width="10" height="2.2" rx="1.1" fill="white" />
      <path
        d="M9.5 14.2c0-.6.5-1 1-1h7c.5 0 1 .4 1 1v5.8c0 1.4-1.1 2.5-2.5 2.5h-4c-1.4 0-2.5-1.1-2.5-2.5z"
        fill="white"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
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
