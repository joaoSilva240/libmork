"use client";

import { useRef } from "react";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";

type CharacterCarouselProps = {
  actors: RosterActor[];
  onSelect: (actor: RosterActor) => void;
};

export function CharacterCarousel({ actors, onSelect }: CharacterCarouselProps) {
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
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Nenhum personagem na campanha ainda
      </div>
    );
  }

  return (
    <div className="relative flex h-full items-center">
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-800/90 text-white shadow-lg hover:bg-gray-700"
      >
        ‹
      </button>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-12 scrollbar-hide"
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
            <button
              key={`${actor.kind}-${actor.id}`}
              onClick={() => onSelect(actor)}
              className="group relative aspect-[3/4] w-40 shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-all hover:border-purple-600 hover:scale-105"
            >
              {actor.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={actor.imageUrl}
                  alt={actor.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-4xl font-bold text-gray-600">
                  {actor.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />

              <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
                Nv {actor.level}
              </span>

              {actor.kind === "npc" && (
                <span
                  className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    actor.npcType === "enemy"
                      ? "bg-red-900/80 text-red-200"
                      : "bg-gray-800/80 text-gray-300"
                  }`}
                >
                  {actor.npcType === "enemy" ? "Inimigo" : "NPC"}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="truncate text-sm font-bold text-white drop-shadow">
                  {actor.name}
                </p>
                <div className="mt-1.5 space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${manaPercent}%` }}
                    />
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-gray-300">
                  HP {actor.hitPoints}/{actor.hitPointsMax} · Mana {actor.manaPoints}/
                  {actor.manaPointsMax}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scroll("right")}
        className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-800/90 text-white shadow-lg hover:bg-gray-700"
      >
        ›
      </button>
    </div>
  );
}
