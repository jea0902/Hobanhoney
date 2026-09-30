import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "가이드 | 호반꿀",
  description:
    "인간지표, 강제청산가, 공포탐욕지수 등 호반꿀 데이터를 읽는 데 필요한 기초 가이드 모음.",
};

const GUIDES = [
  {
    href: "/guides/human-indicator",
    title: "인간지표란? 기록으로 보는 트레이더 역지표",
    summary: "인간지표의 뜻, 왜 기록으로 확인해야 하는지, 호반꿀 승률을 읽을 때 주의할 점.",
  },
  {
    href: "/guides/liquidation-price",
    title: "강제청산가 보는 법 — 격리와 교차 마진의 차이",
    summary: "레버리지와 강제청산가의 관계, 격리·교차 마진에서 청산이 일어나는 방식.",
  },
  {
    href: "/guides/fear-greed-index",
    title: "공포탐욕지수 읽는 법",
    summary: "코인 공포탐욕지수가 무엇으로 계산되는지, 숫자를 어떻게 해석하면 좋은지.",
  },
];

export default function GuidesPage() {
  return (
    <ContentPage title="가이드" description="호반꿀의 포지션과 지표를 제대로 읽기 위한 기초 가이드">
      <ul className="!list-none !pl-0">
        {GUIDES.map((guide) => (
          <li key={guide.href} className="!mt-4">
            <Link href={guide.href} className="font-bold">
              {guide.title}
            </Link>
            <p className="!mt-1 text-sm text-gray-500 dark:text-gray-400">{guide.summary}</p>
          </li>
        ))}
      </ul>
    </ContentPage>
  );
}
