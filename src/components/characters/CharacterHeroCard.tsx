"use client";

import React from "react";

type CharacterHeroCardProps = {
  name: string;
  imageUrl: string | null;
  description: string | null;
  level: number;
  xp: number;
  xpToNextLevel?: number;
  raceName: string | null;
  className: string | null;
};

/**
 * Frente hero off-session compartilhada entre o hub do jogador e a
 * visualização pública (somente leitura).
 */
export function CharacterHeroCard({
  name,
  imageUrl,
  description,
  level,
  xp,
  xpToNextLevel = 100,
  raceName,
  className,
}: CharacterHeroCardProps) {
  const progress = xp % xpToNextLevel;

  return (
    <div
      data-testid="character-hero-card"
      className="overflow-hidden rounded-xl border border-secondary-border bg-secondary-card"
    >
      {/* Retrato hero com iluminação diegética */}
      <div className="relative flex justify-center bg-gradient-to-b from-accent/25 via-dominant-deep to-secondary-card px-4 pb-0 pt-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%)]" />
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="relative h-56 w-44 rounded-t-lg border-4 border-accent/40 object-cover shadow-[0_0_40px_rgba(168,85,247,0.35)] md:h-72 md:w-56"
          />
        ) : (
          <div className="relative flex h-56 w-44 items-center justify-center rounded-t-lg border-4 border-accent/40 bg-dominant-dark text-6xl font-black text-accent shadow-[0_0_40px_rgba(168,85,247,0.35)] md:h-72 md:w-56">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Identidade */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-black tracking-tight text-secondary-pure">{name}</h1>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {raceName && (
              <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                {raceName}
              </span>
            )}
            {className && (
              <span className="rounded-full bg-dominant-container px-2.5 py-0.5 text-[11px] font-bold text-secondary-offwhite">
                {className}
              </span>
            )}
            <span className="rounded-full bg-dominant-container px-2.5 py-0.5 text-[11px] font-bold text-secondary-muted">
              Nível {level}
            </span>
          </div>
        </div>

        {/* Progresso de XP */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-medium text-secondary-muted">
            <span>Progresso XP</span>
            <span>
              {progress} / {xpToNextLevel} XP
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-dominant-container">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-dark to-accent-vibrant transition-all duration-300"
              style={{ width: `${(progress / xpToNextLevel) * 100}%` }}
            />
          </div>
        </div>

        {/* Narrativa */}
        <div className="rounded-lg border border-secondary-border bg-secondary-input/40 p-3.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary-muted">
            História
          </p>
          {description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary-offwhite">
              {description}
            </p>
          ) : (
            <p className="text-sm italic text-secondary-muted">Sem biografia ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
