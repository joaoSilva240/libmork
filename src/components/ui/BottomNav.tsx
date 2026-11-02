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
      <div className="liquid-glass-dock rounded-full px-4 py-2 pointer-events-auto transition-colors duration-300">
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
                className={`liquid-glass-interactive relative flex items-center justify-center px-4 py-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-colors ${
                  isActive ? "liquid-glass-tab-active" : "liquid-glass-tab-inactive"
                }`}
              >
                {isActive && (
                  <span
                    className="liquid-glass-pill motion-pop motion-glow absolute inset-0 rounded-full"
                    aria-hidden="true"
                  />
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
