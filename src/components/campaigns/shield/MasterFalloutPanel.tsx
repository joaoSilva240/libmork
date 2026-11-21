"use client";

// =============================================================================
// Libmork — Escudo do Mestre: card de recursos do Fallout 2d20
// AP da Equipe, AP do Supervisor e Radiação em uma aba do painel de mídia.
// =============================================================================

import { useState } from "react";
import {
  Biohazard,
  ChevronDown,
  Minus,
  Plus,
  Radiation,
  ShieldAlert,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { RadiationConditionChip } from "@/components/systems/fallout/RadiationConditionChip";
import { useFalloutAP } from "@/hooks/useFalloutAP";
import { RADIATION_STEPS, useFalloutRadiation } from "@/hooks/useFalloutRadiation";
import { getCharacterRadiation, isRadiationImmune } from "@/lib/systems/fallout/rules";
import { FALLOUT_ORIGIN_CONFIGS } from "@/lib/systems/fallout/origins";

type MasterFalloutPanelProps = {
  campaignId: string;
  className?: string;
};

const STEP_BUTTON =
  "pipboy-glass-interactive flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function MasterFalloutPanel({ campaignId, className = "" }: MasterFalloutPanelProps) {
  const ap = useFalloutAP(campaignId);
  const rad = useFalloutRadiation(campaignId);
  const [targetsOpen, setTargetsOpen] = useState(true);

  return (
    <div
      data-testid="fallout-shield-panel"
      className={`relative h-full w-full overflow-hidden bg-[#050b08] font-mono ${className}`}
    >
      {/* Varredura de CRT do terminal, apenas decorativa */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.75) 0px, rgba(0,0,0,0.75) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="pipboy-scrollbar relative h-full w-full space-y-2.5 overflow-y-auto p-3 text-xs">
        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
            <Radiation size={14} className="text-emerald-400" />
            Recursos 2d20
          </span>
          <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            Vault-Tec
          </span>
        </div>

        {/* AP da Equipe */}
        <section
          data-testid="fallout-ap-card"
          className="rounded-lg border border-amber-500/40 bg-black/70 p-2.5 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              <Zap size={12} className="fill-amber-400 text-amber-400" />
              AP Equipe
            </span>
            <span
              data-testid="card-party-ap"
              className="text-base font-bold leading-none text-amber-200"
            >
              {ap.partyAP}
              <span className="text-[11px] text-amber-500/80">/{ap.maxAP}</span>
            </span>
          </div>

          <div
            className="mt-2 flex flex-wrap gap-1"
            aria-label={`Pontos de Ação da equipe: ${ap.partyAP} de ${ap.maxAP}`}
          >
            {Array.from({ length: ap.maxAP }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-sm border transition-all ${
                  i < ap.partyAP
                    ? "border-amber-300 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    : "border-amber-900/60 bg-amber-950/40"
                }`}
              />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={ap.partyAP <= 0 || ap.isUpdating}
              onClick={() => void ap.updateAP(-1, 0)}
              title="Gastar 1 AP da Equipe"
              aria-label="Gastar 1 AP da Equipe"
              className={`${STEP_BUTTON} border-amber-700/50 bg-amber-950/60 text-amber-300 hover:bg-amber-900/60`}
            >
              <Minus size={12} /> 1 AP
            </button>
            <button
              type="button"
              disabled={ap.partyAP >= ap.maxAP || ap.isUpdating}
              onClick={() => void ap.updateAP(1, 0)}
              title="Adicionar 1 AP à Equipe"
              aria-label="Adicionar 1 AP à Equipe"
              className={`${STEP_BUTTON} border-amber-700/50 bg-amber-950/60 text-amber-300 hover:bg-amber-900/60`}
            >
              <Plus size={12} /> 1 AP
            </button>
          </div>

          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-300/80">
            Dado natural 1 gera AP e dados extras debitam do pool automaticamente.
          </p>
        </section>

        {/* AP do Supervisor */}
        <section
          data-testid="fallout-overseer-card"
          className="rounded-lg border border-red-500/40 bg-black/70 p-2.5 shadow-[0_0_12px_rgba(239,68,68,0.12)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
              <ShieldAlert size={12} />
              AP Supervisor
            </span>
            <span
              data-testid="card-overseer-ap"
              className="text-base font-bold leading-none text-red-200"
            >
              {ap.overseerAP}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={ap.overseerAP <= 0 || ap.isUpdating}
              onClick={() => void ap.updateAP(0, -1)}
              title="Gastar 1 AP do Supervisor"
              aria-label="Gastar 1 AP do Supervisor"
              className={`${STEP_BUTTON} border-red-700/50 bg-red-950/60 text-red-300 hover:bg-red-900/60`}
            >
              <Minus size={12} /> 1 AP
            </button>
            <button
              type="button"
              disabled={ap.isUpdating}
              onClick={() => void ap.updateAP(0, 1)}
              title="Adicionar 1 AP ao Supervisor"
              aria-label="Adicionar 1 AP ao Supervisor"
              className={`${STEP_BUTTON} border-red-700/50 bg-red-950/60 text-red-300 hover:bg-red-900/60`}
            >
              <Plus size={12} /> 1 AP
            </button>
          </div>

          <p className="mt-1.5 text-[10px] leading-relaxed text-red-300/80">
            Pool do Mestre para complicações, reforços e ações dos NPCs.
          </p>
        </section>

        {/* Radiação */}
        <section
          data-testid="fallout-radiation-card"
          className="rounded-lg border border-red-500/40 bg-black/70 p-2.5 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.12)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
              <Biohazard size={12} />
              Radiação
            </span>
            <span className="shrink-0 text-[10px] font-bold text-red-200">
              {rad.selectedCount}/{rad.vulnerable.length} alvos
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-red-300/80">Média</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-red-900/60 bg-red-950/40">
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${rad.averagePercent}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-red-200">{rad.averagePercent}%</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <div
              role="group"
              aria-label="Intensidade do pulso"
              className="flex items-center gap-0.5 rounded border border-red-700/50 bg-red-950/40 p-0.5"
            >
              {RADIATION_STEPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => rad.setStep(value)}
                  aria-pressed={rad.step === value}
                  aria-label={`Pulso de ${value} RAD`}
                  title={`Aplicar ${value} RAD por clique`}
                  className={`cursor-pointer rounded px-1.5 py-1 text-[10px] font-bold transition-colors ${
                    rad.step === value
                      ? "bg-red-500/30 text-red-100"
                      : "text-red-400/70 hover:text-red-200"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={rad.selectedCount === 0 || rad.isApplying}
                onClick={() => void rad.applyDelta(-1)}
                title={`Remover ${rad.step} RAD (RadAway)`}
                aria-label={`Reduzir ${rad.step} de radiação`}
                className={`${STEP_BUTTON} border-emerald-700/50 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60`}
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                disabled={rad.selectedCount === 0 || rad.isApplying}
                onClick={() => void rad.applyDelta(1)}
                title={`Aplicar ${rad.step} RAD`}
                aria-label={`Aumentar ${rad.step} de radiação`}
                className={`${STEP_BUTTON} border-red-700/50 bg-red-950/60 text-red-300 hover:bg-red-900/60`}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border border-red-900/50 bg-black/40">
            <div className="flex items-center justify-between gap-1 border-b border-red-900/50 px-1.5 py-1">
              <button
                type="button"
                onClick={() => {
                  if (!targetsOpen) void rad.reloadRoster();
                  setTargetsOpen((prev) => !prev);
                }}
                aria-expanded={targetsOpen}
                aria-controls="fallout-radiation-targets"
                className="flex cursor-pointer items-center gap-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200 transition-colors hover:text-red-100"
              >
                <Users size={11} />
                Alvos
                <ChevronDown
                  size={11}
                  className={`transition-transform ${targetsOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={rad.selectAll}
                  className="cursor-pointer rounded border border-red-700/50 px-1.5 py-1 text-[9px] font-bold text-red-300 transition-colors hover:bg-red-950/60"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={rad.clearSelection}
                  className="cursor-pointer rounded border border-red-700/50 px-1.5 py-1 text-[9px] font-bold text-red-300 transition-colors hover:bg-red-950/60"
                >
                  Limpar
                </button>
              </div>
            </div>

            {targetsOpen &&
              (rad.isLoading ? (
                <p className="px-2 py-3 text-center text-[10px] italic text-red-300/80">
                  Carregando sobreviventes…
                </p>
              ) : rad.targets.length === 0 ? (
                <p className="px-2 py-3 text-center text-[10px] italic text-red-300/80">
                  Nenhum sobrevivente vinculado a esta campanha.
                </p>
              ) : (
                <ul
                  id="fallout-radiation-targets"
                  className="pipboy-scrollbar max-h-52 space-y-1 overflow-y-auto p-1.5"
                >
                  {rad.targets.map((target) => {
                    const immune = isRadiationImmune(target.origin);
                    const condition = getCharacterRadiation(target);
                    const checked = rad.selectedIds.includes(target.id);

                    return (
                      <li key={target.id}>
                        <label
                          className={`flex items-start gap-1.5 rounded border px-1.5 py-1 transition-colors ${
                            immune
                              ? "border-emerald-900/50 bg-emerald-950/20 opacity-70"
                              : checked
                                ? "cursor-pointer border-red-500/60 bg-red-950/40"
                                : "cursor-pointer border-red-900/50 bg-black/40 hover:border-red-700/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked && !immune}
                            disabled={immune}
                            onChange={() => rad.toggleTarget(target.id)}
                            aria-label={`Selecionar ${target.name}`}
                            className="mt-0.5 accent-red-500 disabled:cursor-not-allowed"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-1">
                              <span className="truncate text-[11px] font-bold text-red-100">
                                {target.name}
                              </span>
                              {immune ? (
                                <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                                  <ShieldCheck size={9} />
                                  Imune
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] font-bold text-red-200">
                                  {condition.radiation} RAD
                                </span>
                              )}
                            </span>
                            {immune ? (
                              <span className="mt-0.5 block truncate text-[9px] text-emerald-300/80">
                                {FALLOUT_ORIGIN_CONFIGS[target.origin]?.label ?? target.origin}
                              </span>
                            ) : (
                              <span className="mt-0.5 flex items-center justify-between gap-1">
                                <RadiationConditionChip condition={condition} />
                                <span className="shrink-0 text-[9px] text-red-300/90">
                                  PV {target.hpCurrent}/{condition.effectiveMaxHp}
                                </span>
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>

          {rad.feedback && (
            <p
              data-testid="radiation-feedback"
              role="status"
              className={`mt-2 rounded border px-2 py-1 text-[10px] font-semibold ${
                rad.feedback.tone === "ok"
                  ? "border-amber-700/50 bg-amber-950/40 text-amber-200"
                  : "border-red-700/50 bg-red-950/40 text-red-300"
              }`}
            >
              {rad.feedback.text}
            </p>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-red-300/80">
            Cada RAD corta 1 do teto de PV. 25% Enjoado e 50% Debilitado somam +1 de Dificuldade;
            75% Crítico soma +2; 100% zera o teto. Necróticos, Super Mutantes e Mister Handy são
            imunes.
          </p>
        </section>

        {ap.error && (
          <p
            data-testid="fallout-ap-error"
            role="status"
            className="rounded border border-red-700/50 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-300"
          >
            {ap.error}
          </p>
        )}
      </div>
    </div>
  );
}
