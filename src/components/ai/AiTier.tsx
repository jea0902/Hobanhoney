// AI 트레이더 티어: 올해 수익률 순위로 매긴다 (리그 오브 레전드 랭크 티어를 벤치마킹, 사용자 요청).
// 게임의 실제 엠블럼 이미지는 저작권이 있어서 쓰지 않고, 티어별 색·모양만 참고해 SVG로 직접 그린다.

export interface Tier {
  key: string;
  name: string;
  light: string; // 그라데이션 밝은 쪽
  dark: string; // 그라데이션 어두운 쪽·테두리
  wings: boolean; // 마스터 이상은 날개
  crown: boolean; // 챌린저만 왕관
}

const T = {
  challenger: {
    key: "challenger",
    name: "챌린저",
    light: "#FDE68A",
    dark: "#38BDF8",
    wings: true,
    crown: true,
  },
  grandmaster: {
    key: "grandmaster",
    name: "그랜드마스터",
    light: "#FCA5A5",
    dark: "#B91C1C",
    wings: true,
    crown: false,
  },
  master: {
    key: "master",
    name: "마스터",
    light: "#E9D5FF",
    dark: "#7E22CE",
    wings: true,
    crown: false,
  },
  diamond: {
    key: "diamond",
    name: "다이아",
    light: "#BFDBFE",
    dark: "#2563EB",
    wings: false,
    crown: false,
  },
  emerald: {
    key: "emerald",
    name: "에메랄드",
    light: "#A7F3D0",
    dark: "#047857",
    wings: false,
    crown: false,
  },
  platinum: {
    key: "platinum",
    name: "플래티넘",
    light: "#CCFBF1",
    dark: "#0F766E",
    wings: false,
    crown: false,
  },
  gold: {
    key: "gold",
    name: "골드",
    light: "#FEF3C7",
    dark: "#B45309",
    wings: false,
    crown: false,
  },
  silver: {
    key: "silver",
    name: "실버",
    light: "#F3F4F6",
    dark: "#6B7280",
    wings: false,
    crown: false,
  },
  bronze: {
    key: "bronze",
    name: "브론즈",
    light: "#FED7AA",
    dark: "#9A3412",
    wings: false,
    crown: false,
  },
} satisfies Record<string, Tier>;

// AI가 7명이면 그랜드마스터·에메랄드를 빼고 7단계로 (사용자 결정). 9명 이상이면 9단계 전부.
const SEVEN: Tier[] = [T.challenger, T.master, T.diamond, T.platinum, T.gold, T.silver, T.bronze];
// 8명이면 7단계에 에메랄드를 다시 넣는다 (AI 마틴 추가로 8명, 같은 티어가 둘 생기지 않게).
const EIGHT: Tier[] = [
  T.challenger,
  T.master,
  T.diamond,
  T.emerald,
  T.platinum,
  T.gold,
  T.silver,
  T.bronze,
];
const NINE: Tier[] = [
  T.challenger,
  T.grandmaster,
  T.master,
  T.diamond,
  T.emerald,
  T.platinum,
  T.gold,
  T.silver,
  T.bronze,
];

// 올해 수익률이 높은 순으로 티어를 준다. 수익률이 아직 없는 AI는 맨 뒤.
export function assignTiers(items: { id: string; annualReturn: number | null }[]) {
  const ladder = items.length >= NINE.length ? NINE : items.length === EIGHT.length ? EIGHT : SEVEN;
  const ranked = [...items].sort(
    (a, b) => (b.annualReturn ?? -Infinity) - (a.annualReturn ?? -Infinity),
  );
  return new Map(ranked.map((item, i) => [item.id, ladder[Math.min(i, ladder.length - 1)]]));
}

const SIZES = { lg: 64, md: 52, sm: 44 };

export function TierEmblem({ tier, size = "sm" }: { tier: Tier; size?: keyof typeof SIZES }) {
  const px = SIZES[size];
  const id = `tier-${tier.key}`;
  return (
    <span className="flex shrink-0 flex-col items-center" title={`${tier.name} 티어`}>
      <svg width={px} height={px} viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tier.light} />
            <stop offset="100%" stopColor={tier.dark} />
          </linearGradient>
          <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor={tier.light} />
          </linearGradient>
        </defs>
        {tier.wings && (
          <g fill={`url(#${id}-body)`} stroke={tier.dark} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M14 20 L2 14 L6 26 L1 32 L9 36 L12 44 Z" />
            <path d="M50 20 L62 14 L58 26 L63 32 L55 36 L52 44 Z" />
          </g>
        )}
        {tier.crown && (
          <path
            d="M22 10 L25 2 L29 8 L32 0 L35 8 L39 2 L42 10 Z"
            fill="#FACC15"
            stroke="#B45309"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        )}
        {/* 방패 몸체 */}
        <path
          d="M32 8 L52 16 L52 36 Q52 50 32 60 Q12 50 12 36 L12 16 Z"
          fill={`url(#${id}-body)`}
          stroke={tier.dark}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* 가운데 보석 */}
        <path
          d="M32 20 L42 32 L32 48 L22 32 Z"
          fill={`url(#${id}-gem)`}
          stroke={tier.dark}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M22 32 L42 32 M32 20 L32 48" stroke={tier.dark} strokeOpacity="0.35" />
      </svg>
      <span className="mt-0.5 text-[10px] font-bold leading-none" style={{ color: tier.dark }}>
        {tier.name}
      </span>
    </span>
  );
}
