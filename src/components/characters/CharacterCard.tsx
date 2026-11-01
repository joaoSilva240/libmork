import Link from "next/link";
import type { Character } from "@/types";
import { getDerivedStats } from "@/lib/engine/attributes";

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
      className="group relative overflow-hidden flex flex-col justify-between rounded-xl border border-secondary-border bg-secondary-card p-5 transition-all hover:border-accent hover:shadow-[0_0_20px_rgba(147,51,234,0.25)] cursor-pointer"
      style={character.imageUrl ? { backgroundImage: `url(${character.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-gray-950/65 group-hover:via-gray-950/75 transition-colors pointer-events-none" />
      <div className="relative z-10 flex min-h-[190px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500">
              {character.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-purple-950 text-lg font-bold text-purple-200">{character.name.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <h3 className="truncate text-lg font-bold text-secondary-pure drop-shadow-md group-hover:text-purple-200 transition-colors">{character.name}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded bg-accent-dark/90 border border-accent-vibrant/50 px-2 py-0.5 text-[10px] font-semibold text-secondary-pure">Nv. {character.level}{character.className ? ` · ${character.className}` : ""}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="rounded border border-red-900/60 bg-gray-950/70 px-2 py-1 text-red-200">❤️ HP {character.hitPointsCurrent}/{character.hitPointsMax}</span>
          <span className="rounded border border-blue-900/60 bg-gray-950/70 px-2 py-1 text-blue-200">✦ Mana {character.manaPointsCurrent}/{character.manaPointsMax}</span>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-secondary-border/60 pt-3 text-xs text-gray-300">
          {character.campaignName && <span className="rounded bg-dominant-dark/90 px-2 py-1 text-purple-200">🏰 Campanha: {character.campaignName}</span>}
          <span>Bloqueio: {stats.block}</span><span>·</span><span>XP: {character.xp}</span>
        </div>
      </div>
    </Link>
  );
}
