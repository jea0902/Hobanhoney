import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  const theme = cookies().get("theme")?.value;

  return (
    <html lang="ko" className={theme === "dark" ? "dark" : ""}>
      <body>{children}</body>
    </html>
  );
}
