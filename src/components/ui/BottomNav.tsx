"use client";

import React from "react";

export type BottomNavTab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

export type BottomNavProps = {
  tabs: BottomNavTab[];
  activeId: string;
  onChange: (id: string) => void;
};

export function BottomNav({ tabs, activeId, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 bg-gray-900/95 backdrop-blur-lg shadow-2xl"
      style={{ bottom: 0, left: 0, right: 0 }}
    >
      <div className="mx-auto w-full max-w-md border-t border-gray-800/80 px-3 py-1">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  isActive ? "text-purple-400 scale-105" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.icon}
                <span className={`text-[10px] font-bold ${isActive ? "text-purple-400" : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
