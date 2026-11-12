"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Slider temático do Pip-Boy
// Trilho de fósforo verde com preenchimento progressivo, thumb luminoso,
// marcas de passo e leitura ao vivo do valor selecionado.
// =============================================================================

import React, { type CSSProperties, type ReactNode } from "react";

export interface PipBoySliderTick {
  value: number;
  label: string;
}

interface PipBoySliderProps {
  label: string;
  icon?: ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  readout: ReactNode;
  hint?: ReactNode;
  ticks?: PipBoySliderTick[];
  ariaLabel?: string;
}

export function PipBoySlider({
  label,
  icon,
  min,
  max,
  step = 1,
  value,
  onChange,
  readout,
  hint,
  ticks,
  ariaLabel,
}: PipBoySliderProps) {
  const fillPercent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-black/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
          {icon}
          {label}
        </span>
        <span className="text-base font-black tabular-nums text-emerald-200 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">
          {readout}
        </span>
      </div>

      <input
        type="range"
        aria-label={ariaLabel ?? label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pipboy-range"
        style={{ "--pipboy-fill": `${fillPercent}%` } as CSSProperties}
      />

      {ticks && ticks.length > 0 && (
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-emerald-700">
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className={tick.value === value ? "text-emerald-300" : undefined}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}

      {hint && <div className="text-[10px] leading-snug text-emerald-400/80">{hint}</div>}
    </div>
  );
}