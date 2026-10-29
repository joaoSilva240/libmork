"use client";

import React, { useState } from "react";
import {
  Pin,
  Share2,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type {
  MissingClue,
  InvestigationConnection,
  EpiphanyRecord,
  ConnectionType,
  EpiphanyEffect,
} from "@/lib/systems/missing/types";
import type { CreateConnectionInput, DeclareEpiphanyInput } from "@/lib/systems/missing/validators";
import { canDeclareEpiphany } from "@/lib/systems/missing/rules";

export interface MissingInvestigationBoardProps {
  campaignId: string;
  clues: MissingClue[];
  connections: InvestigationConnection[];
  epiphanyHistory?: EpiphanyRecord[];
  onCreateConnection?: (connection: CreateConnectionInput) => Promise<void> | void;
  onDeclareEpiphany?: (epiphany: DeclareEpiphanyInput) => Promise<void> | void;
  readOnly?: boolean;
  className?: string;
}

export function MissingInvestigationBoard({
  campaignId,
  clues = [],
  connections = [],
  epiphanyHistory = [],
  onCreateConnection,
  onDeclareEpiphany,
  readOnly = false,
  className = "",
}: MissingInvestigationBoardProps) {
  // Formulário de Nova Conexão
  const [sourceClueId, setSourceClueId] = useState<string>("");
  const [targetClueId, setTargetClueId] = useState<string>("");
  const [connectionType, setConnectionType] = useState<ConnectionType>("cause");
  const [explanation, setExplanation] = useState<string>("");
  const [connSubmitting, setConnSubmitting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  // Filtro de Conexões
  const [selectedFilter, setSelectedFilter] = useState<"all" | ConnectionType>("all");

  // Modal de Epifania
  const [isEpiphanyModalOpen, setIsEpiphanyModalOpen] = useState(false);
  const [chosenEffect, setChosenEffect] = useState<EpiphanyEffect>("tear_false_clue");
  const [epiphanyNotes, setEpiphanyNotes] = useState("");
  const [epiphanySubmitting, setEpiphanySubmitting] = useState(false);

  // Avaliação de Epifania
  const currentStage = (epiphanyHistory?.length || 0) + 1;
  const epiphanyStatus = canDeclareEpiphany(connections, currentStage);

  const filteredConnections =
    selectedFilter === "all" ? connections : connections.filter((c) => c.type === selectedFilter);

  const getClueTitle = (id: string) => {
    const clue = clues.find((c) => c.id === id);
    return clue ? clue.title : "Pista desconhecida";
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnError(null);

    if (!sourceClueId || !targetClueId) {
      setConnError("Selecione ambas as pistas para conectar.");
      return;
    }

    if (sourceClueId === targetClueId) {
      setConnError("Não é possível conectar uma pista a ela mesma.");
      return;
    }

    setConnSubmitting(true);
    const connInput: CreateConnectionInput = {
      sourceClueId,
      targetClueId,
      type: connectionType,
      explanation: explanation.trim() || undefined,
    };

    try {
      if (onCreateConnection) {
        await onCreateConnection(connInput);
      } else if (campaignId) {
        await fetch(`/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(connInput),
        });
      }
      setSourceClueId("");
      setTargetClueId("");
      setExplanation("");
    } catch {
      // Ignorar fallback
    } finally {
      setConnSubmitting(false);
    }
  };

  const handleConfirmEpiphany = async () => {
    setEpiphanySubmitting(true);
    const epiphanyInput: DeclareEpiphanyInput = {
      chosenEffect,
      notes: epiphanyNotes.trim() || undefined,
    };

    try {
      if (onDeclareEpiphany) {
        await onDeclareEpiphany(epiphanyInput);
      } else if (campaignId) {
        await fetch(`/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(epiphanyInput),
        });
      }
      setIsEpiphanyModalOpen(false);
      setEpiphanyNotes("");
    } catch {
      // Ignorar fallback
    } finally {
      setEpiphanySubmitting(false);
    }
  };

  return (
    <div
      className={`space-y-6 font-mono text-zinc-100 ${className}`}
      data-testid="missing-investigation-board"
    >
      {/* Quadro de Cortiça Virtual */}
      <div className="relative rounded-lg bg-[#27150c] border-4 border-[#3e2417] shadow-2xl p-5 sm:p-7 min-h-[500px]">
        {/* Cabeçalho do Quadro */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#4d2d1d] pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-red-500 fill-red-500" />
              <span className="text-xs uppercase tracking-widest text-amber-200/70 font-bold">
                TEIA DE INVESTIGAÇÃO // QUADRO DE CORTIÇA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-amber-100 mt-1">
              Quadro de Evidências
            </h1>
          </div>

          {/* Indicador do Painel de Epifania no Topo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEpiphanyModalOpen(true)}
              disabled={!epiphanyStatus.canDeclare || readOnly}
              className={`flex items-center gap-2 px-4 py-2 rounded-xs font-bold uppercase tracking-wider text-xs border shadow-lg transition-all ${
                epiphanyStatus.canDeclare
                  ? "bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300 shadow-amber-500/20 cursor-pointer animate-pulse"
                  : "bg-stone-900/80 text-stone-500 border-stone-800 opacity-60 cursor-not-allowed"
              }`}
              data-testid="btn-declarar-epifania"
            >
              <Sparkles className="h-4 w-4" />
              Declarar Epifania
            </button>
          </div>
        </div>

        {/* Resumo da Meta de Epifania */}
        <div
          className="mb-6 p-4 rounded-xs bg-[#190c06]/80 border border-[#4d2d1d] flex flex-wrap items-center justify-between gap-4 text-xs"
          data-testid="painel-epifania-status"
        >
          <div>
            <span className="font-bold text-amber-200 uppercase block">
              Progresso para Epifania (Estágio {currentStage})
            </span>
            <span className="text-stone-400 text-[11px]">
              Meta atual: {epiphanyStatus.requiredPerType} conexão de cada tipo
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" data-testid="count-cause">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-bold">
                Causa: {epiphanyStatus.currentCounts.cause}/{epiphanyStatus.requiredPerType}
              </span>
            </div>

            <div className="flex items-center gap-1.5" data-testid="count-origin">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-sky-400 font-bold">
                Origem: {epiphanyStatus.currentCounts.origin}/{epiphanyStatus.requiredPerType}
              </span>
            </div>

            <div className="flex items-center gap-1.5" data-testid="count-perspective">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-purple-400 font-bold">
                Perspectiva: {epiphanyStatus.currentCounts.perspective}/
                {epiphanyStatus.requiredPerType}
              </span>
            </div>
          </div>
        </div>

        {/* Cartões Post-it de Pistas no Quadro */}
        <div className="mb-8">
          <h2 className="text-xs uppercase font-bold text-amber-200/80 tracking-widest mb-3">
            Pistas Entregues ({clues.length})
          </h2>

          {clues.length === 0 ? (
            <p className="text-xs text-amber-200/50 italic py-6 text-center">
              Nenhuma pista foi entregue à mesa de investigação ainda.
            </p>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              data-testid="grid-pistas-quadro"
            >
              {clues.map((clue, idx) => {
                const rotations = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2"];
                const rot = rotations[idx % rotations.length];

                return (
                  <div
                    key={clue.id}
                    data-testid={`postit-pista-${clue.id}`}
                    className={`relative bg-[#fef9c3] text-stone-900 border border-amber-300 shadow-xl p-4 rounded-xs font-mono transition-transform hover:rotate-0 hover:z-10 ${rot}`}
                  >
                    {/* Tachinha vermelha fixando o post-it */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-600 border border-red-800 shadow-sm flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-300" />
                    </div>

                    <div className="mt-1">
                      <h3 className="text-sm font-black text-stone-900 uppercase tracking-tight line-clamp-2">
                        {clue.title}
                      </h3>
                      <p className="text-xs text-stone-700 mt-2 leading-relaxed">
                        {clue.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-amber-300/80 text-[10px] text-amber-900 flex justify-between">
                      <span>Ref #{clue.id.slice(0, 4)}</span>
                      <span>{clue.deliveredToHabitantId ? "Individual" : "Pública"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Criação de Conexões */}
        {!readOnly && clues.length >= 2 && (
          <div
            className="mb-8 p-4 bg-[#190c06] border border-[#4d2d1d] rounded-xs"
            data-testid="form-criar-conexao"
          >
            <h3 className="text-xs uppercase font-bold text-amber-200 tracking-wider mb-3 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-amber-400" />
              Traçar Fio de Conexão Entre Pistas
            </h3>

            {connError && (
              <div className="mb-3 p-2 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{connError}</span>
              </div>
            )}

            <form onSubmit={handleCreateConnection} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Pista de Origem *</label>
                  <select
                    value={sourceClueId}
                    onChange={(e) => setSourceClueId(e.target.value)}
                    required
                    className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs p-2 rounded-xs focus:outline-none"
                    data-testid="select-pista-origem"
                  >
                    <option value="">Selecione a primeira pista...</option>
                    {clues.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">
                    Pista de Destino *
                  </label>
                  <select
                    value={targetClueId}
                    onChange={(e) => setTargetClueId(e.target.value)}
                    required
                    className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs p-2 rounded-xs focus:outline-none"
                    data-testid="select-pista-destino"
                  >
                    <option value="">Selecione a segunda pista...</option>
                    {clues.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seletor de Tipo de Conexão */}
              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Tipo de Relação *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectionType("cause")}
                    className={`p-2 rounded-xs text-left border text-xs cursor-pointer transition-colors ${
                      connectionType === "cause"
                        ? "bg-emerald-950/70 border-emerald-500 text-emerald-300"
                        : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                    data-testid="btn-conexao-causa"
                  >
                    <span className="font-bold block text-emerald-400">🟢 Causa</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Uma pista causou a outra
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectionType("origin")}
                    className={`p-2 rounded-xs text-left border text-xs cursor-pointer transition-colors ${
                      connectionType === "origin"
                        ? "bg-sky-950/70 border-sky-500 text-sky-300"
                        : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                    data-testid="btn-conexao-origem"
                  >
                    <span className="font-bold block text-sky-400">🔵 Origem</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Compartilham a mesma origem
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectionType("perspective")}
                    className={`p-2 rounded-xs text-left border text-xs cursor-pointer transition-colors ${
                      connectionType === "perspective"
                        ? "bg-purple-950/70 border-purple-500 text-purple-300"
                        : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                    data-testid="btn-conexao-perspectiva"
                  >
                    <span className="font-bold block text-purple-400">🟣 Perspectiva</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Mesma coisa sob pontos de vista distintos
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">
                  Justificativa / Explicação
                </label>
                <input
                  type="text"
                  placeholder="Ex: O martelo do zelador foi usado para romper o cadeado..."
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs p-2 rounded-xs focus:outline-none"
                  data-testid="input-explicacao-conexao"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={connSubmitting || !sourceClueId || !targetClueId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-xs cursor-pointer"
                  data-testid="btn-conectar-pistas"
                >
                  {connSubmitting ? "Conectando..." : "Conectar Pistas"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Conexões Ativas e Filtros */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4d2d1d] pb-2 mb-3">
            <h3 className="text-xs uppercase font-bold text-amber-200/80 tracking-widest">
              Conexões Ativas ({filteredConnections.length})
            </h3>

            {/* Filtros */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] text-stone-400 uppercase mr-1">Filtrar:</span>
              <button
                type="button"
                onClick={() => setSelectedFilter("all")}
                className={`px-2 py-0.5 rounded-xs text-[11px] cursor-pointer ${
                  selectedFilter === "all"
                    ? "bg-amber-500 text-stone-950 font-bold"
                    : "bg-stone-900 text-stone-400 hover:text-stone-200"
                }`}
                data-testid="filtro-todas-conexoes"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("cause")}
                className={`px-2 py-0.5 rounded-xs text-[11px] cursor-pointer ${
                  selectedFilter === "cause"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-stone-900 text-emerald-400 hover:text-emerald-300"
                }`}
                data-testid="filtro-causa"
              >
                Causa
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("origin")}
                className={`px-2 py-0.5 rounded-xs text-[11px] cursor-pointer ${
                  selectedFilter === "origin"
                    ? "bg-sky-600 text-white font-bold"
                    : "bg-stone-900 text-sky-400 hover:text-sky-300"
                }`}
                data-testid="filtro-origem"
              >
                Origem
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("perspective")}
                className={`px-2 py-0.5 rounded-xs text-[11px] cursor-pointer ${
                  selectedFilter === "perspective"
                    ? "bg-purple-600 text-white font-bold"
                    : "bg-stone-900 text-purple-400 hover:text-purple-300"
                }`}
                data-testid="filtro-perspectiva"
              >
                Perspectiva
              </button>
            </div>
          </div>

          {filteredConnections.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-3">
              Nenhuma conexão investigativa encontrada para este filtro.
            </p>
          ) : (
            <div className="space-y-2" data-testid="lista-conexoes-ativas">
              {filteredConnections.map((conn) => {
                const badgeConfig = {
                  cause: {
                    label: "Causa",
                    color: "bg-emerald-950/70 border-emerald-600 text-emerald-300",
                  },
                  origin: {
                    label: "Origem",
                    color: "bg-sky-950/70 border-sky-600 text-sky-300",
                  },
                  perspective: {
                    label: "Perspectiva",
                    color: "bg-purple-950/70 border-purple-600 text-purple-300",
                  },
                }[conn.type];

                return (
                  <div
                    key={conn.id}
                    data-testid={`conexao-item-${conn.id}`}
                    className="p-3 bg-[#190c06] border border-[#4d2d1d] rounded-xs flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-xs border text-[10px] font-bold uppercase ${badgeConfig.color}`}
                        >
                          {badgeConfig.label}
                        </span>
                        <span className="font-bold text-amber-100">
                          {getClueTitle(conn.sourceClueId)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-stone-500" />
                        <span className="font-bold text-amber-100">
                          {getClueTitle(conn.targetClueId)}
                        </span>
                      </div>
                      {conn.explanation && (
                        <p className="text-stone-400 italic text-[11px]">
                          &ldquo;{conn.explanation}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE DECLARAÇÃO DE EPIFANIA */}
      {isEpiphanyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
          data-testid="modal-epifania"
          role="dialog"
          aria-modal="true"
          aria-labelledby="epiphany-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-sm bg-[#0c0d10] border border-amber-600/50 text-zinc-100 font-mono shadow-2xl p-6">
            <button
              type="button"
              onClick={() => setIsEpiphanyModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 text-sm p-1 cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b border-zinc-800 pb-3 mb-4">
              <span className="text-[10px] text-amber-400 uppercase tracking-widest block font-bold">
                CLÍMAX INVESTIGATIVO // MOMENTO DE EPIFANIA
              </span>
              <h2
                id="epiphany-modal-title"
                className="text-xl font-black uppercase text-amber-100 mt-1 flex items-center gap-2"
              >
                <Sparkles className="h-5 w-5 text-amber-400" />
                Declarar Epifania (Estágio {currentStage})
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                O grupo conectou os fatos e vislumbrou a verdade através da névoa.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase font-bold text-zinc-300 block mb-2">
                  Escolha o Efeito da Epifania:
                </label>

                <div className="space-y-2">
                  <label
                    className={`block p-3 border rounded-xs cursor-pointer transition-colors ${
                      chosenEffect === "tear_false_clue"
                        ? "bg-amber-950/40 border-amber-500 text-amber-200"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="epiphanyEffect"
                        value="tear_false_clue"
                        checked={chosenEffect === "tear_false_clue"}
                        onChange={() => setChosenEffect("tear_false_clue")}
                        className="text-amber-500 focus:ring-0"
                        data-testid="radio-efeito-rasgar-pista"
                      />
                      <span className="font-bold text-xs">1. A Voz rasga uma pista falsa</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 pl-6">
                      A Voz deve revelar e destruir imediatamente uma pista falsa da mesa.
                    </p>
                  </label>

                  <label
                    className={`block p-3 border rounded-xs cursor-pointer transition-colors ${
                      chosenEffect === "answer_question"
                        ? "bg-amber-950/40 border-amber-500 text-amber-200"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="epiphanyEffect"
                        value="answer_question"
                        checked={chosenEffect === "answer_question"}
                        onChange={() => setChosenEffect("answer_question")}
                        className="text-amber-500 focus:ring-0"
                        data-testid="radio-efeito-responder-pergunta"
                      />
                      <span className="font-bold text-xs">
                        2. A Voz responde com total honestidade a uma pergunta
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 pl-6">
                      Os redatores formulam uma questão objetiva e a Voz responde a verdade
                      irrefutável.
                    </p>
                  </label>

                  <label
                    className={`block p-3 border rounded-xs cursor-pointer transition-colors ${
                      chosenEffect === "deliver_new_clue"
                        ? "bg-amber-950/40 border-amber-500 text-amber-200"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="epiphanyEffect"
                        value="deliver_new_clue"
                        checked={chosenEffect === "deliver_new_clue"}
                        onChange={() => setChosenEffect("deliver_new_clue")}
                        className="text-amber-500 focus:ring-0"
                        data-testid="radio-efeito-entregar-nova-pista"
                      />
                      <span className="font-bold text-xs">3. A Voz entrega uma nova pista</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 pl-6">
                      Uma nova evidência crucial é imediatamente concedida à mesa.
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Notas da Epifania (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Pergunta formulada ou contexto narrativo..."
                  value={epiphanyNotes}
                  onChange={(e) => setEpiphanyNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                  data-testid="input-notas-epifania"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEpiphanyModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEpiphany}
                  disabled={epiphanySubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xs cursor-pointer shadow-lg"
                  data-testid="btn-confirmar-epifania"
                >
                  {epiphanySubmitting ? "Confirmando..." : "Confirmar Epifania"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
