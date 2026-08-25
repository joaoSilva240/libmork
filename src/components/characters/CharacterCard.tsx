import Link from "next/link";
import type { Character } from "@/types";
import { getDerivedStats } from "@/lib/engine/attributes";

export function CharacterCard({ character }: { character: Character }) {
  const stats = getDerivedStats(character.attributes, character.level);

  return (
    <Link
      href={`/player/characters/${character.id}`}
      className="block rounded-lg border border-secondary-border bg-secondary-card p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-3">
        {character.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.imageUrl}
            alt={character.name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-dominant-container text-xl font-bold text-secondary-muted">
            {character.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-secondary-pure">{character.name}</h3>
          <p className="text-sm text-secondary-muted">Nível {character.level}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-secondary-muted">
          <span className="text-accent-vibrant font-semibold">HP:</span>{" "}
          {character.hitPointsCurrent}/{character.hitPointsMax}
        </div>
        <div className="text-secondary-muted">
          <span className="text-accent-hover font-semibold">Mana:</span>{" "}
          {character.manaPointsCurrent}/{character.manaPointsMax}
        </div>
      </div>

      <div className="mt-2 flex gap-2 text-xs text-secondary-muted">
        <span>Bloqueio: {stats.block}</span>
        <span>·</span>
        <span>XP: {character.xp}</span>
      </div>
    </Link>
  );
}
