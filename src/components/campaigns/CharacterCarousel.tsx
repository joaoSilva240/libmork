"use client";

import { useRef } from "react";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";

type CharacterCarouselProps = {
  actors: RosterActor[];
  onSelect: (actor: RosterActor) => void;
  onRemove?: (actorId: string, kind: string) => void;
};

export function CharacterCarousel({ actors, onSelect, onRemove }: CharacterCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {actors.length > 3 && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-1 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
        >
          ‹
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {actors.map((actor) => {
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
              className="group relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-all hover:border-purple-600 hover:scale-105"
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

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />

                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Nv {actor.level}
                </span>

                {actor.kind === "npc" && (
                  <span
                    className={`absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[9px] font-semibold ${
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
                  <div className="mt-1 space-y-0.5">
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

              {onRemove && (
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

      {actors.length > 3 && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-1 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
        >
          ›
        </button>
      )}
    </div>
  );
}
