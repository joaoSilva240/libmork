"use client";

import React from "react";
import type { FalloutBodyLocation, FalloutBodyPart, FalloutInjurySlot } from "@/lib/systems/fallout/types";
import { FALLOUT_BODY_LOCATIONS } from "@/lib/systems/fallout/types";
import {
  getPaperdollImage,
  getPaperdollPartState,
  PIPBOY_GREEN_FILTER,
  type PaperdollActorKind,
} from "@/lib/systems/fallout/assets";
import { Shield, Zap, Skull, Biohazard } from "lucide-react";

interface PipBoyPaperdollProps {
  bodyParts: Record<FalloutBodyLocation, FalloutBodyPart>;
  onUpdateBodyPart?: (location: FalloutBodyLocation, patch: Partial<FalloutBodyPart>) => void;
  readOnly?: boolean;
  className?: string;
  actorKind?: PaperdollActorKind;
}

const SLOT_CYCLE: Record<FalloutInjurySlot, FalloutInjurySlot> = { 0: 2, 2: 1, 1: 0 };
const SLOT_COLORS: Record<FalloutInjurySlot, string> = {
  0: "bg-black/60 border-emerald-900/60",
  1: "bg-amber-500 border-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.8)]",
  2: "bg-red-500 border-red-400 shadow-[0_0_4px_rgba(239,68,68,0.8)]",
};
const SLOT_LABELS: Record<FalloutInjurySlot, string> = { 0: "saudavel", 1: "tratada", 2: "aberta" };
const STATUS_LABELS: Record<string, string> = { healthy: "Íntegro", wounded: "Ferido", crippled: "Aleijado" };
const STATUS_COLORS: Record<string, string> = { healthy: "text-emerald-400", wounded: "text-amber-400", crippled: "text-red-400" };

export function PipBoyPaperdoll({
  bodyParts,
  onUpdateBodyPart,
  readOnly = false,
  className = "",
  actorKind = "character",
}: PipBoyPaperdollProps) {
  const cycleSlot = (location: FalloutBodyLocation, slotIndex: number) => {
    if (readOnly || !onUpdateBodyPart) return;
    const part = bodyParts[location];
    const next = [...part.injuries] as [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot];
    next[slotIndex] = SLOT_CYCLE[next[slotIndex]];
    const max = Math.max(...next);
    const status = max >= 2 ? "crippled" : max === 1 ? "wounded" : "healthy";
    onUpdateBodyPart(location, { injuries: next, status });
  };

  const renderPartCard = (location: FalloutBodyLocation) => {
    const part = bodyParts[location];
    if (!part) return null;
    const isInjured = part.status !== "healthy";

    return (
      <div
        key={location}
        className={`p-2.5 rounded border transition-all ${
          isInjured
            ? "bg-red-950/40 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
            : "bg-emerald-950/20 border-emerald-500/40"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-xs tracking-wider text-emerald-300">{part.label}</span>
          <span className="text-[10px] text-emerald-500/80 font-mono">
            d20: {part.minRoll}-{part.maxRoll}
          </span>
        </div>

        <div className="flex items-center justify-between my-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[part.status] ?? "text-emerald-400"}`}>
            {STATUS_LABELS[part.status] ?? "Íntegro"}
          </span>
          <div className="flex items-center gap-1">
            {part.injuries.map((slot, idx) => (
              readOnly ? (
                <span key={idx} className={`w-2.5 h-2.5 rounded-full border ${SLOT_COLORS[slot]}`} />
              ) : (
                <button
                  key={idx}
                  type="button"
                  tabIndex={0}
                  aria-label={`Injúria ${part.label} slot ${idx + 1}: ${SLOT_LABELS[slot]}`}
                  onClick={() => cycleSlot(location, idx)}
                  className={`w-2.5 h-2.5 rounded-full border cursor-pointer ${SLOT_COLORS[slot]}`}
                />
              )
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono pt-1.5 border-t border-emerald-800/30 text-emerald-400/90">
          <div className="flex items-center gap-0.5" title="Resistência Física">
            <Shield size={10} className="text-emerald-300 shrink-0" />
            <span>{part.resistances.physical}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência à Energia">
            <Zap size={10} className="text-yellow-400 shrink-0" />
            <span>{part.resistances.energy}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência à Radiação">
            <Biohazard size={10} className="text-amber-400 shrink-0" />
            <span>{part.resistances.radiation}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência a Veneno">
            <Skull size={10} className="text-emerald-400 shrink-0" />
            <span>{part.resistances.poison}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="pipboy-paperdoll"
      className={`bg-black/80 border border-emerald-500/40 rounded-lg p-3 font-mono text-emerald-400 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/30">
        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300">
          Monitor de Membros &amp; Armadura
        </h4>
        <span className="text-[10px] text-emerald-400/70">Tabela de Localização d20</span>
      </div>

      <div
        data-testid="pipboy-paperdoll-figure"
        className="relative mx-auto mb-3 aspect-square w-full max-w-[220px] select-none"
        aria-hidden="true"
      >
        {FALLOUT_BODY_LOCATIONS.map((loc) => {
          const part = bodyParts[loc];
          if (!part) return null;
          const state = getPaperdollPartState(part.injuries);
          return (
            <div
              key={loc}
              className="pointer-events-none absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${getPaperdollImage(actorKind, loc, state)})`,
                backgroundSize: "100% 100%",
                filter: PIPBOY_GREEN_FILTER,
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {FALLOUT_BODY_LOCATIONS.map((loc) => renderPartCard(loc))}
      </div>
    </div>
  );
}
