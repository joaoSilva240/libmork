"use client";

import React from "react";
import type { MissingHabitant } from "@/lib/systems/missing/types";
import { checkHabitantDisappearance } from "@/lib/systems/missing/rules";

export interface MissingHabitantCardProps {
  habitant: MissingHabitant;
  onOpen: (habitant: MissingHabitant) => void;
  className?: string;
  compact?: boolean;
}

export function MissingHabitantCard({
  habitant,
  onOpen,
  className = "",
  compact = false,
}: MissingHabitantCardProps) {
  const isDisappeared =
    habitant.status === "missing" ||
    checkHabitantDisappearance(habitant.lines) ||
    (habitant.lines.length > 0 && habitant.lines.every((l) => l.isErased));

  const totalLines = habitant.lines.length;
  const activeLines = habitant.lines.filter((l) => !l.isErased).length;

  const activeEquipments = habitant.equipments.filter(
    (e) => e.status === "active" && e.name.trim().length > 0,
  ).length;

  const initials =
    habitant.name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "H";

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        data-testid={`missing-habitant-card-${habitant.id}`}
        aria-label={`Ver ficha de ${habitant.name}`}
        onClick={() => onOpen(habitant)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(habitant);
          }
        }}
        className={`group flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#121316] p-3 font-mono transition-all hover:border-red-900/60 cursor-pointer ${className}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 border border-zinc-700 text-zinc-200 font-mono font-bold text-xs select-none">
            {initials}
          </div>
          <span className="truncate font-semibold text-zinc-100 uppercase tracking-tight group-hover:text-red-300 transition-colors">
            {habitant.name}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="rounded bg-red-950/80 border border-red-800/60 px-2 py-0.5 text-[10px] font-bold text-red-300 uppercase tracking-wider">
            MISSING
          </span>
          {isDisappeared ? (
            <span className="rounded bg-red-950 text-red-500 border border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Desaparecido
            </span>
          ) : (
            <span className="rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Ativo
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`missing-habitant-card-${habitant.id}`}
      aria-label={`Ver ficha de ${habitant.name}`}
      onClick={() => onOpen(habitant)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(habitant);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#121316] p-5 font-mono shadow-md transition-all hover:border-red-900/60 hover:shadow-[0_0_20px_rgba(220,38,38,0.18)] cursor-pointer ${className}`}
    >
      <div>
        {/* Header com Badges */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3 mb-4">
          <span className="rounded bg-red-950/80 border border-red-800/60 px-2 py-0.5 text-[10px] font-bold text-red-300 uppercase tracking-wider">
            MISSING — Edição ZERO
          </span>
          {isDisappeared ? (
            <span className="rounded bg-red-950 text-red-500 border border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Desaparecido
            </span>
          ) : (
            <span className="rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Ativo
            </span>
          )}
        </div>

        {/* Informações Principais: Avatar Circular e Nome */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 border border-zinc-700 text-zinc-200 font-mono font-bold text-sm select-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-tight group-hover:text-red-300 transition-colors truncate">
              {habitant.name}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Registro // Sujeito
            </span>
          </div>
        </div>

        {/* Contadores */}
        <div className="mt-4 space-y-1.5 border-t border-zinc-800/60 pt-3 text-xs text-zinc-400">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Memórias:</span>
            <span className="font-semibold text-zinc-300">
              {activeLines} / {totalLines} linhas de memórias legíveis
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Equipamento:</span>
            <span className="font-semibold text-zinc-300">
              {activeEquipments} / 3 itens disponíveis
            </span>
          </div>
        </div>
      </div>

      {/* Botão / Indicação visual */}
      <div className="mt-5 border-t border-zinc-800/60 pt-3 flex items-center justify-end text-xs font-bold text-zinc-400 group-hover:text-red-400 transition-colors">
        <span>Abrir Ficha →</span>
      </div>
    </div>
  );
}
