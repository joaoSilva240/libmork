"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Botão flutuante de rolagem (FAB)
// Botão circular fixo acima do dock inferior, com um dado d20 facetado.
// =============================================================================

import React from "react";

function D20Icon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 2 L43.05 13 L43.05 35 L24 46 L4.95 35 L4.95 13 Z" />
      <path d="M24 10 L37 33 L11 33 Z" />
      <path
        strokeWidth={1.4}
        d="M24 2 L24 10 M4.95 13 L24 10 M4.95 13 L11 33 M43.05 13 L24 10 M43.05 13 L37 33 M4.95 35 L11 33 M43.05 35 L37 33 M24 46 L11 33 M24 46 L37 33"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="monospace"
        fill="currentColor"
        stroke="none"
      >
        20
      </text>
    </svg>
  );
}

interface PipBoyRollFabProps {
  onClick: () => void;
}

export function PipBoyRollFab({ onClick }: PipBoyRollFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Rolar 2d20 / DC"
      title="Rolar 2d20 / DC"
      data-testid="pipboy-roll-fab"
      className="pipboy-roll-fab pipboy-glass-interactive fixed right-4 z-40 flex h-14 w-14 flex-col items-center justify-center rounded-full font-mono text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06110c] sm:right-6"
      style={{ bottom: `calc(max(0.75rem, env(safe-area-inset-bottom, 0px)) + 5.75rem)` }}
    >
      <D20Icon className="h-8 w-8 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
      <span className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-emerald-200">
        2d20
      </span>
    </button>
  );
}