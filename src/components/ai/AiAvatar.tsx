// AI 트레이더는 사진이 없어서 그라데이션 원 안에 상징 글자 하나로 구분한다.
// Tailwind가 클래스를 찾을 수 있게 색은 전부 문자열 그대로 적는다.
const AVATARS: Record<string, { glyph: string; gradient: string }> = {
  wonyotti: { glyph: "워", gradient: "from-amber-400 to-orange-600" },
  hobanhoney: { glyph: "꿀", gradient: "from-yellow-300 to-amber-500" },
  wallstreet: { glyph: "월", gradient: "from-sky-400 to-indigo-600" },
  korean_ant: { glyph: "개", gradient: "from-rose-400 to-red-600" },
  fear_greed: { glyph: "공", gradient: "from-emerald-400 to-teal-600" },
  buffett: { glyph: "핏", gradient: "from-indigo-400 to-violet-600" },
  burry: { glyph: "리", gradient: "from-slate-500 to-gray-800" },
};

const SIZES = {
  lg: "h-16 w-16 text-3xl",
  md: "h-12 w-12 text-2xl",
  sm: "h-10 w-10 text-lg",
};

export default function AiAvatar({ id, size = "sm" }: { id: string; size?: keyof typeof SIZES }) {
  const avatar = AVATARS[id] ?? { glyph: "AI", gradient: "from-indigo-400 to-indigo-600" };
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-black text-white shadow-sm ${avatar.gradient} ${SIZES[size]}`}
      aria-hidden
    >
      {avatar.glyph}
    </span>
  );
}
