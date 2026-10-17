"use client";

import { useEffect, useState } from "react";

// recharts 색상은 인라인 props라 Tailwind dark: 클래스가 안 먹혀서, <html> 클래스를 직접 감지한다.
export function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
