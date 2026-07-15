"use client";

import { useEffect, useState } from "react";
import { SearchBarLink } from "./SearchBarLink";
import { QuickCategories } from "./QuickCategories";

export function StickyHeader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 140);
    };

    onScroll();

    window.addEventListener("scroll", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="mx-auto max-w-xl border-b border-black/5 bg-white/75 backdrop-blur-2xl backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="pt-safe pt-3 pb-3">
          <SearchBarLink />

          <div className="mt-3">
            <QuickCategories />
          </div>
        </div>
      </div>
    </div>
  );
}