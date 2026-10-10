import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "인간지표란? | 호반꿀",
  description: "인간지표의 뜻, 호반꿀 승패 기준, 승률 읽을 때 주의할 점.",
};

export default function HumanIndicatorGuide() {
  return (
    <ContentPage title="인간지표란?" updatedAt="2026년 9월 30일">
      <h2>뜻</h2>
      <p>
        &quot;저 사람이 사면 떨어지고 팔면 오른다&quot;는 농담에서 나온 말임. 매매가 자주 틀려서
        반대로 하면 맞는다는 뜻으로 사용함. 반대로 따라 하면 되는 사람은 정지표라고 부름.
      </p>

      <h2>기록으로 봐야 하는 이유</h2>
      <p>
        사람은 크게 손실 본 장면만 오래 기억해서 체감 승률과 실제 승률이 크게 다름. 그래서 호반꿀은
        포지션을 잡은 순간부터 종료까지 기록하고 결과로 승패를 매김.
      </p>

      <h2>승패 기준</h2>
      <p>
        종료 수익률(레버리지 포함) +3% 이상은 승, -3% 이하는 패, 그 사이는 무승부. 승률은 승 ÷ (승 +
        패)로 계산하며 무승부는 제외함.
      </p>

      <h2>승률을 볼 때 주의할 점</h2>
      <ul>
        <li>
          <strong>건수를 먼저 확인.</strong> 5건뿐인 승률 20%는 우연일 수 있음.
        </li>
        <li>
          <strong>승률이 낮아도 수익은 날 수 있음.</strong> 이길 때 크게, 질 때 작게 잃으면 수익임.
        </li>
        <li>
          <strong>롱·숏 비율도 확인.</strong> 롱만 잡는 사람의 승률은 그 기간 시장이 올랐는지에 따라
          달라질 수 있음.
        </li>
      </ul>

      <h2>반대로 매매하면 되는가</h2>
      <p>
        그렇지 않음. 기록은 방송 화면 기준이라 실제 체결과 차이가 있고, 과거 승률이 앞으로도
        이어진다는 보장도 없음. <Link href="/guides/fear-greed-index">공포탐욕지수</Link> 같은
        지표와 함께 참고용으로만 활용 바람.
      </p>
    </ContentPage>
  );
}
