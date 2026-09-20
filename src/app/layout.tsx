import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const title = "호반꿀 - 인간지표 사이트";
const description =
  "박호두, 사또, 짭구 등 유튜버 트레이더들의 실시간 포지션과 승률을 추적하고 강제청산 알림을 제공하며, 공포탐욕지수·금리·CPI 등 주요 투자 지표를 한눈에 보여주는 인간지표 대시보드.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "호반꿀",
    images: ["/logo.png"],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/logo.png"],
  },
  verification: {
    other: {
      "naver-site-verification": "b825c6691807dd6527de7f69dd6d0fdf375929b7",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = cookies().get("theme")?.value;
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <html lang="ko" className={theme === "dark" ? "dark" : ""}>
      <head>
        {/* 애드센스 사이트 소유확인 크롤러가 렌더링 없이 원본 스니펫 그대로를 찾아서, next/script 없이 직접 넣는다 */}
        {adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
