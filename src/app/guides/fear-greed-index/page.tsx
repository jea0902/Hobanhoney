import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "공포탐욕지수 읽는 법 | 호반꿀",
  description: "코인 공포탐욕지수 계산 방법과 해석.",
};

export default function FearGreedGuide() {
  return (
    <ContentPage title="공포탐욕지수 읽는 법" updatedAt="2026년 9월 30일">
      <h2>개요</h2>
      <p>
        시장 심리를 0~100 숫자로 나타낸 지표임. 0에 가까우면 극단적 공포, 100에 가까우면 극단적
        탐욕. 호반꿀은 alternative.me가 매일 발표하는 코인 지수를 표시함.
      </p>

      <h2>계산 요소</h2>
      <ul>
        <li>변동성 — 평소보다 크게 흔들리면 공포</li>
        <li>거래량·상승 모멘텀 — 거래량이 늘면서 오르면 탐욕</li>
        <li>소셜 미디어 반응 — 코인 관련 언급이 많으면 탐욕</li>
        <li>비트코인 도미넌스 — 비트코인 비중이 커지면 공포, 알트코인 비중이 커지면 탐욕</li>
        <li>검색 트렌드</li>
      </ul>

      <h2>해석 방법</h2>
      <ul>
        <li>
          <strong>극단적 공포</strong> — 바닥 근처인 경우가 많았으나, 몇 주씩 더 하락하기도 함.
        </li>
        <li>
          <strong>극단적 탐욕</strong> — 과열 구간. 강한 상승장에서는 오래 유지되기도 함.
        </li>
      </ul>
      <p>
        현재 심리를 보여줄 뿐 방향이 바뀌는 시점은 알려주지 않음. 하루 한 번 발표되므로 하루 중
        급등락도 반영되지 않음.
      </p>
    </ContentPage>
  );
}
