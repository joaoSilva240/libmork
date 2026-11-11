"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Paperdoll de Localização de Dano e Membros
// Visualizador de cabeça, tronco, braços e pernas com ferimentos e resistências
// =============================================================================

import React from "react";
import type { FalloutBodyLocation, FalloutBodyPart } from "@/lib/systems/fallout/types";
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

export function PipBoyPaperdoll({
  bodyParts,
  onUpdateBodyPart,
  readOnly = false,
  className = "",
  actorKind = "character",
}: PipBoyPaperdollProps) {
  const toggleInjury = (location: FalloutBodyLocation) => {
    if (readOnly || !onUpdateBodyPart) return;
    const current = bodyParts[location];
    const nextInjuries = current.injuries >= 3 ? 0 : current.injuries + 1;
    onUpdateBodyPart(location, {
      injuries: nextInjuries,
      isCrippled: nextInjuries > 0,
    });
  };

  const renderPartCard = (location: FalloutBodyLocation) => {
    const part = bodyParts[location];
    if (!part) return null;

    const isInjured = part.injuries > 0 || part.isCrippled;

    return (
      <div
        key={location}
        onClick={() => !readOnly && toggleInjury(location)}
        className={`p-2.5 rounded border transition-all ${
          readOnly ? "" : "cursor-pointer hover:border-emerald-400/80"
        } ${
          isInjured
            ? "bg-red-950/40 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
            : "bg-emerald-950/20 border-emerald-500/40 hover:bg-emerald-950/30"
        }`}
        title={readOnly ? part.label : `${part.label} (Clique para alternar ferimento)`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-xs tracking-wider text-emerald-300">{part.label}</span>
          <span className="text-[10px] text-emerald-500/80 font-mono">
            d20: {part.minRoll}-{part.maxRoll}
          </span>
        </div>

        {/* Status de Integridade / Ferimentos */}
        <div className="flex items-center justify-between my-1.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isInjured ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {isInjured ? `Ferido (${part.injuries})` : "Íntegro"}
          </span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`w-2 h-2 rounded-full border ${
                  step <= part.injuries
                    ? "bg-red-500 border-red-400 shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                    : "bg-black/60 border-emerald-900/60"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Resistências de Dano (Armadura no membro) */}
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

      {/* Silhueta oficial em camadas (Vault Boy / Mister Handy) */}
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
