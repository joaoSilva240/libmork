"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Plus, Trash2, ArrowLeft, AlertCircle, FileText, Sparkles } from "lucide-react";
import { EQUIPMENT_TABLE_2D6 } from "@/lib/systems/missing/types";

interface MissingHabitantCreateFormProps {
  campaignId?: string | null;
  onCancel?: () => void;
}

export function MissingHabitantCreateForm({
  campaignId,
  onCancel,
}: MissingHabitantCreateFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [lines, setLines] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
  ]);
  const [equipments, setEquipments] = useState<Array<{ name: string; notes: string }>>([
    { name: "", notes: "" },
    { name: "", notes: "" },
    { name: "", notes: "" },
  ]);
  const [lastRolls, setLastRolls] = useState<Record<number, { total: number; d1: number; d2: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manipulação de Linhas de Memória (5 a 10)
  const handleLineChange = (index: number, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddLine = () => {
    if (lines.length < 10) {
      setLines((prev) => [...prev, ""]);
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 5) {
      setLines((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Manipulação de Equipamentos (3 Slots)
  const handleEquipmentChange = (index: number, field: "name" | "notes", value: string) => {
    setEquipments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRollAllEquipments = () => {
    const updatedEquipments = [...equipments];
    const updatedLastRolls: Record<number, { total: number; d1: number; d2: number }> = {};

    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const itemDef = EQUIPMENT_TABLE_2D6[total];

      if (itemDef) {
        updatedEquipments[slotIndex] = {
          name: itemDef.name,
          notes: itemDef.description,
        };
        updatedLastRolls[slotIndex] = { total, d1, d2 };
      }
    }

    setEquipments(updatedEquipments);
    setLastRolls(updatedLastRolls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("O Nome do Habitante deve ter no mínimo 2 caracteres.");
      return;
    }

    const filledLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (filledLines.length < 5) {
      setError("O Registro de Habitante exige no mínimo 5 memórias/linhas preenchidas.");
      return;
    }
    if (filledLines.length > 10) {
      setError("O Registro de Habitante inicial permite no máximo 10 memórias/linhas.");
      return;
    }

    for (let i = 0; i < 3; i++) {
      if (!equipments[i].name.trim()) {
        setError(`O equipamento do Slot ${i + 1} precisa ter um nome (ou use o botão de rolar 2d6).`);
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/systems/missing/habitants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          campaignId: campaignId || null,
          lines: filledLines,
          equipments: equipments.map((eq) => ({
            name: eq.name.trim(),
            notes: eq.notes.trim() || undefined,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao registrar Habitante.");
        return;
      }

      router.push("/player");
    } catch {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-12 font-mono text-zinc-200">
      {/* Botão Voltar */}
      <div className="mb-4 flex items-center justify-between">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Trocar de Sistema
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/player")}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Painel do Jogador
          </button>
        )}
        <span className="text-[10px] tracking-widest text-zinc-500 uppercase">
          MANUAL ZERO // REGISTRO DE SUJEITO
        </span>
      </div>

      {/* Formulário Estilo Dossiê / Arquivo Confidencial */}
      <form
        onSubmit={handleSubmit}
        className="relative rounded-lg border border-zinc-800 bg-[#0e0f11] p-5 sm:p-8 shadow-2xl space-y-8"
      >
        {/* Cabeçalho do Arquivo */}
        <div className="border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block bg-rose-950/80 text-rose-400 border border-rose-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
              MISSING — Edição ZERO
            </span>
            <span className="text-[11px] text-zinc-500">
              // NOVO REGISTRO PAUTADO DE HABITANTE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-100">
            Ficha de Habitante
          </h1>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Em MISSING, cada Habitante possui um Registro Pautado de memórias e fatos. À medida que o horror avança, essas linhas são rasuradas até o esquecimento total.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-rose-800/80 bg-rose-950/40 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Nome do Habitante */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold">
            1. Nome do Habitante <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Arthur Pendelton, Enfermeira Clara, Dr. H. Vance..."
            disabled={isLoading}
            required
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600"
          />
        </div>

        {/* 2. Registro Pautado: 5 a 10 Linhas Iniciais */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold">
                2. Registro Pautado de Memórias (5 a 10 Linhas) <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-zinc-500">
                Escreva 5 a 10 linhas sobre quem este habitante é, memórias da infância, vínculos ou tragédias.
              </p>
            </div>
            <span className="text-xs font-semibold text-zinc-400">
              Linhas: {lines.length}/10
            </span>
          </div>

          <div className="space-y-2.5 rounded-md border border-zinc-900 bg-zinc-950/80 p-3.5">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs font-bold text-zinc-500 select-none">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleLineChange(idx, e.target.value)}
                  placeholder={`Memória / Fato ${idx + 1}...`}
                  disabled={isLoading}
                  className="flex-1 rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600"
                />
                {lines.length > 5 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={isLoading}
                    title="Remover linha"
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {lines.length < 10 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddLine}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + Adicionar Linha ({lines.length + 1}/10)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Equipamentos: 3 Slots com Rolagem 2d6 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold">
                3. Equipamentos Iniciais (3 Slots) <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-zinc-500">
                Defina manualmente ou clique para rolar 2d6 na Tabela Oficial de Equipamentos de MISSING.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRollAllEquipments}
              disabled={isLoading}
              data-testid="btn-rolar-todos-equipamentos"
              className="flex items-center gap-1.5 rounded bg-zinc-800 hover:bg-rose-950/80 hover:border-rose-700/80 border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer shadow-sm"
              title="Rolar 2d6 para os 3 Slots simultaneamente"
            >
              <Dices className="h-4 w-4 text-rose-400" />
              Rolar 2d6
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {equipments.map((eq, idx) => {
              const rollInfo = lastRolls[idx];
              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-md border border-zinc-800 bg-zinc-950/90 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Slot 0{idx + 1}
                    </span>
                  </div>

                  {rollInfo && (
                    <div className="text-[10px] text-rose-400 bg-rose-950/30 border border-rose-900/50 px-2 py-0.5 rounded">
                      Rolagem: [{rollInfo.d1} + {rollInfo.d2}] = {rollInfo.total}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] uppercase text-zinc-500 font-semibold mb-1">
                        Nome do Item
                      </label>
                      <input
                        type="text"
                        value={eq.name}
                        onChange={(e) => handleEquipmentChange(idx, "name", e.target.value)}
                        placeholder={`Item ${idx + 1}...`}
                        disabled={isLoading}
                        required
                        className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-rose-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-zinc-500 font-semibold mb-1">
                        Anotações / Descrição
                      </label>
                      <textarea
                        rows={2}
                        value={eq.notes}
                        onChange={(e) => handleEquipmentChange(idx, "notes", e.target.value)}
                        placeholder="Ex: Que você achou revirando memórias..."
                        disabled={isLoading}
                        className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-rose-600 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé / Submissão */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-5">
          <p className="text-[11px] text-zinc-500">
            Ao salvar, o registro será armazenado na sua coleção de Habitantes.
          </p>
          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md bg-rose-700 hover:bg-rose-600 active:bg-rose-800 px-5 py-2.5 text-xs font-bold text-white uppercase tracking-wider shadow-lg shadow-rose-950/50 transition border border-rose-500 disabled:opacity-50"
            >
              {isLoading ? "Registrando..." : "Registrar Habitante"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
