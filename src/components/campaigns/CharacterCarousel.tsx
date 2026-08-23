"use client";

import { useEffect, useRef } from "react";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";
import type { CombatSessionState } from "@/lib/engine";

type CharacterCarouselProps = {
  actors: RosterActor[];
  combatState?: CombatSessionState | null;
  onSelect: (actor: RosterActor) => void;
  onRemove?: (actorId: string, kind: string) => void;
};

export function CharacterCarousel({
  actors,
  combatState,
  onSelect,
  onRemove,
}: CharacterCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // Ordena os atores se houver um combate ativo
  const sortedActors = [...actors];
  const activeCombatantId =
    combatState?.active && combatState.combatants.length > 0
      ? combatState.combatants[combatState.currentTurnIndex]?.id
      : null;

  if (combatState?.active && combatState.combatants.length > 0) {
    const combatantMap = new Map(combatState.combatants.map((c) => [c.id, c]));
    sortedActors.sort((a, b) => {
      const iniA = combatantMap.get(a.id)?.initiative ?? 0;
      const iniB = combatantMap.get(b.id)?.initiative ?? 0;
      return iniB - iniA;
    });
  }

  // Centraliza o card do combatente ativo suavemente quando o turno muda
  useEffect(() => {
    if (activeCardRef.current && scrollRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeCombatantId]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (actors.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-800 p-4 text-center">
        <p className="text-xs font-semibold text-purple-400">⚡ Mesa Vazia</p>
        <p className="text-xs text-gray-400">
          Arraste e solte os personagens dos jogadores (na barra de convites) aqui para colocá-los na mesa.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full items-center overflow-hidden">
      {sortedActors.length > 3 && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-1 z-20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
        >
          ‹
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto px-6 py-2 scrollbar-hide w-full"
        style={{ scrollbarWidth: "none" }}
      >
        {sortedActors.map((actor) => {
          const isCombatActive = Boolean(combatState?.active);
          const combatant = isCombatActive
            ? combatState?.combatants.find((c) => c.id === actor.id)
            : null;
          const isActiveTurn = isCombatActive && activeCombatantId === actor.id;

          const hpPercent = Math.min(
            100,
            Math.max(0, (actor.hitPoints / Math.max(actor.hitPointsMax, 1)) * 100)
          );
          const manaPercent = Math.min(
            100,
            Math.max(0, (actor.manaPoints / Math.max(actor.manaPointsMax, 1)) * 100)
          );

          return (
            <div
              key={`${actor.kind}-${actor.id}`}
              ref={isActiveTurn ? activeCardRef : null}
              className={`group relative shrink-0 aspect-[3/4] transition-all duration-300 rounded-xl overflow-hidden border ${
                isActiveTurn
                  ? "w-36 scale-110 border-purple-500 bg-purple-950/60 ring-2 ring-purple-500 z-10 shadow-2xl shadow-purple-950/80"
                  : isCombatActive
                  ? "w-28 scale-90 opacity-70 border-gray-800 bg-gray-900/60 hover:opacity-100 hover:scale-95"
                  : "w-32 border-gray-800 bg-gray-900 hover:border-purple-600 hover:scale-105"
              }`}
            >
              <button
                onClick={() => onSelect(actor)}
                className="h-full w-full text-left"
              >
                {actor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={actor.imageUrl}
                    alt={actor.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-2xl font-bold text-gray-600">
                    {actor.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/50" />

                {/* Selo TURNO ATIVO */}
                {isActiveTurn && (
                  <div className="absolute top-1 inset-x-1 z-10 rounded bg-purple-600 py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-white shadow-md animate-pulse">
                    ⚡ TURNO ATIVO
                  </div>
                )}

                {/* Nível e Iniciativa */}
                <div className={`absolute right-1.5 flex flex-col items-end gap-1 ${isActiveTurn ? "top-6" : "top-1.5"}`}>
                  <span className="rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    Nv {actor.level}
                  </span>
                  {combatant && (
                    <span className="rounded-md bg-purple-900/90 px-1.5 py-0.5 text-[9px] font-extrabold text-purple-200 shadow border border-purple-700/60">
                      Ini: {combatant.initiative}
                    </span>
                  )}
                </div>

                {actor.kind === "npc" && (
                  <span
                    className={`absolute left-1.5 ${isActiveTurn ? "top-6" : "top-1.5"} rounded px-1 py-0.5 text-[9px] font-semibold ${
                      actor.npcType === "enemy"
                        ? "bg-red-900/80 text-red-200"
                        : "bg-gray-800/80 text-gray-300"
                    }`}
                  >
                    {actor.npcType === "enemy" ? "Inimigo" : "NPC"}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-1.5">
                  <p className="truncate text-xs font-bold text-white drop-shadow">
                    {actor.name}
                  </p>

                  {/* Ações Restantes (se combate ativo) */}
                  {combatant && (
                    <div className="my-1 flex items-center justify-between">
                      <span className="text-[9px] text-purple-300 font-semibold">Ações:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((num) => (
                          <span
                            key={num}
                            className={`h-2 w-2 rounded-full ${
                              num <= combatant.actionsRemaining ? "bg-purple-400" : "bg-gray-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${manaPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-0.5 text-[9px] text-gray-300">
                    HP {actor.hitPoints}/{actor.hitPointsMax} · MP {actor.manaPoints}/{actor.manaPointsMax}
                  </p>
                </div>
              </button>

              {onRemove && !isCombatActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(actor.id, actor.kind);
                  }}
                  className="absolute right-1 top-7 z-20 hidden rounded bg-red-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-700 group-hover:block shadow"
                  title="Remover da mesa"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {sortedActors.length > 3 && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-1 z-20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
        >
          ›
        </button>
      )}
    </div>
  );
}
