"use client";

import { useEffect, useRef, useState } from "react";

export default function HorizontalScrollArrows({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateState = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateState();
    el.addEventListener("scroll", updateState);
    window.addEventListener("resize", updateState);
    return () => {
      el.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, []);

  function scroll(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="왼쪽으로 이동"
          className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      <div ref={scrollRef} className="overflow-x-hidden">
        {children}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="오른쪽으로 이동"
          className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}
