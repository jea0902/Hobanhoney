import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
// 검색 결과에 그대로 나오는 문구. 실제로 있는 기능만 적는다 (없는 기능을 적으면 애드센스·검색 품질 평가에 불리).
// 검색 결과에선 긴 제목의 뒤가 잘리므로 사람들이 검색할 이름을 앞에 둔다.
const title = "박호두·짭구·웨돔 실시간 포지션 · AI 워뇨띠 실시간 포지션 | 호반꿀";
const description =
  "박호두·짭구·웨돔 등 코인 유튜버 트레이더들이 방송에서 잡은 실제 포지션(롱/숏·진입가·청산가)을 실시간으로 추적함. 트레이더별 승률·롱숏 성향, 인간지표 컨센서스, 워뇨띠 매매법·실제 매매 기록 분석, AI 워뇨띠·AI 호반꿀 등 AI 트레이더 수익률까지.";

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
