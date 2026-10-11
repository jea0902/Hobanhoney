import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";
import record from "@/lib/wonyottiRecord.json";

const title = "워뇨띠 매매법 분석: 4년 체결 기록 144만 건으로 본 승률과 수익 구조";
const description =
  "워뇨띠 BitMEX 계정의 2018~2021년 실제 체결·입출금 기록을 분석함. 14.5 BTC로 시작해 3,537 BTC를 번 매매 습관, 승률, 보유 시간, 진입 타이밍, 그리고 습관만 따라 하면 왜 안 되는지.";

export const metadata: Metadata = {
  title: `${title} | 호반꿀`,
  description,
  openGraph: { title, description, siteName: "호반꿀", locale: "ko_KR", type: "article" },
};

function btc(n: number, digits = 1) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} BTC`;
}

export default function WonyottiTradingRecordGuide() {
  const { totals, habits } = record;
  return (
    <ContentPage title={title} updatedAt="2026년 10월 11일">
      <p>
        워뇨띠는 한국 코인 선물 트레이더 중 가장 유명한 이름임. 이 글은 워뇨띠의 BitMEX
        계정(aoa)으로 알려진 {record.period.from.slice(0, 7).replace("-", "년 ")}월~
        {record.period.to.slice(0, 7).replace("-", "년 ")}월 체결 기록{" "}
        {habits.fills.toLocaleString()}건과 지갑(입출금) 기록을 직접 분석한 결과임. 숫자는 전부
        기록에서 계산했고, 손익은 BTC 기준임.
      </p>

      <h2>4년 성과 요약</h2>
      <ul>
        <li>
          입금은 2018년에 넣은 <strong>{btc(totals.deposits)}</strong>가 전부임.
        </li>
        <li>
          4년간 실현 손익 <strong>+{btc(totals.realizedPnl, 0)}</strong>, 출금{" "}
          {btc(totals.withdrawals, 0)}, 2021년 말 잔고 {btc(totals.endBalance, 0)}.
        </li>
        <li>
          번 돈의 약 80%를 꾸준히 출금함. 2018년 초엔 1~2 BTC씩, 2018년 말~2019년엔 10~20 BTC씩,
          2021년엔 300~400 BTC씩 뺌.
        </li>
        <li>
          연도별 실현 손익: {record.yearly.map((y) => `${y.year}년 +${btc(y.pnl, 0)}`).join(", ")}.
          손실 연도 없음.
        </li>
        <li>
          종목은 BTC·ETH가 대부분임 (
          {record.bySymbol
            .slice(0, 3)
            .map((s) => `${s.symbol} +${btc(s.pnl, 0)}`)
            .join(", ")}
          ). 알트코인 소액 거래는 거의 본전이거나 손실.
        </li>
      </ul>

      <h2>매매 습관</h2>
      <p>BTC 무기한(XBTUSD) 체결을 포지션 단위(0 → 보유 → 0)로 다시 묶어 분석함.</p>
      <ul>
        <li>
          <strong>거의 전부 지정가 주문.</strong> 체결의 {habits.limitShare}%가 지정가,{" "}
          {habits.makerShare}%는 호가에 걸어두고 기다린 체결(메이커). 시장가로 쫓아가지 않음.
        </li>
        <li>
          <strong>롱·숏 편향 없음.</strong> 포지션 {habits.positions.toLocaleString()}개 중 롱{" "}
          {habits.longShare}%.
        </li>
        <li>
          <strong>승률 {habits.winRate}%, 그러나 평균 손실이 평균 이익의 약 2배.</strong> 평균 이익{" "}
          {btc(habits.avgWin, 2)}, 평균 손실 {btc(habits.avgLoss, 2)}. 자주 조금씩 벌고, 가끔 크게
          잃는 구조.
        </li>
        <li>
          <strong>아주 짧게 보유.</strong> 보유 시간 중간값 {habits.medianHoldMinutes}분, 이긴
          포지션의 가격 움직임 중간값 {habits.medianWinMove}%.
        </li>
        <li>
          <strong>추가 진입이 잦지만 물타기는 아님.</strong> 포지션의 {habits.addedShare}%에 추가
          진입이 있지만, 본인은 100문 100답에서 &ldquo;10~20분할 물타기로는 높은 수익률이 절대 안
          나온다&rdquo;며 한 자리에서 진입·정리를 선호하고, 거래량이 부족하거나 변동성이 클 때만
          2분할 50:50 정도로 나눈다고 밝힘. 기록상 두 번째 진입 가격도 첫 진입과 0.1%대 차이라
          물량을 나눠 채운 것에 가까움.
        </li>
        <li>
          <strong>스탑 주문을 거의 안 씀.</strong> 스탑 주문이 체결된 포지션은{" "}
          {habits.stopPositions}
          개뿐이고, 손절도 대부분 직접 지정가로 정리함.
        </li>
        <li>
          <strong>계좌가 커질수록 레버리지를 낮춤.</strong> 지갑 대비 포지션 크기 중간값이 2018년 약
          3.8배에서 2021년 약 0.7배로 줄어듦. 강제청산된 포지션 {habits.liquidationPositions}개는
          모두 2018년.
        </li>
      </ul>

      <h2>돈은 어디서 벌었나</h2>
      <p>
        보유 시간별로 나누면 그림이 완전히 달라짐. 초단타는 횟수만 많고, 돈은 몇 시간~며칠 들고 간
        큰 포지션에서 남.
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700">
            <th className="py-2">보유 시간</th>
            <th className="py-2 text-right">포지션</th>
            <th className="py-2 text-right">순손익</th>
            <th className="py-2 text-right">승률</th>
            <th className="py-2 text-right">크기 중간값</th>
          </tr>
        </thead>
        <tbody>
          {record.holdBuckets.map((b) => (
            <tr key={b.label} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">{b.label}</td>
              <td className="py-2 text-right">{b.count.toLocaleString()}</td>
              <td className="py-2 text-right">+{btc(b.pnl, 0)}</td>
              <td className="py-2 text-right">{b.winRate}%</td>
              <td className="py-2 text-right">{btc(b.medianBtc, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        더 극단적인 숫자도 있음.{" "}
        <strong>
          이익 상위 1% 포지션({habits.top1Count}개)이 총이익의 {habits.top1Share}%를 냄.
        </strong>{" "}
        나머지 99%는 합치면 소폭 손실임. 가장 크게 번 포지션은 {record.bestTrades[0].date}{" "}
        {record.bestTrades[0].direction} 포지션으로, 최대 {btc(record.bestTrades[0].maxBtc, 0)}{" "}
        규모를 {record.bestTrades[0].hours}시간 들고 가서 +{btc(record.bestTrades[0].pnl, 0)}를
        벌었음.
      </p>

      <h2>진입 타이밍</h2>
      <p>1시간 이상 보유한 포지션의 진입 직전 시세를 같은 기간 1시간봉과 맞춰 봄.</p>
      <ul>
        <li>
          <strong>최근 4시간 범위의 유리한 쪽에서 진입.</strong> 롱은 4시간 저점 근처, 숏은 고점
          근처. 범위의 아래(숏은 위) 1/3에서 들어간 비율이 BTC 49%, ETH 60%로, 아무 때나 들어갈
          때(약 31%)보다 뚜렷하게 높음.
        </li>
        <li>
          <strong>시장이 출렁일 때 진입.</strong> 진입 직전 24시간 변동폭 중간값이 BTC 6.6%로
          평소(5.0%)보다 큼. ETH는 11.7%로 평소(6.4%)의 약 2배.
        </li>
        <li>
          <strong>큰 추세 방향에는 편향이 없음.</strong> 50일 평균 위·아래, 직전 24시간 방향 모두
          롱·숏 반반. 다만 1~24시간 보유한 포지션은 50일 추세와 같은 방향일 때 번 돈이 훨씬 컸음(약
          670 BTC vs 반대 방향 약 121 BTC).
        </li>
      </ul>

      <h2>습관만 따라 하면 될까</h2>
      <p>
        그렇지 않음. 위 단타 습관(진입 위치, 변동성, 익절 폭, 2분할, 손절 폭, 보유 시간)을 그대로
        규칙으로 만들어 과거 시세로 시험해 봄. 승률은 75~77%로 비슷했지만, 이길 때 +0.6%·질 때
        -1.3~3%라 수수료까지 빼면 손실이었음 (최대 1배 기준 2018~2021년 연 -20%, 2022~2026년 연
        -4.5%).
      </p>
      <p>
        여기에 본인이 100문 100답에서 밝힌 원칙 두 가지를 더하자 결과가 바뀜. &ldquo;애매할 때도
        시드의 40%는 비트로, 상승장에선 최소 30%는 비트코인으로&rdquo;를 옮긴 상승 추세 BTC 30% 기본
        포지션, 그리고 &ldquo;거래량이 적으면 웬만한 움직임은 휩쏘&rdquo;를 옮긴 거래량 조건임. 두
        기간 모두 플러스로 바뀜(연 +23%, 연 +7.8%). 다만 수익 대부분은 기본 포지션에서 나오고,
        단타는 여전히 본전 수준임. 반대로 &ldquo;추세 방향으로 되돌림이 나왔을 때 크게 싣기&rdquo;는
        한 기간에서 오히려 나빠져서 넣지 않았음.
      </p>
      <p>
        워뇨띠 수익의 핵심은 습관이 아니라 <strong>언제 크게 실을지 고르는 판단</strong>이었음. 상위
        1% 포지션이 이익 전부를 냈다는 사실이 그것을 보여줌. 호가창을 보며 지정가로 나눠 사고파는
        감각도 규칙으로 옮기기 어려움.
      </p>
      <p>
        이 규칙으로 실제 시세에서 매일 매매하는 <Link href="/ai/wonyotti">AI 워뇨띠</Link>를 운영
        중임. 워뇨띠의 실제 기록 그래프와 함께 습관과 원칙을 닮은 AI가 어떻게 되는지 비교해 볼 수
        있음.
      </p>

      <h2>읽을 때 주의할 점</h2>
      <ul>
        <li>BitMEX 체결 기록 기준이며, 다른 거래소 계정이 있었다면 반영되지 않음.</li>
        <li>지갑 기록의 시각 정보가 일부 깨져 있어 월말 잔고는 날짜 기준으로 계산함.</li>
        <li>과거 기록 분석이며 투자 권유가 아님.</li>
      </ul>
    </ContentPage>
  );
}
