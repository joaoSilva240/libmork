"use client";

import { useRef, useEffect } from "react";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";

type CharacterCarouselProps = {
  actors: RosterActor[];
  onSelect: (actor: RosterActor) => void;
};

export function CharacterCarousel({ actors, onSelect }: CharacterCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Duplicate actors for infinite scroll effect
  const infiniteActors = actors.length > 0 ? [...actors, ...actors, ...actors] : [];

  useEffect(() => {
    if (!scrollRef.current || actors.length === 0) return;

    // Start at the middle set
    const container = scrollRef.current;
    const cardWidth = 128 + 12; // width + gap (w-32 = 128px)
    const startPosition = actors.length * cardWidth;
    container.scrollLeft = startPosition;

    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollLeft } = scrollRef.current;
      const sectionWidth = actors.length * cardWidth;

      // If scrolled past the last set, jump back to middle
      if (scrollLeft >= sectionWidth * 2) {
        scrollRef.current.scrollLeft = scrollLeft - sectionWidth;
      }
      // If scrolled before the first set, jump forward to middle
      else if (scrollLeft < sectionWidth) {
        scrollRef.current.scrollLeft = scrollLeft + sectionWidth;
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [actors.length]);

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
    <div className="relative flex h-full items-center overflow-hidden">
      <button
        onClick={() => scroll("left")}
        className="absolute left-1 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
      >
        ‹
      </button>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-10 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {infiniteActors.map((actor, index) => {
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
              key={`${actor.kind}-${actor.id}-${index}`}
              onClick={() => onSelect(actor)}
              className="group relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-all hover:border-purple-600 hover:scale-105"
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
          );
        })}
      </div>

      <button
        onClick={() => scroll("right")}
        className="absolute right-1 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800/90 text-lg text-white shadow-lg hover:bg-gray-700"
      >
        ›
      </button>
    </div>
  );
}
