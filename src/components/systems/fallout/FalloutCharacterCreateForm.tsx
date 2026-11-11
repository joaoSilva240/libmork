"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Formulário de Criação de Sobrevivente
// =============================================================================

import React, { useState } from "react";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutCharacter,
  type FalloutOrigin,
  type FalloutSkillName,
} from "@/lib/systems/fallout/types";

interface FalloutCharacterCreateFormProps {
  campaignId?: string | null;
  onSuccess?: (character: FalloutCharacter) => void;
  onCancel?: () => void;
}

const ORIGINS: { id: FalloutOrigin; label: string }[] = [
  { id: "vault_dweller", label: "Morador de Refúgio (Vault Dweller)" },
  { id: "wastelander", label: "Habitante dos Ermos (Wastelander)" },
  { id: "brotherhood_initiate", label: "Iniciado da Irmandade do Aço" },
  { id: "ghoul", label: "Necrótico (Ghoul)" },
  { id: "super_mutant", label: "Super Mutante" },
  { id: "mister_handy", label: "Robô Mister Handy" },
  { id: "survivor", label: "Sobrevivente" },
];

export function FalloutCharacterCreateForm({
  campaignId = null,
  onSuccess,
  onCancel,
}: FalloutCharacterCreateFormProps) {
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<FalloutOrigin>("vault_dweller");
  const [attributes, setAttributes] = useState<Record<FalloutAttribute, number>>({
    str: 5,
    per: 5,
    end: 5,
    cha: 5,
    int: 5,
    agi: 5,
    luc: 5,
  });
  const [tagSkills, setTagSkills] = useState<FalloutSkillName[]>([]);
  const [caps] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPoints = Object.values(attributes).reduce((a, b) => a + b, 0);
  const remainingPoints = 40 - totalPoints;

  const handleAttrChange = (attr: FalloutAttribute, delta: number) => {
    setAttributes((prev) => {
      const nextVal = Math.max(4, Math.min(10, prev[attr] + delta));
      return { ...prev, [attr]: nextVal };
    });
  };

  const toggleTagSkill = (skill: FalloutSkillName) => {
    setTagSkills((prev) => {
      if (prev.includes(skill)) {
        return prev.filter((s) => s !== skill);
      }
      if (prev.length >= 3) return prev;
      return [...prev, skill];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/systems/fallout/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId,
          name: name.trim(),
          origin,
          attributes,
          tagSkills,
          caps,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao registrar sobrevivente");
      }

      onSuccess?.(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar personagem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-950 border-2 border-emerald-500/50 rounded-xl p-5 font-mono text-emerald-400 space-y-5"
    >
      <div className="border-b border-emerald-500/40 pb-2">
        <span className="text-[10px] uppercase tracking-widest text-emerald-500">
          Vault-Tec Registration System
        </span>
        <h3 className="text-lg font-bold text-emerald-200">Novo Sobrevivente — Fallout 2d20</h3>
      </div>

      {error && (
        <div className="p-2.5 rounded bg-red-950/50 border border-red-500 text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase text-emerald-400 mb-1">
            Nome do Personagem
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Lucy MacLean"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black border border-emerald-500/50 rounded px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div>
          <label className="block text-xs uppercase text-emerald-400 mb-1">Origem</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as FalloutOrigin)}
            className="w-full bg-black border border-emerald-500/50 rounded px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
          >
            {ORIGINS.map((o) => (
              <option key={o.id} value={o.id} className="bg-zinc-950">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Distribuição S.P.E.C.I.A.L. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase text-emerald-300">Atributos S.P.E.C.I.A.L.</span>
          <span className={remainingPoints < 0 ? "text-amber-400" : "text-emerald-400"}>
            Total Distribuído: {totalPoints} / 40 (
            {remainingPoints >= 0
              ? `${remainingPoints} restantes`
              : `${Math.abs(remainingPoints)} acima`}
            )
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {FALLOUT_ATTRIBUTES.map((attr) => {
            const cfg = FALLOUT_ATTRIBUTE_CONFIGS[attr];
            return (
              <div
                key={attr}
                className="bg-black/80 border border-emerald-500/40 rounded p-2 text-center"
              >
                <div className="text-[10px] font-bold text-emerald-500 uppercase">
                  {cfg.shortLabel}
                </div>
                <div className="text-xl font-bold text-emerald-200 my-1">{attributes[attr]}</div>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAttrChange(attr, -1)}
                    className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-xs text-emerald-200 cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttrChange(attr, 1)}
                    className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-xs text-emerald-200 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seleção de até 3 Tag Skills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase text-emerald-300">
            Tag Skills (Selecione até 3 especialidades ★)
          </span>
          <span className="text-amber-300">{tagSkills.length} / 3 selecionadas</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {FALLOUT_SKILLS.map((sk) => {
            const cfg = FALLOUT_SKILL_CONFIGS[sk];
            const selected = tagSkills.includes(sk);
            return (
              <button
                key={sk}
                type="button"
                onClick={() => toggleTagSkill(sk)}
                className={`px-2.5 py-1.5 rounded border text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                  selected
                    ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold"
                    : "bg-black/50 border-emerald-900/50 text-emerald-500 hover:text-emerald-300"
                }`}
              >
                <span className="truncate">{cfg.label}</span>
                <span>{selected ? "★" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/30">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-emerald-700 text-xs text-emerald-400 hover:bg-emerald-950 cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Registrando..." : "Registrar no Pip-Boy"}
        </button>
      </div>
    </form>
  );
}
