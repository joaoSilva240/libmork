"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Navegação inferior do Pip-Boy 3000
// Reaproveita o padrão do BottomNav (dock liquid-glass flutuante + pill ativa +
// micro-interações), substituindo cor/estilo/botões pela identidade verde-fósforo.
// =============================================================================

import React from "react";

export type PipBoyTab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

export type PipBoyTabNavProps = {
  tabs: readonly PipBoyTab[];
  activeId: string;
  onChange: (id: string) => void;
};

export function PipBoyTabNav({ tabs, activeId, onChange }: PipBoyTabNavProps) {
  return (
    <nav
      aria-label="Navegação do Pip-Boy"
      role="tablist"
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-center pointer-events-none"
      style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="pipboy-glass-dock pointer-events-auto max-w-[calc(100vw-1.5rem)] rounded-full px-2.5 py-2 sm:px-4">
        <div className="pipboy-scrollbar flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => onChange(tab.id)}
                className={`pipboy-glass-interactive relative flex shrink-0 items-center justify-center rounded-full p-2.5 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06110c] sm:p-3 ${
                  isActive ? "pipboy-glass-tab-active" : "pipboy-glass-tab-inactive"
                }`}
              >
                {isActive && (
                  <span
                    className="pipboy-glass-pill motion-pop motion-glow absolute inset-0 rounded-full"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex items-center justify-center">
                  {tab.icon}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}