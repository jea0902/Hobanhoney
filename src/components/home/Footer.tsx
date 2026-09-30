import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "사이트 소개" },
  { href: "/guides", label: "가이드" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/contact", label: "문의" },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-6 dark:border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-gray-400">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-start">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-center leading-5 sm:text-left">
          호반꿀의 모든 정보는 기록과 재미를 위한 것이며 투자 권유가 아닙니다. 표시되는 포지션과
          승률은 수동 입력·방송 화면 인식 과정에서 실제와 다를 수 있고, 투자 판단과 그 결과에 대한
          책임은 본인에게 있습니다.
        </p>
        <div className="flex flex-col items-center justify-between gap-1 sm:flex-row">
          <span>Hoban-Honey / 인간지표</span>
          <span>REAL TRADERS · REAL POSITIONS · REAL INDICATORS</span>
        </div>
      </div>
    </footer>
  );
}
