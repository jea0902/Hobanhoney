import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "호반꿀 - 인간지표 사이트",
  description: "humanindex_website",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
