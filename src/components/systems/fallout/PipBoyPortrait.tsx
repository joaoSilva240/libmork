"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Retrato do personagem criado
// Silhueta oficial do Vault Boy (ou Mister Handy) em camadas, tingida com o
// verde-fósforo do Pip-Boy e emoldurada como um registro fotográfico Vault-Tec.
// =============================================================================

import React from "react";
import {
  FALLOUT_BODY_LOCATIONS,
  type FalloutCharacter,
} from "@/lib/systems/fallout/types";
import {
  getPaperdollImage,
  getPaperdollPartState,
  PIPBOY_GREEN_FILTER,
} from "@/lib/systems/fallout/assets";

interface PipBoyPortraitProps {
  character: FalloutCharacter;
  className?: string;
}

export function PipBoyPortrait({ character, className = "" }: PipBoyPortraitProps) {
  const actorKind = character.origin === "mister_handy" ? "robot" : "character";

  return (
    <div
      data-testid="pipboy-portrait"
      role="img"
      aria-label={`Retrato de ${character.name}`}
      className={`relative shrink-0 overflow-hidden rounded-lg border border-emerald-500/50 bg-black/80 shadow-[0_0_16px_rgba(16,185,129,0.2)] ${className}`}
    >
      {/* Silhueta em camadas refletindo o estado de cada membro */}
      <div className="absolute inset-0" aria-hidden="true">
        {FALLOUT_BODY_LOCATIONS.map((loc) => {
          const part = character.bodyParts[loc];
          if (!part) return null;
          const state = getPaperdollPartState(part.injuries);
          return (
            <div
              key={loc}
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${getPaperdollImage(actorKind, loc, state)})`,
                backgroundSize: "100% 100%",
                filter: PIPBOY_GREEN_FILTER,
              }}
            />
          );
        })}
      </div>

      {/* Verniz de scanlines do CRT Pip-Boy */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Legenda do registro Vault-Tec */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pb-1 pt-3">
        <span className="block truncate text-center font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
          {character.name}
        </span>
      </div>
    </div>
  );
}