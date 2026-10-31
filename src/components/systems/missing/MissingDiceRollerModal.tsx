"use client";

import React, { useState } from "react";
import { Dices, AlertTriangle, Quote, ShieldCheck, Flame, Check, X } from "lucide-react";
import type {
  MissingHabitant,
  MissingThreat,
  TestType,
  DiceOutcome,
  TestResult,
  ForcedTestResult,
} from "@/lib/systems/missing/types";
import {
  roll1d6,
  roll2d6,
  resolveTest,
  resolveForcedTest,
  calculateErasuresOnLoss,
} from "@/lib/systems/missing/rules";

export interface MissingDiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitant: MissingHabitant;
  campaignId?: string;
  activeThreats?: MissingThreat[];
  onRollComplete?: (result: unknown) => void;
  className?: string;
}

export function MissingDiceRollerModal({
  isOpen,
  onClose,
  habitant,
  campaignId,
  activeThreats = [],
  onRollComplete,
  className = "",
}: MissingDiceRollerModalProps) {
  const [testType, setTestType] = useState<TestType>("common");
  const [quotedLine, setQuotedLine] = useState<string | null>(null);
  const [isQuotingOpen, setIsQuotingOpen] = useState(false);
  const [supportGains, setSupportGains] = useState<number>(0);
  const [isForced, setIsForced] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{
    type: "standard" | "forced";
    standardResult?: TestResult;
    forcedResult?: ForcedTestResult;
    outcome: DiceOutcome;
    dice: number[];
    selectedDie: number;
    effectiveTotal: number;
    equipmentLost?: boolean;
    erasuresCount: number;
    details: string;
  } | null>(null);

  if (!isOpen) return null;

  const activeEquipments = habitant.equipments.filter((e) => e.status === "active");
  const activeLines = habitant.lines.filter((l) => !l.isErased);

  const activeThreatsSum = activeThreats.reduce((sum, t) => sum + (t.dangerLevel || 0), 0);

  const handleExecuteRoll = async () => {
    setIsRolling(true);

    try {
      // Tentar chamada via API se houver campaignId
      if (campaignId) {
        try {
          const bodyPayload: Record<string, unknown> = {
            habitantId: habitant.id,
            type: testType,
            supportGains,
            forced: isForced,
          };
          if (quotedLine) {
            bodyPayload.quotedLine = quotedLine;
          }
          if (isForced && selectedEquipmentId) {
            bodyPayload.equipmentId = selectedEquipmentId;
          }

          const response = await fetch(`/api/systems/missing/campaigns/${campaignId}/rolls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          });

          if (response.ok) {
            const json = await response.json();
            const data = json.data;
            const outcome: DiceOutcome =
              data.rollType === "forced" ? data.forcedResult.outcome : data.originalResult.outcome;

            const parsedResult = {
              type: data.rollType as "standard" | "forced",
              standardResult: data.originalResult,
              forcedResult: data.forcedResult,
              outcome,
              dice:
                data.rollType === "forced"
                  ? [...data.originalResult.dice, data.forcedResult.forcedDie]
                  : data.originalResult.dice,
              selectedDie:
                data.rollType === "forced"
                  ? data.forcedResult.newSelectedDie
                  : data.originalResult.selectedDie,
              effectiveTotal:
                data.rollType === "forced"
                  ? data.forcedResult.effectiveTotal
                  : data.originalResult.effectiveTotal,
              equipmentLost: Boolean(data.forcedResult?.equipmentLost),
              erasuresCount: data.erasuresCount ?? (outcome === "loss" ? 1 + activeThreatsSum : 0),
              details:
                data.rollType === "forced"
                  ? data.forcedResult.details
                  : data.originalResult.details,
            };

            setRollResult(parsedResult);
            if (onRollComplete) onRollComplete(data);
            setIsRolling(false);
            return;
          }
        } catch {
          // Em caso de falha de rede ou ambiente de teste unitário, realiza fallback local
        }
      }

      // Resolução local direta via Motor de Regras MISSING
      const dice = testType === "common" ? [roll1d6()] : roll2d6();
      const standardResult = resolveTest({
        type: testType,
        dice,
        supportGains,
      });

      if (isForced && selectedEquipmentId) {
        const eq = habitant.equipments.find((e) => e.id === selectedEquipmentId);
        if (!eq || eq.status !== "active") {
          throw new Error("Equipamento selecionado inválido ou inativo.");
        }
        const forcedDie = roll1d6();
        const forcedResult = resolveForcedTest({
          originalResult: standardResult,
          forcedDie,
          equipment: eq,
        });

        const erasuresCount =
          forcedResult.outcome === "loss" ? calculateErasuresOnLoss(activeThreats) : 0;

        const resultObj = {
          type: "forced" as const,
          standardResult,
          forcedResult,
          outcome: forcedResult.outcome,
          dice: [...standardResult.dice, forcedDie],
          selectedDie: forcedResult.newSelectedDie,
          effectiveTotal: forcedResult.effectiveTotal,
          equipmentLost: forcedResult.equipmentLost,
          erasuresCount,
          details: forcedResult.details,
        };

        setRollResult(resultObj);
        if (onRollComplete) onRollComplete(resultObj);
      } else {
        const erasuresCount =
          standardResult.outcome === "loss" ? calculateErasuresOnLoss(activeThreats) : 0;

        const resultObj = {
          type: "standard" as const,
          standardResult,
          outcome: standardResult.outcome,
          dice: standardResult.dice,
          selectedDie: standardResult.selectedDie,
          effectiveTotal: standardResult.effectiveTotal,
          erasuresCount,
          details: standardResult.details,
        };

        setRollResult(resultObj);
        if (onRollComplete) onRollComplete(resultObj);
      }
    } catch (err: unknown) {
      console.error("Erro na resolução do teste:", err);
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      data-testid="missing-dice-roller-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dice-modal-title"
    >
      <div
        className={`relative w-full max-w-xl rounded-sm bg-[#0a0a0c] border border-zinc-800 text-zinc-100 font-mono shadow-2xl p-6 ${className}`}
      >
        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 text-sm p-1 cursor-pointer"
          aria-label="Fechar"
          data-testid="btn-fechar-modal-dados"
        >
          ✕
        </button>

        {/* Título */}
        <div className="border-b border-zinc-800 pb-3 mb-5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
            SISTEMA DE RESOLUÇÃO // ANALOG DICE ROLLER
          </span>
          <h2
            id="dice-modal-title"
            className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2 mt-0.5"
          >
            <Dices className="h-6 w-6 text-rose-500" />
            Teste de Habitante
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Habitante: <span className="font-bold text-zinc-200">{habitant.name}</span>
          </p>
        </div>

        {/* Seção 1: Seleção de Tipo de Teste */}
        <div className="mb-5">
          <label className="text-xs uppercase font-bold text-zinc-400 tracking-wider block mb-2">
            Tipo de Teste
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setTestType("common");
                setQuotedLine(null);
                setRollResult(null);
              }}
              className={`p-3 rounded-xs text-center border text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                testType === "common"
                  ? "bg-zinc-800 border-zinc-500 text-white shadow-inner"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
              data-testid="btn-teste-comum"
            >
              Comum
              <span className="block text-[10px] font-normal lowercase text-zinc-400 mt-0.5">
                (1d6)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTestType("probable");
                setRollResult(null);
              }}
              className={`p-3 rounded-xs text-center border text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                testType === "probable"
                  ? "bg-zinc-800 border-zinc-500 text-white shadow-inner"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
              data-testid="btn-teste-provavel"
            >
              Provável
              <span className="block text-[10px] font-normal lowercase text-zinc-400 mt-0.5">
                (2d6 - Maior)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTestType("improbable");
                setQuotedLine(null);
                setRollResult(null);
              }}
              className={`p-3 rounded-xs text-center border text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                testType === "improbable"
                  ? "bg-zinc-800 border-zinc-500 text-white shadow-inner"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
              data-testid="btn-teste-improvavel"
            >
              Improvável
              <span className="block text-[10px] font-normal lowercase text-zinc-400 mt-0.5">
                (2d6 - Menor)
              </span>
            </button>
          </div>

          {/* Justificativa por Familiaridade para Teste Provável */}
          {testType === "probable" && (
            <div className="mt-3 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Familiaridade com a ação:</span>
                <button
                  type="button"
                  onClick={() => setIsQuotingOpen(!isQuotingOpen)}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  data-testid="btn-citar-frase"
                >
                  <Quote className="h-3 w-3" />
                  Citar frase do Registro
                </button>
              </div>

              {quotedLine && (
                <div
                  className="mt-2 text-xs text-amber-200/90 italic bg-amber-950/20 p-2 border-l-2 border-amber-600"
                  data-testid="citacao-selecionada"
                >
                  &ldquo;{quotedLine}&rdquo;
                </div>
              )}

              {isQuotingOpen && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-zinc-800 pt-2">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                    Escolha uma memória ativa:
                  </span>
                  {activeLines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => {
                        setQuotedLine(line.text);
                        setIsQuotingOpen(false);
                      }}
                      className="w-full text-left p-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-xs truncate block cursor-pointer"
                      data-testid={`opcao-frase-${line.index}`}
                    >
                      {line.index}. {line.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seção 2: Participantes de Apoio */}
        <div className="mb-5 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                Apoio de Outros Habitantes
              </span>
              <p className="text-[11px] text-zinc-500">
                +1 no maior dado por cada Ganho de apoio oferecido.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSupportGains(Math.max(0, supportGains - 1))}
                className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold rounded-xs cursor-pointer"
                data-testid="btn-diminuir-apoio"
              >
                -
              </button>
              <span
                className="w-8 text-center font-bold text-sm text-zinc-100"
                data-testid="valor-apoio"
              >
                {supportGains}
              </span>
              <button
                type="button"
                onClick={() => setSupportGains(supportGains + 1)}
                className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold rounded-xs cursor-pointer"
                data-testid="btn-aumentar-apoio"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Seção 3: Forçar Teste com Equipamento */}
        <div className="mb-6 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xs">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isForced}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsForced(checked);
                  if (checked && !selectedEquipmentId && activeEquipments.length > 0) {
                    setSelectedEquipmentId(activeEquipments[0].id);
                  }
                }}
                disabled={activeEquipments.length === 0}
                className="rounded-xs border-zinc-700 text-rose-600 focus:ring-0"
                data-testid="checkbox-forcar-teste"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Forçar Teste (Arriscar Equipamento)
              </span>
            </label>
            {activeEquipments.length === 0 && (
              <span className="text-[10px] text-amber-500 font-bold">Sem equipamentos ativos</span>
            )}
          </div>

          {isForced && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Selecione o equipamento a arriscar:
                </label>
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs p-2 rounded-xs focus:outline-none"
                  data-testid="select-equipamento-forcado"
                >
                  {activeEquipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      Slot {eq.slot}: {eq.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alerta Visual de Risco de Perda Permanente */}
              <div
                className="flex items-start gap-2 p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xs"
                data-testid="alerta-forcar-teste"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span>
                  Se o resultado for Perda, este equipamento será permanentemente inutilizado.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Rolagem */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleExecuteRoll}
            disabled={isRolling || (isForced && !selectedEquipmentId)}
            className="w-full py-3 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm rounded-xs border border-rose-500 shadow-lg shadow-rose-950/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            data-testid="btn-confirmar-rolagem"
          >
            <Dices className="h-5 w-5" />
            {isRolling ? "Rolando Dados..." : "Rolar Dados"}
          </button>
        </div>

        {/* Apresentação do Resultado */}
        {rollResult && (
          <div
            className="p-4 bg-black/90 border border-zinc-700 rounded-xs space-y-4"
            data-testid="painel-resultado-rolagem"
          >
            {/* Dados Rolados e Selecionado */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Dados Rolados</span>
                <div className="flex gap-2 mt-1">
                  {rollResult.dice.map((dieVal, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-xs font-black text-base border ${
                        dieVal === rollResult.selectedDie
                          ? "bg-zinc-200 text-zinc-950 border-white shadow-md shadow-white/10"
                          : "bg-zinc-900 text-zinc-400 border-zinc-700"
                      }`}
                      data-testid={`dado-rolado-${idx}`}
                    >
                      {dieVal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block">Dado Selecionado</span>
                <span className="text-lg font-black text-zinc-100" data-testid="dado-selecionado">
                  {rollResult.selectedDie}
                </span>
                {rollResult.effectiveTotal !== rollResult.selectedDie && (
                  <span className="text-xs text-zinc-400 block">
                    Total Efetivo: {rollResult.effectiveTotal}
                  </span>
                )}
              </div>
            </div>

            {/* Selo Gigante de Ganho ou Perda */}
            <div className="flex flex-col items-center justify-center py-2">
              {rollResult.outcome === "gain" ? (
                <div
                  className="border-4 border-emerald-500 text-emerald-400 bg-emerald-950/40 uppercase font-black tracking-widest text-2xl sm:text-3xl px-8 py-3 rotate-[-3deg] shadow-lg shadow-emerald-950/50 select-none text-center"
                  data-testid="selo-resultado-ganho"
                >
                  GANHO (Sucesso)
                </div>
              ) : (
                <div
                  className="border-4 border-rose-600 text-rose-500 bg-rose-950/50 uppercase font-black tracking-widest text-2xl sm:text-3xl px-8 py-3 rotate-[-3deg] shadow-lg shadow-rose-950/50 select-none text-center"
                  data-testid="selo-resultado-perda"
                >
                  PERDA (Falha)
                </div>
              )}
            </div>

            {/* Mensagem em caso de Perda */}
            {rollResult.outcome === "loss" && (
              <div
                className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xs text-center font-bold"
                data-testid="aviso-perda-rasuras"
              >
                Ação gerou Perda: Rasurar 1 linha (+ {activeThreatsSum} das ameaças ativas da cena).
              </div>
            )}

            {/* Equipamento perdido se foi forçado */}
            {rollResult.equipmentLost && (
              <div
                className="p-2.5 bg-zinc-900 border border-rose-800 text-rose-400 text-xs rounded-xs font-bold text-center"
                data-testid="aviso-equipamento-inutilizado"
              >
                Equipamento utilizado foi permanentemente danificado / inutilizado.
              </div>
            )}

            {/* Detalhes narrativos */}
            <p className="text-[11px] text-zinc-400 italic text-center">{rollResult.details}</p>
          </div>
        )}
      </div>
    </div>
  );
}
