export default function NoticeBanner() {
  return (
    <div className="flex h-10 w-full items-center justify-between bg-[#FDECEC] px-6">
      <div className="flex items-center gap-2">
        <MegaphoneIcon />
        <span className="text-sm text-gray-900">
          2026년 9월 13일부로 트레이더별 누적 승률을 기록했습니다.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700">
          자세히 보기
        </button>
        <button aria-label="닫기" className="text-gray-500 hover:text-gray-700">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-red-400"
      aria-hidden="true"
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3 5V4l-3 5H5a2 2 0 0 0-2 2z" />
      <path d="M13 8a4 4 0 0 1 0 8" />
      <path d="M16 5a8 8 0 0 1 0 14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
