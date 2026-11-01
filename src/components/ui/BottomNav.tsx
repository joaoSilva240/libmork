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
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-center pointer-events-none"
      style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="liquid-glass-dock rounded-full px-4 py-2 pointer-events-auto">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onChange(tab.id)}
                className={`liquid-glass-interactive relative flex items-center justify-center px-4 py-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                  isActive ? "text-purple-300" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {isActive && (
                  <span className="liquid-glass-pill absolute inset-0 rounded-full" aria-hidden="true" />
                )}
                <span className="relative z-10">{tab.icon}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
