const MARKET_STATUS = [
  { label: "국내 장 닫힘", isOpen: false },
  { label: "해외 장 닫힘", isOpen: false },
];

export default function MarketStatusBar() {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-5">
        {MARKET_STATUS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${item.isOpen ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm font-medium text-gray-900">{item.label}</span>
          </div>
        ))}
      </div>

      <button className="flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600">
        <SparkleIcon />
        호반꿀 AI 소개
      </button>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />
    </svg>
  );
}
