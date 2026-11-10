import Link from "next/link";
import type { Character } from "@/types";
import { getDerivedStats } from "@/lib/engine/attributes";
import { CharacterSpiderChart } from "@/components/characters/CharacterSpiderChart";

export function CharacterCard({ character }: { character: Character }) {
  const stats = getDerivedStats(character.attributes, character.level);
  const isDead = character.deathStatus === "dead";
  const isDown = character.hitPointsCurrent <= 0 || character.deathStatus === "falling";
  const status = isDead
    ? { label: "💀 Morto", className: "border-red-700/60 bg-red-950/90 text-red-300" }
    : isDown
      ? { label: "🩸 Caído", className: "border-amber-700/60 bg-amber-950/90 text-amber-300" }
      : { label: "💚 Vivo", className: "border-emerald-700/60 bg-emerald-950/90 text-emerald-300" };

  return (
    <Link
      href={`/player/characters/${character.id}`}
      aria-label={`Ver ficha de ${character.name}`}
      className="motion-lift group relative overflow-hidden flex flex-col justify-between rounded-xl border border-secondary-border bg-secondary-card p-5 transition-all hover:border-accent hover:shadow-[0_0_20px_rgba(147,51,234,0.25)] cursor-pointer"
      style={
        character.imageUrl
          ? {
              backgroundImage: `url(${character.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {character.imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-gray-950/65 group-hover:via-gray-950/75 transition-colors pointer-events-none" />
      )}
      <div className="relative z-10 flex min-h-[190px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500">
              {character.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-purple-950 text-lg font-bold text-purple-200">
                  {character.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h3
              className={`truncate text-lg font-bold drop-shadow-md transition-colors ${character.imageUrl ? "text-white" : "text-secondary-pure group-hover:text-accent-vibrant [data-theme-mode=light]:group-hover:text-accent-dark"}`}
            >
              {character.name}
            </h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-dark [data-theme-mode=dark]:border-accent-vibrant/50 [data-theme-mode=dark]:bg-accent-dark/90 [data-theme-mode=dark]:text-white">
              Nv. {character.level}
              {character.className ? ` · ${character.className}` : ""}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col gap-2 text-xs">
            <span className="rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-red-700 font-medium [data-theme-mode=dark]:border-red-900/60 [data-theme-mode=dark]:bg-gray-950/70 [data-theme-mode=dark]:text-red-200">
              ❤️ HP {character.hitPointsCurrent}/{character.hitPointsMax}
            </span>
            <span className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-blue-700 font-medium [data-theme-mode=dark]:border-blue-900/60 [data-theme-mode=dark]:bg-gray-950/70 [data-theme-mode=dark]:text-blue-200">
              ✦ Mana {character.manaPointsCurrent}/{character.manaPointsMax}
            </span>
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <CharacterSpiderChart attributes={character.attributes} size={90} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-secondary-border/60 pt-3 text-xs text-secondary-muted">
          {character.campaignName && (
            <span className="rounded border border-accent/30 bg-accent/15 px-2 py-1 text-accent-dark [data-theme-mode=dark]:border-transparent [data-theme-mode=dark]:bg-dominant-dark/90 [data-theme-mode=dark]:text-purple-200">
              🏰 Campanha: {character.campaignName}
            </span>
          )}
          <span>Bloqueio: {stats.block}</span>
          <span>·</span>
          <span>XP: {character.xp}</span>
        </div>
      </div>
    </Link>
  );
}
