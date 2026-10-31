"use client";

import React, { useState } from "react";
import { FileText, Plus, PenTool, Dices, AlertTriangle, Package } from "lucide-react";
import type {
  MissingHabitant,
  MissingEquipment,
  HabitantLine,
  MissingThreat,
  EquipmentStatus,
} from "@/lib/systems/missing/types";
import { EQUIPMENT_TABLE_2D6 } from "@/lib/systems/missing/types";
import { checkHabitantDisappearance, roll2d6 } from "@/lib/systems/missing/rules";
import { MissingDiceRollerModal } from "./MissingDiceRollerModal";

export interface MissingHabitantSheetProps {
  habitant: MissingHabitant;
  campaignId?: string;
  activeThreats?: MissingThreat[];
  onEraseLine?: (lineId: string, reason?: string) => Promise<void> | void;
  onAddLine?: (text: string) => Promise<void> | void;
  onUpdateEquipment?: (
    slot: 1 | 2 | 3,
    equipment: { name: string; notes?: string; status: EquipmentStatus },
  ) => Promise<void> | void;
  onRollEquipment?: (slot: 1 | 2 | 3) => Promise<void> | void;
  onTestRolled?: (result: unknown) => void;
  onClose?: () => void;
  initialTab?: "sheet" | "inventory";
  readOnly?: boolean;
  className?: string;
}

export function MissingHabitantSheet({
  habitant,
  campaignId,
  activeThreats = [],
  onEraseLine,
  onAddLine,
  onUpdateEquipment,
  onRollEquipment,
  onTestRolled,
  onClose,
  initialTab = "sheet",
  readOnly = false,
  className = "",
}: MissingHabitantSheetProps) {
  const [activeTab, setActiveTab] = useState<"sheet" | "inventory">(initialTab ?? "sheet");
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [newLineText, setNewLineText] = useState("");
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [erasingLineId, setErasingLineId] = useState<string | null>(null);
  const [eraseReason, setEraseReason] = useState("");

  const isDisappeared =
    habitant.status === "missing" ||
    checkHabitantDisappearance(habitant.lines) ||
    (habitant.lines.length > 0 && habitant.lines.every((line) => line.isErased));

  const totalLines = habitant.lines.length;
  const activeLinesCount = habitant.lines.filter((l) => !l.isErased).length;
  const canAddLine = totalLines < 30 && !readOnly;

  const handleConfirmErase = async (lineId: string) => {
    if (onEraseLine) {
      await onEraseLine(lineId, eraseReason.trim() || undefined);
    }
    setErasingLineId(null);
    setEraseReason("");
  };

  const handleConfirmAddLine = async () => {
    const text = newLineText.trim();
    if (!text) return;
    if (onAddLine) {
      await onAddLine(text);
    }
    setNewLineText("");
    setIsAddingLine(false);
  };

  const handleRollEquipmentSlot = async (slot: 1 | 2 | 3) => {
    if (readOnly) return;
    if (onRollEquipment) {
      await onRollEquipment(slot);
      return;
    }
    const [d1, d2] = roll2d6();
    const sum = d1 + d2;
    const itemDef = EQUIPMENT_TABLE_2D6[sum] ?? {
      name: "Objeto Misterioso",
      description: "Um item esquecido no tempo",
    };
    if (onUpdateEquipment) {
      await onUpdateEquipment(slot, {
        name: itemDef.name,
        notes: itemDef.description,
        status: "active",
      });
    }
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full bg-[#0a0b0d] text-zinc-200 font-mono select-text ${className}`}
      data-testid="missing-habitant-sheet"
    >
      {/* Header Superior Fixo */}
      <header className="sticky top-0 z-30 bg-[#0e0f12]/95 border-b border-zinc-800/90 px-4 sm:px-6 py-3 flex items-center justify-between backdrop-blur-md">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rose-400 font-bold text-xs uppercase tracking-wider">
              MISSING — Edição ZERO
            </span>
            <span className="text-zinc-600 text-xs hidden sm:inline">•</span>
            {isDisappeared ? (
              <span className="inline-block bg-red-950/80 text-red-500 border border-red-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                Desaparecido
              </span>
            ) : (
              <span className="inline-block bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                Ativo
              </span>
            )}
            <span className="text-zinc-400 text-xs hidden sm:inline">
              Memória: {activeLinesCount}/{totalLines} linhas legíveis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black text-zinc-100 uppercase tracking-tight truncate">
              {habitant.name}
            </h1>
            <span className="text-xs text-zinc-400 sm:hidden">
              ({activeLinesCount}/{totalLines})
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Fechar ficha"
          >
            ✕
          </button>
        )}
      </header>

      {/* Corpo Central Scrollável */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 pb-32">
        {/* Página 1: "Ficha" */}
        <section
          aria-label="Folha de Memórias do Habitante"
          className={activeTab === "sheet" ? "block" : "hidden"}
        >
          <div className="max-w-4xl mx-auto w-full">
            {/* Folha Pautada A4 (Registro de Habitante - Passado) */}
            <div className="relative rounded-xs bg-[#fbf9f1] text-[#1c1917] p-5 sm:p-8 shadow-2xl border border-[#d8d2c2] min-h-[640px] flex flex-col justify-between">
              {/* Margem vertical clássica de folha A4 (linha vermelha) */}
              <div className="pointer-events-none absolute left-12 sm:left-14 top-0 bottom-0 w-[2px] bg-red-400/70" />

              <div>
                {/* Cabeçalho da folha pautada */}
                <div className="mb-4 pl-8 sm:pl-10 border-b border-[#c8d4df] pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#2d2a26]">
                      Registro de Habitante (Passado)
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#6b645b]">
                      Folha pautada A4 — Máximo 30 linhas de memórias
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#4a443c] bg-[#ede8d8] px-2.5 py-1 rounded-xs">
                    {totalLines}/30
                  </span>
                </div>

                {/* Lista de Linhas Pautadas */}
                <div className="space-y-1 pl-8 sm:pl-10" data-testid="habitant-lines-container">
                  {habitant.lines.map((line) => {
                    const isBeingErased = erasingLineId === line.id;

                    return (
                      <div
                        key={line.id}
                        data-testid={`habitant-line-${line.index}`}
                        className="group relative flex items-center justify-between border-b border-[#c8d4df]/70 py-1.5 min-h-[36px] text-xs sm:text-sm"
                      >
                        {/* Número da linha */}
                        <span className="absolute -left-9 text-[11px] font-bold text-zinc-400 select-none">
                          {String(line.index).padStart(2, "0")}.
                        </span>

                        {/* Conteúdo da linha: Legível ou Tarja Preta */}
                        <div className="flex-1 pr-3">
                          {line.isErased ? (
                            <div
                              className="relative inline-block w-full"
                              title={
                                line.erasedReason
                                  ? `Rasurado em ${line.erasedAt ?? "data desconhecida"}: ${line.erasedReason}`
                                  : "Linha rasurada pelo horror"
                              }
                            >
                              {/* Tarja preta grossa de marcador indelével */}
                              <span
                                data-testid={`erased-line-${line.index}`}
                                className="inline-block w-full bg-black text-transparent select-none line-through py-0.5 px-1 rounded-xs relative"
                                style={{
                                  backgroundColor: "#000000",
                                  color: "transparent",
                                  textDecoration: "line-through",
                                }}
                              >
                                {line.text}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#1f1d1a] leading-relaxed break-words">
                              {line.text}
                            </span>
                          )}
                        </div>

                        {/* Botão de Rasurar para linha ativa */}
                        {!line.isErased && !readOnly && (
                          <div className="shrink-0">
                            {isBeingErased ? (
                              <div className="flex items-center gap-1 bg-[#ede8d8] p-1 rounded-xs shadow-sm">
                                <input
                                  type="text"
                                  placeholder="Motivo da rasura..."
                                  value={eraseReason}
                                  onChange={(e) => setEraseReason(e.target.value)}
                                  className="w-32 sm:w-44 px-1.5 py-0.5 text-[11px] border border-[#beb5a2] bg-white text-zinc-900 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleConfirmErase(line.id)}
                                  className="bg-black text-white px-2 py-0.5 text-[10px] font-bold hover:bg-zinc-800 cursor-pointer"
                                  data-testid={`btn-confirmar-rasura-${line.index}`}
                                >
                                  Rasurar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setErasingLineId(null);
                                    setEraseReason("");
                                  }}
                                  className="text-zinc-600 px-1 text-[11px] hover:text-black cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setErasingLineId(line.id)}
                                className="opacity-60 group-hover:opacity-100 transition-opacity p-1 text-zinc-600 hover:text-black rounded-xs hover:bg-[#ede8d8] cursor-pointer"
                                title="Rasurar linha (caneta/marcador indelével)"
                                aria-label={`Rasurar linha ${line.index}`}
                                data-testid={`btn-rasurar-${line.index}`}
                              >
                                <PenTool className="h-3.5 w-3.5 text-zinc-700" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Formulário inline para Adicionar Linha */}
                {canAddLine && (
                  <div className="mt-4 pl-8 sm:pl-10 pt-2 border-t border-[#c8d4df]/50">
                    {isAddingLine ? (
                      <div className="flex flex-col sm:flex-row gap-2 bg-[#ede8d8]/60 p-2 rounded-xs border border-[#d8d2c2]">
                        <input
                          type="text"
                          placeholder="Escreva uma nova linha do registro..."
                          value={newLineText}
                          onChange={(e) => setNewLineText(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs sm:text-sm border border-[#beb5a2] bg-white text-zinc-900 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={handleConfirmAddLine}
                            className="bg-black text-white px-3 py-1 text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                            data-testid="btn-confirmar-add-linha"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingLine(false);
                              setNewLineText("");
                            }}
                            className="px-2 py-1 text-xs text-zinc-600 hover:text-black cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingLine(true)}
                        className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-black font-bold uppercase tracking-wider py-1 cursor-pointer"
                        data-testid="btn-adicionar-linha"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Linha
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Carimbo Dramático de Habitante Desaparecido */}
              {isDisappeared && (
                <div
                  data-testid="habitant-disappeared-stamp"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-6 pointer-events-none"
                >
                  <div className="border-4 border-dashed border-red-700 text-red-600 bg-red-950/85 uppercase font-black tracking-widest text-2xl sm:text-3xl md:text-4xl rotate-[-8deg] px-8 py-5 text-center shadow-2xl">
                    HABITANTE DESAPARECIDO
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Página 2: "Inventário" */}
        <section
          aria-label="Inventário de Equipamentos"
          className={activeTab === "inventory" ? "block" : "hidden"}
        >
          <div className="max-w-3xl mx-auto w-full pt-2">
            {/* Cabeçalho explicativo */}
            <div className="mb-6 border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-400">
                  Equipamentos (3 Post-its)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Equipamentos do Habitante — 3 Post-its analógicos • Tabela oficial de 2d6
                </p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xs self-start sm:self-auto">
                3 SLOTS MÁXIMOS
              </span>
            </div>

            {/* Grid dos 3 Post-its amarelos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              {([1, 2, 3] as const).map((slot, index) => {
                const eq = habitant.equipments.find((e) => e.slot === slot) || {
                  id: `empty-${slot}`,
                  slot,
                  name: "",
                  status: "active" as EquipmentStatus,
                };

                const isLost = eq.status === "lost";
                const hasItem = Boolean(eq.name && eq.name.trim().length > 0);
                const rotationClasses = ["-rotate-1", "rotate-1", "-rotate-2"];
                const rotation = rotationClasses[index % rotationClasses.length];

                return (
                  <div
                    key={slot}
                    data-testid={`equipment-postit-${slot}`}
                    className={`relative bg-[#fef9c3] text-stone-900 border border-amber-300 shadow-xl p-4 rounded-xs font-mono transition-transform hover:rotate-0 min-h-[170px] flex flex-col justify-between ${rotation}`}
                  >
                    {/* Fita adesiva simulada no topo do post-it */}
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-white/50 border border-white/40 shadow-xs backdrop-blur-xs select-none" />

                    <div>
                      <div className="flex items-center justify-between border-b border-amber-300/80 pb-1 mb-2">
                        <span className="text-[10px] uppercase font-black text-amber-900 tracking-wider">
                          Slot {slot}
                        </span>
                        <span className="text-[10px] font-bold text-amber-800/80">
                          {isLost ? "Inutilizado" : "Disponível"}
                        </span>
                      </div>

                      {hasItem ? (
                        <div>
                          <h3 className="text-sm font-black text-stone-900 uppercase tracking-tight">
                            {eq.name}
                          </h3>
                          {eq.notes && (
                            <p className="text-xs text-stone-700 mt-1 leading-snug italic">
                              &ldquo;{eq.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-3 text-center">
                          <p className="text-xs text-amber-800/80 italic mb-2">Slot vazio</p>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleRollEquipmentSlot(slot)}
                              className="inline-flex items-center gap-1.5 text-xs bg-amber-900 text-amber-100 hover:bg-amber-800 px-2.5 py-1.5 rounded-xs font-bold shadow-sm cursor-pointer transition-colors"
                              data-testid={`btn-rolar-equipamento-${slot}`}
                            >
                              <Dices className="h-3.5 w-3.5" />
                              Rolar Equipamento (2d6)
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Carimbo de INUTILIZADO / PERDIDO */}
                    {isLost && (
                      <div
                        data-testid={`stamp-lost-${slot}`}
                        className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[0.5px] select-none pointer-events-none"
                      >
                        <span className="border-2 border-dashed border-red-700 text-red-700 bg-red-100/90 font-black uppercase text-xs sm:text-sm px-2.5 py-1 rotate-[-12deg] tracking-wider shadow-md">
                          INUTILIZADO / PERDIDO
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Card de referência rápida com as regras de rolagem e descarte de equipamentos */}
            <div className="mt-8 rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-4 text-xs text-zinc-400 space-y-2">
              <div className="flex items-center gap-2 text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Regras de Sobrevivência — Equipamentos
              </div>
              <p className="leading-relaxed">
                • Cada habitante possui exatamente 3 post-its analógicos para carregar ferramentas e objetos vitais.
              </p>
              <p className="leading-relaxed">
                • Role 2d6 na tabela oficial para obter itens quando encontrar suprimentos na escuridão.
              </p>
              <p className="leading-relaxed">
                • Durante encontros de horror e perigo extremo, equipamentos podem ser sacrificados ou destruídos, marcando o slot permanentemente como <strong className="text-zinc-200">INUTILIZADO / PERDIDO</strong>.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Botão Flutuante 'Realizar Teste' (FAB no Polegar) */}
      <div className="fixed right-4 bottom-20 sm:right-6 sm:bottom-20 z-40">
        <button
          type="button"
          onClick={() => setIsDiceModalOpen(true)}
          className="flex items-center gap-2.5 rounded-full bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-black tracking-wider uppercase text-xs sm:text-sm px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xl shadow-rose-950/90 border-2 border-rose-500 cursor-pointer active:scale-95 transition-transform"
          data-testid="btn-realizar-teste"
        >
          <Dices className="h-5 w-5 shrink-0" />
          <span>Realizar Teste</span>
        </button>
      </div>

      {/* Barra de Navegação Inferior (Menu Bottom) */}
      <nav
        aria-label="Navegação da Ficha"
        className="fixed inset-x-0 bottom-0 z-40 bg-[#0e0f12]/95 border-t border-zinc-800/90 backdrop-blur-xl py-1.5 px-4 shadow-2xl"
      >
        <div className="mx-auto w-full max-w-md flex items-center justify-around">
          <button
            type="button"
            onClick={() => setActiveTab("sheet")}
            data-testid="tab-ficha"
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-all cursor-pointer ${
              activeTab === "sheet"
                ? "text-rose-400 font-bold scale-105"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider mt-0.5">Ficha</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            data-testid="tab-inventario"
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-all cursor-pointer ${
              activeTab === "inventory"
                ? "text-amber-400 font-bold scale-105"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider mt-0.5">Inventário</span>
          </button>
        </div>
      </nav>

      {/* Modal de Rolagem */}
      {isDiceModalOpen && (
        <MissingDiceRollerModal
          isOpen={isDiceModalOpen}
          onClose={() => setIsDiceModalOpen(false)}
          habitant={habitant}
          campaignId={campaignId}
          activeThreats={activeThreats}
          onRollComplete={onTestRolled}
        />
      )}
    </div>
  );
}
