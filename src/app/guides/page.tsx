import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "가이드 | 호반꿀",
  description: "인간지표, 강제청산가, 공포탐욕지수 기초 가이드.",
};

const GUIDES = [
  {
    href: "/guides/human-indicator",
    title: "인간지표란?",
    summary: "뜻과 승률 읽을 때 주의할 점",
  },
  {
    href: "/guides/liquidation-price",
    title: "강제청산가 보는 법",
    summary: "레버리지와 청산가, 격리·교차 마진 차이",
  },
  {
    href: "/guides/fear-greed-index",
    title: "공포탐욕지수 읽는 법",
    summary: "계산 방법과 해석",
  },
];

export default function GuidesPage() {
  return (
    <ContentPage title="가이드">
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
