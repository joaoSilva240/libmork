"use client";

import React, { useState } from "react";
import {
  Skull,
  ShieldAlert,
  Plus,
  Send,
  EyeOff,
  Users,
  FileText,
  AlertCircle,
  Trash2,
  Minus,
} from "lucide-react";
import type {
  MissingScene,
  MissingThreat,
  MissingClue,
  MissingHabitant,
  DangerLevel,
} from "@/lib/systems/missing/types";
import type { CreateClueInput } from "@/lib/systems/missing/validators";
import { reduceThreatDanger, validateSceneDanger } from "@/lib/systems/missing/rules";

export interface MissingVoicePanelProps {
  campaignId: string;
  activeScene: MissingScene;
  clues: MissingClue[];
  habitants: MissingHabitant[];
  onUpdateScene?: (scene: MissingScene) => Promise<void> | void;
  onCreateClue?: (clue: CreateClueInput) => Promise<void> | void;
  onDeliverClue?: (clueId: string, habitantId: string | null) => Promise<void> | void;
  className?: string;
}

export function MissingVoicePanel({
  campaignId,
  activeScene,
  clues = [],
  habitants = [],
  onUpdateScene,
  onCreateClue,
  onDeliverClue,
  className = "",
}: MissingVoicePanelProps) {
  // Estado para Gestão de Cena e Ameaças
  const [sceneTitle, setSceneTitle] = useState(activeScene.title || "Cena Atual");
  const [threats, setThreats] = useState<MissingThreat[]>(activeScene.threats || []);
  const [isAddingThreat, setIsAddingThreat] = useState(false);
  const [newThreatName, setNewThreatName] = useState("");
  const [newThreatDesc, setNewThreatDesc] = useState("");
  const [newThreatDanger, setNewThreatDanger] = useState<DangerLevel>(1);
  const [threatError, setThreatError] = useState<string | null>(null);

  // Estado para Criação de Pistas
  const [newClueTitle, setNewClueTitle] = useState("");
  const [newClueDesc, setNewClueDesc] = useState("");
  const [isFalseClue, setIsFalseClue] = useState(false);
  const [clueSubmitting, setClueSubmitting] = useState(false);

  // Estado para Entrega de Pistas
  const [deliveryTargets, setDeliveryTargets] = useState<Record<string, string>>({});

  // Cálculo de Perigo Total
  const totalDanger = threats.reduce((sum, t) => sum + (t.dangerLevel || 0), 0);
  const isDangerMaxed = totalDanger >= 3;

  // Sincroniza e emite alterações de cena
  const emitSceneUpdate = async (updatedThreats: MissingThreat[], title = sceneTitle) => {
    setThreats(updatedThreats);
    if (onUpdateScene) {
      await onUpdateScene({
        ...activeScene,
        title,
        threats: updatedThreats,
      });
      return;
    }
    if (campaignId) {
      try {
        await fetch(`/api/systems/missing/campaigns/${campaignId}/scenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneTitle: title,
            threats: updatedThreats,
          }),
        });
      } catch {
        // Fallback silencioso em ambiente de teste
      }
    }
  };

  const handleAddThreat = async () => {
    setThreatError(null);
    const name = newThreatName.trim();
    if (!name) {
      setThreatError("Nome da ameaça é obrigatório.");
      return;
    }

    if (totalDanger + newThreatDanger > 3) {
      setThreatError("A soma dos níveis de perigo das ameaças na cena não pode ultrapassar 3.");
      return;
    }

    const newThreat: MissingThreat = {
      id: `threat-${Date.now()}`,
      name,
      description: newThreatDesc.trim() || undefined,
      dangerLevel: newThreatDanger,
    };

    const updatedThreats = [...threats, newThreat];
    await emitSceneUpdate(updatedThreats);
    setNewThreatName("");
    setNewThreatDesc("");
    setNewThreatDanger(1);
    setIsAddingThreat(false);
  };

  const handleReduceThreat = async (threatId: string) => {
    const threat = threats.find((t) => t.id === threatId);
    if (!threat) return;

    const { newDangerLevel, isTerminated } = reduceThreatDanger(threat);
    let updatedThreats: MissingThreat[];

    if (isTerminated) {
      updatedThreats = threats.filter((t) => t.id !== threatId);
    } else {
      updatedThreats = threats.map((t) =>
        t.id === threatId ? { ...t, dangerLevel: newDangerLevel as DangerLevel } : t,
      );
    }

    await emitSceneUpdate(updatedThreats);
  };

  const handleRemoveThreat = async (threatId: string) => {
    const updatedThreats = threats.filter((t) => t.id !== threatId);
    await emitSceneUpdate(updatedThreats);
  };

  const handleCreateClue = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newClueTitle.trim();
    const description = newClueDesc.trim();
    if (!title || !description) return;

    setClueSubmitting(true);
    const clueInput: CreateClueInput = {
      title,
      description,
      isFalseClue,
      deliveredToHabitantId: null,
    };

    try {
      if (onCreateClue) {
        await onCreateClue(clueInput);
      } else if (campaignId) {
        await fetch(`/api/systems/missing/campaigns/${campaignId}/clues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clueInput),
        });
      }
      setNewClueTitle("");
      setNewClueDesc("");
      setIsFalseClue(false);
    } catch {
      // Ignorar fallback
    } finally {
      setClueSubmitting(false);
    }
  };

  const handleDeliverClue = async (clueId: string) => {
    const targetValue = deliveryTargets[clueId] ?? "public";
    const targetHabitantId = targetValue === "public" ? null : targetValue;

    if (onDeliverClue) {
      await onDeliverClue(clueId, targetHabitantId);
      return;
    }

    if (campaignId) {
      try {
        await fetch(`/api/systems/missing/campaigns/${campaignId}/clues/${clueId}/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetHabitantId }),
        });
      } catch {
        // Fallback
      }
    }
  };

  return (
    <div
      className={`space-y-8 rounded-lg bg-[#0a0a0c] p-4 sm:p-6 text-zinc-200 font-mono border border-zinc-800 shadow-2xl ${className}`}
      data-testid="missing-voice-panel"
    >
      {/* Header do Painel da Voz */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-red-500" />
          <span className="text-xs uppercase tracking-widest text-red-500 font-bold">
            PAINEL EXCLUSIVO // A VOZ (MESTRE)
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-100 mt-1">
          Controle da Voz
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Gestão de cena, ameaças, cofre de pistas e monitor de habitantes.
        </p>
      </div>

      {/* SEÇÃO 1: Gestão de Cena & Ameaças */}
      <section
        className="rounded-sm bg-zinc-950 p-4 sm:p-5 border border-zinc-800"
        data-testid="secao-gestao-cena"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-4">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
              CENA ATIVA
            </span>
            <h2 className="text-lg font-bold text-zinc-100 uppercase">{sceneTitle}</h2>
          </div>

          {/* Contador de Perigo Total com Bloqueio Estrito */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs border font-bold text-xs uppercase tracking-wider ${
                isDangerMaxed
                  ? "bg-red-950/60 border-red-700 text-red-400"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300"
              }`}
              data-testid="contador-perigo-cena"
            >
              <Skull className="h-4 w-4 text-rose-500" />
              <span>Perigo Total da Cena: {totalDanger} / 3</span>
            </div>

            {/* Botão Adicionar Ameaça */}
            <button
              type="button"
              onClick={() => setIsAddingThreat(true)}
              disabled={isDangerMaxed}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-rose-500"
              data-testid="btn-adicionar-ameaca"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Ameaça
            </button>
          </div>
        </div>

        {/* Formulário para Adicionar Nova Ameaça */}
        {isAddingThreat && (
          <div
            className="mb-4 p-3 bg-zinc-900 border border-zinc-700 rounded-xs space-y-3"
            data-testid="form-nova-ameaca"
          >
            <h3 className="text-xs font-bold uppercase text-zinc-300">Nova Ameaça na Cena</h3>

            {threatError && (
              <div
                className="p-2 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xs flex items-center gap-2"
                data-testid="erro-ameaca"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{threatError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Nome da Ameaça *</label>
                <input
                  type="text"
                  placeholder="Ex: Criatura na Névoa, Ruído no Porão..."
                  value={newThreatName}
                  onChange={(e) => setNewThreatName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                  data-testid="input-nome-ameaca"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Nível de Perigo (1, 2 ou 3) *
                </label>
                <select
                  value={newThreatDanger}
                  onChange={(e) => setNewThreatDanger(Number(e.target.value) as DangerLevel)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                  data-testid="select-perigo-ameaca"
                >
                  <option value={1}>Perigo 1</option>
                  <option value={2}>Perigo 2</option>
                  <option value={3}>Perigo 3</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Descrição (opcional)</label>
              <input
                type="text"
                placeholder="Detalhes narrativos ou manifestação do horror..."
                value={newThreatDesc}
                onChange={(e) => setNewThreatDesc(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddingThreat(false);
                  setThreatError(null);
                }}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddThreat}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-xs cursor-pointer"
                data-testid="btn-salvar-ameaca"
              >
                Salvar Ameaça
              </button>
            </div>
          </div>
        )}

        {/* Lista de Ameaças */}
        {threats.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">Nenhuma ameaça ativa na cena atual.</p>
        ) : (
          <div className="space-y-2" data-testid="lista-ameacas">
            {threats.map((threat) => (
              <div
                key={threat.id}
                data-testid={`ameaca-item-${threat.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 text-xs sm:text-sm">
                      {threat.name}
                    </span>
                    <span
                      className="inline-block bg-rose-950/70 border border-rose-800 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-xs"
                      data-testid={`perigo-badge-${threat.id}`}
                    >
                      Perigo {threat.dangerLevel}
                    </span>
                  </div>
                  {threat.description && (
                    <p className="text-xs text-zinc-400 mt-0.5">{threat.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReduceThreat(threat.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-xs font-bold cursor-pointer"
                    title="Reduzir perigo em 1 (Ganho de habitante contra a ameaça)"
                    data-testid={`btn-reduzir-perigo-${threat.id}`}
                  >
                    <Minus className="h-3 w-3" />
                    Reduzir Perigo (-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveThreat(threat.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                    title="Encerrar ameaça"
                    data-testid={`btn-remover-ameaca-${threat.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 2: Cofre de Pistas */}
      <section
        className="rounded-sm bg-zinc-950 p-4 sm:p-5 border border-zinc-800"
        data-testid="secao-cofre-pistas"
      >
        <div className="border-b border-zinc-800 pb-3 mb-4">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
            ARQUIVO DE EVIDÊNCIAS
          </span>
          <h2 className="text-lg font-bold text-zinc-100 uppercase">Cofre de Pistas</h2>
        </div>

        {/* Formulário de Criação de Pistas */}
        <form
          onSubmit={handleCreateClue}
          className="mb-6 space-y-3 bg-zinc-900/50 p-4 rounded-xs border border-zinc-800"
        >
          <h3 className="text-xs font-bold uppercase text-zinc-300">Criar Nova Pista</h3>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Título da Pista *</label>
              <input
                type="text"
                placeholder="Ex: Fotografia Desbotada, Bilhete Manuscrito..."
                value={newClueTitle}
                onChange={(e) => setNewClueTitle(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                data-testid="input-titulo-pista"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Descrição da Pista *</label>
              <textarea
                placeholder="Detalhes factuais ou descritivos da evidência..."
                value={newClueDesc}
                onChange={(e) => setNewClueDesc(e.target.value)}
                required
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                data-testid="textarea-descricao-pista"
              />
            </div>

            {/* Checkbox: Pista Falsa (Privado da Voz) */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFalseClue}
                  onChange={(e) => setIsFalseClue(e.target.checked)}
                  className="rounded-xs border-zinc-700 text-red-600 focus:ring-0"
                  data-testid="checkbox-pista-falsa"
                />
                <span className="text-xs text-red-400 font-bold uppercase tracking-wider">
                  Pista Falsa (Privado da Voz)
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={clueSubmitting || !newClueTitle.trim() || !newClueDesc.trim()}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xs cursor-pointer border border-rose-500"
              data-testid="btn-criar-pista"
            >
              {clueSubmitting ? "Criando..." : "Criar Pista"}
            </button>
          </div>
        </form>

        {/* Lista de Pistas no Cofre */}
        <div className="space-y-3" data-testid="lista-pistas-cofre">
          <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
            Pistas Registradas ({clues.length})
          </h3>

          {clues.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">Nenhuma pista no cofre no momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clues.map((clue) => {
                const targetValue =
                  deliveryTargets[clue.id] ?? clue.deliveredToHabitantId ?? "public";
                const deliveredHabitant = habitants.find(
                  (h) => h.id === clue.deliveredToHabitantId,
                );

                return (
                  <div
                    key={clue.id}
                    data-testid={`pista-item-${clue.id}`}
                    className="p-3 bg-zinc-900 border border-zinc-800 rounded-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-200">{clue.title}</h4>
                        {clue.isFalseClue && (
                          <span
                            className="inline-block bg-red-950/80 border border-red-700 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-xs shrink-0"
                            data-testid={`badge-pista-falsa-${clue.id}`}
                          >
                            [Pista Falsa]
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-snug">{clue.description}</p>
                    </div>

                    {/* Estado e Ação de Entrega */}
                    <div className="border-t border-zinc-800 pt-2 space-y-2">
                      <div className="text-[10px] text-zinc-500">
                        Status de entrega:{" "}
                        <span className="text-zinc-300 font-bold">
                          {clue.deliveredToHabitantId === null
                            ? "Mesa Inteira (Público)"
                            : deliveredHabitant
                              ? `Entregue a ${deliveredHabitant.name}`
                              : "No cofre"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={targetValue}
                          onChange={(e) =>
                            setDeliveryTargets((prev) => ({
                              ...prev,
                              [clue.id]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-zinc-950 border border-zinc-700 text-zinc-200 text-[11px] p-1.5 rounded-xs focus:outline-none"
                          data-testid={`select-entrega-${clue.id}`}
                        >
                          <option value="public">Mesa Inteira (Público)</option>
                          {habitants.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} (Secreto)
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDeliverClue(clue.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xs cursor-pointer shrink-0"
                          data-testid={`btn-entregar-pista-${clue.id}`}
                        >
                          Entregar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 3: Monitor de Habitantes */}
      <section
        className="rounded-sm bg-zinc-950 p-4 sm:p-5 border border-zinc-800"
        data-testid="secao-monitor-habitantes"
      >
        <div className="border-b border-zinc-800 pb-3 mb-4">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
            SUPERVISÃO DE SUJEITOS
          </span>
          <h2 className="text-lg font-bold text-zinc-100 uppercase">
            Monitor de Habitantes ({habitants.length})
          </h2>
        </div>

        {habitants.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">
            Nenhum habitante registrado nesta campanha.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {habitants.map((h) => {
              const total = h.lines.length;
              const activeLines = h.lines.filter((l) => !l.isErased).length;
              const activeEqs = h.equipments.filter((e) => e.status === "active").length;
              const isMissing = h.status === "missing" || activeLines === 0;

              return (
                <div
                  key={h.id}
                  data-testid={`monitor-habitant-${h.id}`}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-zinc-100 truncate">
                      {h.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase ${
                        isMissing
                          ? "bg-red-950 text-red-500 border border-red-800"
                          : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      }`}
                    >
                      {isMissing ? "Desaparecido" : "Ativo"}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>
                      Linhas Restantes:{" "}
                      <span
                        className="font-bold text-zinc-200"
                        data-testid={`linhas-restantes-${h.id}`}
                      >
                        {activeLines}/{total}
                      </span>
                    </div>
                    <div>
                      Equipamentos Ativos:{" "}
                      <span
                        className="font-bold text-zinc-200"
                        data-testid={`equipamentos-ativos-${h.id}`}
                      >
                        {activeEqs}/3
                      </span>
                    </div>
                  </div>

                  {/* Badges de equipamentos */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {h.equipments.map((eq) => (
                      <span
                        key={eq.id}
                        className={`text-[9px] px-1.5 py-0.5 rounded-xs font-mono ${
                          eq.status === "lost"
                            ? "bg-zinc-800 text-zinc-600 line-through"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {eq.name || `Slot ${eq.slot}`}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
