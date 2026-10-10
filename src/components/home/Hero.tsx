import ContrarianSignal from "@/components/home/ContrarianSignal";
import BtcLivePrice from "@/components/home/BtcLivePrice";

export default function Hero() {
  return (
    <section className="px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 xl:max-w-none">
        {/* 모바일은 공간이 좁아서 가격을 제목 아래로, PC는 제목 오른쪽에 둔다. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-10">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-800 dark:text-gray-300">
              인간지표 추적 사이트
            </p>
            <h1 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
              인간지표 트레이더들의
              <br />
              실시간 포지션 추적
            </h1>
          </div>
          <BtcLivePrice />
        </div>

        <ContrarianSignal />
      </div>
    </section>
  );
}
