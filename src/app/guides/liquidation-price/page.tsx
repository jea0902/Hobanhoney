import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "강제청산가 보는 법 | 호반꿀",
  description: "레버리지와 강제청산가의 관계, 격리·교차 마진 차이.",
};

export default function LiquidationPriceGuide() {
  return (
    <ContentPage title="강제청산가 보는 법" updatedAt="2026년 9월 30일">
      <h2>강제청산이란?</h2>
      <p>
        선물은 레버리지로 증거금보다 큰 포지션을 잡을 수 있어. 손실이 증거금 가까이 가면 거래소가
        포지션을 강제로 정리하는데, 그게 강제청산이고 그 가격이 강제청산가야. 기준은 체결가가 아니라
        마크 가격이야.
      </p>

      <h2>레버리지별 청산까지 거리</h2>
      <p>격리 마진 롱 기준 대략 이 정도야 (유지증거금률 0.5%, 수수료 제외).</p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 text-left">레버리지</th>
            <th className="py-2 text-right">청산까지 하락폭</th>
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
      <p>계산식: 롱 청산가 ≈ 진입가 × (1 − 1/레버리지 + 유지증거금률), 숏은 부호 반대.</p>

      <h2>격리 vs 교차</h2>
      <ul>
        <li>
          <strong>격리</strong> — 포지션마다 증거금 따로. 넣은 만큼만 잃고, 청산가가 고정돼 있어.
        </li>
        <li>
          <strong>교차</strong> — 계좌 잔고 전체가 증거금. 청산가가 훨씬 멀어질 수 있지만 청산되면
          잔고 대부분을 잃어. 그래서 수익률 -100%가 넘어도 안 죽는 경우가 있어.
        </li>
      </ul>
    </ContentPage>
  );
}
