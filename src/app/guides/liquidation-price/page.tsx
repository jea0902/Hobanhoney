import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "강제청산가 보는 법 — 격리와 교차 마진의 차이 | 호반꿀",
  description:
    "선물 거래에서 강제청산가가 정해지는 원리, 레버리지와의 관계, 격리 마진과 교차 마진에서 청산이 일어나는 방식을 설명합니다.",
};

export default function LiquidationPriceGuide() {
  return (
    <ContentPage title="강제청산가 보는 법 — 격리와 교차 마진의 차이" updatedAt="2026년 9월 30일">
      <h2>강제청산이란?</h2>
      <p>
        코인 선물 거래에서는 가진 돈(증거금)보다 큰 규모로 포지션을 잡을 수 있습니다. 이게
        레버리지입니다. 대신 가격이 반대로 움직여 손실이 증거금에 가까워지면, 거래소는 더 큰 손실이
        나기 전에 포지션을 강제로 정리합니다. 이것을 <strong>강제청산</strong>이라고 하고,
        강제청산이 일어나는 가격을 <strong>강제청산가</strong>라고 합니다.
      </p>
      <p>
        대부분의 거래소는 순간적인 가격 왜곡으로 청산되는 것을 막기 위해, 실제 체결가가 아니라 여러
        거래소 가격을 반영한 <strong>마크 가격</strong>이 강제청산가에 닿을 때 청산합니다. 호반꿀에
        표시되는 현재가도 Bybit의 마크 가격입니다.
      </p>

      <h2>레버리지와 강제청산가의 관계</h2>
      <p>
        레버리지가 높을수록 적은 가격 변동에도 증거금이 바닥나기 때문에 강제청산가가 진입가에
        가까워집니다. 거래소마다 계산식이 조금씩 다르지만, 격리 마진 기준으로 대략 이렇게 생각하면
        됩니다.
      </p>
      <ul>
        <li>
          <strong>롱</strong>: 강제청산가 ≈ 진입가 × (1 − 1/레버리지 + 유지증거금률)
        </li>
        <li>
          <strong>숏</strong>: 강제청산가 ≈ 진입가 × (1 + 1/레버리지 − 유지증거금률)
        </li>
      </ul>
      <p>
        유지증거금률은 포지션을 유지하는 데 최소한으로 필요한 증거금 비율로, 보통 0.5% 안팎입니다.
        예를 들어 비트코인을 100,000달러에 <strong>10배 롱</strong>으로 잡으면 강제청산가는 약
        90,500달러, 즉 진입가보다 약 9.5% 아래입니다. 같은 포지션을 <strong>50배</strong>로 잡으면
        약 98,500달러로, 1.5%만 떨어져도 청산됩니다.
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 text-left">레버리지 (롱)</th>
            <th className="py-2 text-right">청산까지 필요한 하락폭 (대략)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-2">5배</td>
            <td className="py-2 text-right">약 19.5%</td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-2">10배</td>
            <td className="py-2 text-right">약 9.5%</td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-2">20배</td>
            <td className="py-2 text-right">약 4.5%</td>
          </tr>
          <tr>
            <td className="py-2">50배</td>
            <td className="py-2 text-right">약 1.5%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-gray-400">유지증거금률 0.5%, 수수료 제외 기준의 근삿값입니다.</p>

      <h2>격리 마진과 교차 마진</h2>
      <h3>격리 마진 (Isolated)</h3>
      <p>
        포지션마다 증거금을 따로 떼어 놓는 방식입니다. 그 포지션에 넣은 증거금만 잃을 수 있고,
        계좌의 나머지 돈은 안전합니다. 대신 강제청산가가 위 계산식처럼 고정되어 있어서, 가격이
        닿으면 바로 청산됩니다.
      </p>
      <h3>교차 마진 (Cross)</h3>
      <p>
        계좌 전체 잔고를 모든 포지션의 증거금으로 함께 쓰는 방식입니다. 손실이 나도 계좌에 남은 돈이
        버팀목이 되기 때문에 강제청산가가 훨씬 멀어질 수 있습니다. 대신 청산되면 계좌 잔고 대부분을
        잃을 수 있고, 강제청산가가 잔고와 다른 포지션 손익에 따라 계속 바뀝니다.
      </p>
      <p>
        그래서 교차 마진에서는 <strong>수익률이 -100%를 넘어도 청산되지 않을 수 있습니다</strong>.
        방송 화면에 -150% 같은 수익률이 보이는데도 포지션이 살아 있다면 교차 마진일 가능성이 큽니다.
        호반꿀이 수익률만으로 강제청산을 판정하지 않고, 포지션이 실제로 사라졌는지와 직전 가격이
        강제청산가 근처였는지를 함께 보는 이유입니다.
      </p>

      <h2>호반꿀에서 강제청산가 보기</h2>
      <p>
        <Link href="/">홈</Link>의 실시간 포지션 표와 <Link href="/founder">운영자 포지션</Link>
        카드에는 진입가, 현재가와 함께 강제청산가가 표시됩니다. 현재가가 강제청산가에 가까울수록
        위험한 상태입니다. 방송 화면에서 강제청산가가 가려져 있으면 지어내지 않고 이전 값을
        유지하거나 비워 둡니다.
      </p>
    </ContentPage>
  );
}
