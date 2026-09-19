"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/admin", label: "유튜버 포지션" },
  { href: "/admin/rankers", label: "랭커" },
  { href: "/admin/logs", label: "로그" },
];

function SidebarContent({
  logoutAction,
  onNavigate,
}: {
  logoutAction: () => void | Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- public/logo.png는 next/image 최적화가 필요 없는 작은 정적 로고 */}
          <img src="/logo.png" alt="호반꿀" className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">호반꿀 관리자</span>
        </div>
        <ThemeToggle />
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          로그아웃
        </button>
      </form>
    </>
  );
}

export default function AdminSidebar({
  logoutAction,
}: {
  logoutAction: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 데스크탑: 항상 고정 표시 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex">
        <SidebarContent logoutAction={logoutAction} />
      </aside>

      {/* 모바일: 햄버거 버튼 + 열렸을 때만 렌더되는 드로어 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="메뉴 열기"
        className="fixed left-4 top-4 z-30 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:hidden"
      >
        <MenuIcon />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <aside className="relative flex h-full w-64 flex-col bg-white p-4 shadow-lg dark:bg-gray-900">
            <SidebarContent logoutAction={logoutAction} onNavigate={() => setIsOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-gray-600 dark:text-gray-300"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
