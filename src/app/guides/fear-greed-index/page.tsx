import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "공포탐욕지수 읽는 법 | 호반꿀",
  description: "코인 공포탐욕지수 계산 방법과 해석.",
};

export default function FearGreedGuide() {
  return (
    <ContentPage title="공포탐욕지수 읽는 법" updatedAt="2026년 9월 30일">
      <h2>뭐야?</h2>
      <p>
        시장 심리를 0~100 숫자로 나타낸 지표야. 0에 가까우면 극단적 공포, 100에 가까우면 극단적
        탐욕. 호반꿀은 alternative.me가 매일 발표하는 코인 지수를 보여줘.
      </p>

      <h2>뭘로 계산해?</h2>
      <ul>
        <li>변동성 — 평소보다 크게 흔들리면 공포</li>
        <li>거래량·상승 모멘텀 — 거래량 붙으면서 오르면 탐욕</li>
        <li>소셜 미디어 반응 — 코인 얘기가 뜨거우면 탐욕</li>
        <li>비트코인 도미넌스 — 비트 비중이 커지면 공포, 알트 비중이 커지면 탐욕</li>
        <li>검색 트렌드</li>
      </ul>

      <h2>어떻게 읽어?</h2>
      <ul>
        <li>
          <strong>극단적 공포</strong> — 바닥 근처인 경우가 많았지만, 몇 주씩 더 빠지기도 해.
        </li>
        <li>
          <strong>극단적 탐욕</strong> — 과열 구간. 강한 상승장에선 오래 유지되기도 해.
        </li>
      </ul>
      <p>
        지금 심리를 보여줄 뿐 언제 방향이 바뀔지는 안 알려줘. 하루 한 번 발표라 하루 안의 급등락도
        반영 안 돼.
      </p>
    </ContentPage>
  );
}
