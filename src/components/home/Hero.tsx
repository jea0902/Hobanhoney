export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-20">
      <DecorativeOrb />

      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-800 dark:text-gray-300">
            인간지표 추적 사이트
          </p>
          <h1 className="mt-3 text-2xl font-extrabold leading-[1.15] tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
            인간지표 트레이더들의
            <br />
            실시간 포지션 추적
          </h1>
        </div>
      </div>
    </section>
  );
}

function DecorativeOrb() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -top-28 h-[26rem] w-[26rem] sm:-right-8"
    >
      {/* 궤도 링 */}
      <div className="absolute inset-0 rotate-[-20deg] rounded-full border border-blue-200/70" />
      {/* 유리구슬 */}
      <div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-[1px]"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(219,234,254,0.85) 35%, rgba(147,197,253,0.55) 65%, rgba(191,219,254,0.15) 100%)",
        }}
      />
      {/* 작은 위성 점 */}
      <span className="absolute right-6 top-16 h-3 w-3 rounded-full bg-blue-300/80" />
      {/* 전체 후광 블러 */}
      <div className="absolute inset-0 -z-10 rounded-full bg-blue-100 opacity-60 blur-3xl" />
    </div>
  );
}
