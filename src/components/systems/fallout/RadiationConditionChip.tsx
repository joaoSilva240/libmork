"use client";

// =============================================================================
// Libmork — Fallout 2d20: Selo da condição derivada da radiação
// =============================================================================

import { Biohazard } from "lucide-react";
import type { FalloutRadiationCondition } from "@/lib/systems/fallout/types";

const TONE_CLASS: Record<FalloutRadiationCondition["tone"], string> = {
  safe: "bg-emerald-950/60 border-emerald-700/50 text-emerald-300",
  warn: "bg-amber-950/60 border-amber-600/50 text-amber-300",
  danger: "bg-orange-950/60 border-orange-600/60 text-orange-300",
  lethal: "bg-red-950/70 border-red-500/70 text-red-300 animate-pulse",
};

interface RadiationConditionChipProps {
  condition: FalloutRadiationCondition;
  immune?: boolean;
  className?: string;
}

export function RadiationConditionChip({
  condition,
  immune = false,
  className = "",
}: RadiationConditionChipProps) {
  if (immune) {
    return (
      <span
        data-testid="radiation-condition"
        title="Esta origem não acumula radiação."
        className={`inline-flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ${className}`}
      >
        <Biohazard size={10} />
        Imune
      </span>
    );
  }

  return (
    <span
      data-testid="radiation-condition"
      title={condition.description}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASS[condition.tone]} ${className}`}
    >
      <Biohazard size={10} />
      {condition.label}
      {condition.difficultyPenalty > 0 && <span>+{condition.difficultyPenalty}D</span>}
    </span>
  );
}
