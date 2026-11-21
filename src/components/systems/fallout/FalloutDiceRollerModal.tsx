"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Modal Rolador de Dados (2d20 & Combat Dice)
// O teste é resolvido no servidor, que cobra AP, credita AP e guarda o teste
// para re-rolagens dado a dado com Pontos de Sorte.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutRollDie,
  type FalloutSkillName,
  type FalloutRollResult,
  type CombatDiceRollResult,
  type FalloutCharacter,
  type FalloutBodyLocation,
} from "@/lib/systems/fallout/types";
import {
  rollCombatDice,
  getCharacterRadiation,
  getExtraDiceApCost,
  getExtraDiceLuckCost,
} from "@/lib/systems/fallout/rules";
import {
  getCombatDieFace,
  getD20Icon,
  getHitLocationIcon,
  type D20DieState,
} from "@/lib/systems/fallout/assets";
import { showDice3D } from "@/lib/dice3d";
import { useSocket } from "@/context/SocketContext";
import { PipBoySlider } from "./PipBoySlider";
import { RadiationConditionChip } from "./RadiationConditionChip";
import {
  Dices,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Flame,
  RotateCw,
  Star,
  Target,
} from "lucide-react";

function dieState(die: FalloutRollDie): D20DieState {
  if (die.isCritical) return "crit";
  if (die.isComplication) return "complication";
  return die.successes > 0 ? "success" : "neutral";
}

interface HitLocation {
  location: string;
  label: string;
  roll: number;
}

/** Resposta de /roll e de /roll/reroll: o servidor já devolve o estado novo. */
interface RollResponse {
  rollId: string;
  rollResult: FalloutRollResult;
  hitLocation: HitLocation | null;
  rerolledIndexes: number[];
  ap: { partyAP: number; maxPartyAP: number; overseerAP: number } | null;
  apCost: number;
  apGenerated: number;
  luckCost: number;
  luckPointsCurrent: number;
  baseDifficulty: number;
}

interface FalloutDiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: FalloutCharacter | null;
  campaignId?: string | null;
  initialAttribute?: FalloutAttribute;
  initialSkill?: FalloutSkillName;
  /** Sorte já debitada no servidor; sincroniza a ficha sem novo PATCH. */
  onLuckSpent?: (luckPointsCurrent: number) => void;
}

export function FalloutDiceRollerModal({
  isOpen,
  onClose,
  character,
  campaignId,
  initialAttribute = "agi",
  initialSkill = "small_guns",
  onLuckSpent,
}: FalloutDiceRollerModalProps) {
  const { rollDice, emitFalloutDiceRoll, emitFalloutApUpdate, subscribeFalloutApUpdate } =
    useSocket();

  const [mode, setMode] = useState<"test2d20" | "combatDice">("test2d20");

  // Estado do Teste 2d20
  const [selectedAttr, setSelectedAttr] = useState<FalloutAttribute>(initialAttribute);
  const [selectedSkill, setSelectedSkill] = useState<FalloutSkillName>(initialSkill);
  const [extraDice, setExtraDice] = useState<number>(0); // 0 a 3 (total 2 a 5d20)
  const [difficulty, setDifficulty] = useState<number>(1);
  const [complicationRange, setComplicationRange] = useState<number>(20);
  const [rollLocation, setRollLocation] = useState<boolean>(true);

  const [last2d20Result, setLast2d20Result] = useState<FalloutRollResult | null>(null);
  const [lastHitLocation, setLastHitLocation] = useState<HitLocation | null>(null);
  const [rollId, setRollId] = useState<string | null>(null);
  const [rerolledIndexes, setRerolledIndexes] = useState<number[]>([]);
  const [rerollingIndex, setRerollingIndex] = useState<number | null>(null);
  const [lastApCost, setLastApCost] = useState(0);
  const [lastApGenerated, setLastApGenerated] = useState(0);
  const [lastLuckCost, setLastLuckCost] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);

  const [partyAP, setPartyAP] = useState(0);
  const [maxPartyAP, setMaxPartyAP] = useState(6);
  const [luckPoints, setLuckPoints] = useState(character?.luckPointsCurrent ?? 0);

  // Estado dos Dados de Combate (DC)
  const [combatDiceCount, setCombatDiceCount] = useState<number>(4);
  const [weaponLabel, setWeaponLabel] = useState<string>("Pistola 10mm");
  const [lastCombatResult, setLastCombatResult] = useState<CombatDiceRollResult | null>(null);

  useEffect(() => {
    setLuckPoints(character?.luckPointsCurrent ?? 0);
  }, [character?.id, character?.luckPointsCurrent]);

  useEffect(() => {
    if (!isOpen || !campaignId) return;
    let active = true;

    fetch(`/api/systems/fallout/campaigns/${campaignId}/ap`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json?.success || !json.data) return;
        setPartyAP(json.data.partyAP);
        setMaxPartyAP(json.data.maxPartyAP || 6);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isOpen, campaignId]);

  useEffect(() => {
    if (!isOpen) return;
    return subscribeFalloutApUpdate((payload) => {
      if (!campaignId || payload.campaignId === campaignId) {
        if (payload.partyAP !== undefined) setPartyAP(payload.partyAP);
      }
    });
  }, [isOpen, campaignId, subscribeFalloutApUpdate]);

  // Valores exibidos: o servidor recalcula tudo a partir da ficha persistida.
  const attrVal = character?.attributes?.[selectedAttr] ?? 6;
  const skillState = character?.skills?.[selectedSkill];
  const skillRank = skillState?.rank ?? 0;
  const isTag = skillState?.isTag ?? character?.tagSkills?.includes(selectedSkill) ?? false;
  const targetNumber = attrVal + skillRank;
  const radiation = character ? getCharacterRadiation(character) : null;
  const effectiveDifficulty = difficulty + (radiation?.difficultyPenalty ?? 0);

  const extraApCost = campaignId ? getExtraDiceApCost(extraDice) : 0;
  const extraLuckCost = campaignId ? 0 : getExtraDiceLuckCost(extraDice);
  const canAffordExtra = campaignId ? partyAP >= extraApCost : luckPoints >= extraLuckCost;

  const broadcastTest = useCallback(
    (result: FalloutRollResult, loc: HitLocation | null, note: string) => {
      if (!campaignId) return;

      const attrName = FALLOUT_ATTRIBUTE_CONFIGS[selectedAttr].shortLabel;
      const skillName = FALLOUT_SKILL_CONFIGS[selectedSkill].label;
      const diceStr = result.dice.map((d) => d.value).join(", ");

      rollDice({
        campaignId,
        actorId: character?.id,
        actorName: character?.name || "Sobrevivente",
        rollType: "pericia",
        formula: `${result.dice.length}d20 (Alvo ${result.targetNumber})${note}`,
        result: result.totalSuccesses,
        diceDetail: `${attrName} + ${skillName}${isTag ? " [TAG]" : ""} | Dados: [${diceStr}] | Sucessos: ${result.totalSuccesses}/${result.difficulty}${
          result.apGenerated > 0 ? ` (+${result.apGenerated} AP)` : ""
        }${result.totalComplications > 0 ? ` | Complicações: ${result.totalComplications}` : ""}${
          loc ? ` | Local: ${loc.label} (${loc.roll})` : ""
        }`,
        hit: result.isSuccess,
        outcome: result.isSuccess ? "success" : "failure",
        isCritical: result.dice.some((d) => d.isCritical),
        hitLocation: loc ? `${loc.label} (${loc.roll})` : undefined,
        dieStates: result.dice.map(dieState),
        rolledDice: result.dice.map((d) => ({ sides: 20 as const, value: d.value })),
        system: "fallout_2d20",
      });

      emitFalloutDiceRoll({
        campaignId,
        actorName: character?.name || "Sobrevivente",
        type: "2d20",
        result,
        hitLocation: loc,
      });
    },
    [
      campaignId,
      character?.id,
      character?.name,
      selectedAttr,
      selectedSkill,
      isTag,
      rollDice,
      emitFalloutDiceRoll,
    ],
  );

  const applyServerState = useCallback(
    (data: RollResponse) => {
      setLast2d20Result(data.rollResult);
      setLastHitLocation(data.hitLocation);
      setRollId(data.rollId);
      setRerolledIndexes(data.rerolledIndexes);
      setLastApCost(data.apCost);
      setLastApGenerated(data.apGenerated);
      setLastLuckCost(data.luckCost);
      setLuckPoints(data.luckPointsCurrent);

      if (data.luckCost > 0) onLuckSpent?.(data.luckPointsCurrent);

      if (data.ap && campaignId) {
        setPartyAP(data.ap.partyAP);
        setMaxPartyAP(data.ap.maxPartyAP || 6);
        emitFalloutApUpdate({
          campaignId,
          partyAP: data.ap.partyAP,
          overseerAP: data.ap.overseerAP,
        });
      }
    },
    [campaignId, emitFalloutApUpdate, onLuckSpent],
  );

  const handleRoll2d20 = async () => {
    if (!character || isRolling || !canAffordExtra) return;

    setIsRolling(true);
    setRollError(null);

    try {
      const res = await fetch("/api/systems/fallout/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          characterId: character.id,
          attribute: selectedAttr,
          skill: selectedSkill,
          difficulty,
          extraDiceCount: extraDice,
          complicationThreshold: complicationRange,
          rollLocation,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setRollError(json?.error || "Não foi possível executar o teste");
        return;
      }

      const data: RollResponse = json.data;
      applyServerState(data);
      showDice3D(data.rollResult.dice.map((d) => ({ sides: 20 as const, value: d.value })));
      broadcastTest(data.rollResult, data.hitLocation, "");
    } catch {
      setRollError("Sem conexão com o servidor");
    } finally {
      setIsRolling(false);
    }
  };

  const handleRerollDie = async (dieIndex: number) => {
    if (!rollId || rerollingIndex !== null) return;

    setRerollingIndex(dieIndex);
    setRollError(null);

    try {
      const res = await fetch("/api/systems/fallout/roll/reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rollId, dieIndex }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setRollError(json?.error || "Não foi possível re-rolar o dado");
        return;
      }

      const data: RollResponse = json.data;
      applyServerState(data);
      showDice3D([{ sides: 20 as const, value: data.rollResult.dice[dieIndex].value }]);
      broadcastTest(data.rollResult, data.hitLocation, " · Sorte");
    } catch {
      setRollError("Sem conexão com o servidor");
    } finally {
      setRerollingIndex(null);
    }
  };

  const handleRollCombatDice = () => {
    const result = rollCombatDice(combatDiceCount);
    setLastCombatResult(result);

    showDice3D(
      result.dice.map((d) => ({
        sides: 6 as const,
        value: d.dieValue,
      })),
    );

    if (campaignId) {
      const facesStr = result.dice
        .map((d) => (d.effect ? `${d.damage}+⚡` : `${d.damage}`))
        .join(", ");

      rollDice({
        campaignId,
        actorId: character?.id,
        actorName: character?.name || "Sobrevivente",
        rollType: "ataque",
        formula: `${combatDiceCount} DC (${weaponLabel})`,
        result: result.totalDamage,
        damage: result.totalDamage,
        diceDetail: `${weaponLabel}: ${result.totalDamage} de Dano e ${result.totalEffects} Efeito(s) [${facesStr}]`,
        rolledDice: result.dice.map((d) => ({ sides: 6 as const, value: d.dieValue })),
        system: "fallout_2d20",
      });
    }
  };

  const canReroll = !!last2d20Result && !last2d20Result.isSuccess && luckPoints > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Terminal de Rolagem Pip-Boy 2d20">
      <div className="relative flex max-h-[calc(100dvh-5rem)] flex-col font-mono text-emerald-400 bg-black/90 border border-emerald-500/40 rounded-lg p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar rolador"
          title="Fechar"
          className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-black/70 text-xs text-emerald-400 hover:border-emerald-300 hover:text-emerald-200 cursor-pointer"
        >
          ✕
        </button>
        <div className="pipboy-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Seletor de Modo */}
          <div className="grid grid-cols-2 gap-2 border-b border-emerald-500/30 pb-3 pr-8">
            <button
              type="button"
              onClick={() => setMode("test2d20")}
              className={`py-2 px-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                mode === "test2d20"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  : "bg-black/50 border-emerald-900/60 text-emerald-600 hover:text-emerald-400"
              }`}
            >
              <Dices size={15} />
              Teste de Perícia (2d20)
            </button>
            <button
              type="button"
              onClick={() => setMode("combatDice")}
              className={`py-2 px-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                mode === "combatDice"
                  ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  : "bg-black/50 border-emerald-900/60 text-emerald-600 hover:text-amber-400"
              }`}
            >
              <Flame size={15} />
              Dados de Combate (DC)
            </button>
          </div>

          {mode === "test2d20" ? (
            <div className="space-y-4">
              {/* Seleção de Atributo e Perícia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase text-emerald-500 mb-1">
                    Atributo S.P.E.C.I.A.L.
                  </label>
                  <select
                    aria-label="Atributo S.P.E.C.I.A.L."
                    value={selectedAttr}
                    onChange={(e) => setSelectedAttr(e.target.value as FalloutAttribute)}
                    className="w-full bg-emerald-950/30 border border-emerald-500/50 rounded px-2.5 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
                  >
                    {FALLOUT_ATTRIBUTES.map((attr) => (
                      <option key={attr} value={attr} className="bg-zinc-950 text-emerald-300">
                        {FALLOUT_ATTRIBUTE_CONFIGS[attr].shortLabel} —{" "}
                        {FALLOUT_ATTRIBUTE_CONFIGS[attr].label} (
                        {character?.attributes?.[attr] ?? 6})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-emerald-500 mb-1">
                    Perícia
                  </label>
                  <select
                    aria-label="Perícia"
                    value={selectedSkill}
                    onChange={(e) => {
                      const sk = e.target.value as FalloutSkillName;
                      setSelectedSkill(sk);
                      setSelectedAttr(FALLOUT_SKILL_CONFIGS[sk].defaultAttribute);
                    }}
                    className="w-full bg-emerald-950/30 border border-emerald-500/50 rounded px-2.5 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
                  >
                    {FALLOUT_SKILLS.map((sk) => {
                      const cfg = FALLOUT_SKILL_CONFIGS[sk];
                      const rk = character?.skills?.[sk]?.rank ?? 0;
                      const tagged =
                        character?.skills?.[sk]?.isTag || character?.tagSkills?.includes(sk);
                      return (
                        <option key={sk} value={sk} className="bg-zinc-950 text-emerald-300">
                          {cfg.label} (Rank {rk}){tagged ? " ★ TAG" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Painel de Alvo (Target Number) */}
              <div className="flex items-center justify-between gap-3 bg-emerald-950/30 border border-emerald-500/40 rounded p-3">
                <div>
                  <div className="text-[10px] uppercase text-emerald-500">
                    Número Alvo (Atributo + Perícia)
                  </div>
                  <div className="text-xl font-bold text-emerald-300">
                    TN {targetNumber}{" "}
                    <span className="text-xs font-normal text-emerald-400">
                      ({attrVal} + {skillRank})
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-emerald-500">Margem Crítica</div>
                  <div className="text-sm font-bold text-amber-300">
                    {isTag ? `1 a ${Math.max(1, skillRank)} (★ TAG)` : "1 Natural"}
                  </div>
                  {radiation && radiation.difficultyPenalty > 0 && (
                    <RadiationConditionChip condition={radiation} className="mt-1" />
                  )}
                </div>
              </div>

              {/* Recursos disponíveis: AP da equipe ou Pontos de Sorte */}
              <div className="flex flex-wrap items-center gap-2 rounded border border-emerald-500/30 bg-black/60 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Zap size={12} />
                  {campaignId ? (
                    <>
                      AP da Equipe:{" "}
                      <strong data-testid="roller-party-ap">
                        {partyAP}/{maxPartyAP}
                      </strong>
                    </>
                  ) : (
                    <span className="text-emerald-500">Ficha avulsa — sem pool de AP</span>
                  )}
                </span>
                <span className="h-3.5 w-px bg-emerald-500/30" aria-hidden="true" />
                <span className="flex items-center gap-1.5 text-amber-200">
                  <Star size={12} />
                  Pontos de Sorte:{" "}
                  <strong data-testid="roller-luck">
                    {luckPoints}/{character?.attributes?.luc ?? 0}
                  </strong>
                </span>
                {radiation && radiation.difficultyPenalty > 0 && (
                  <>
                    <span className="h-3.5 w-px bg-emerald-500/30" aria-hidden="true" />
                    <span className="text-orange-300">
                      Radiação: +{radiation.difficultyPenalty} de Dificuldade
                    </span>
                  </>
                )}
              </div>

              {/* Parâmetros do teste em sliders temáticos do Pip-Boy */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <PipBoySlider
                  label="Dificuldade"
                  icon={<Target size={12} />}
                  min={0}
                  max={5}
                  value={difficulty}
                  onChange={setDifficulty}
                  readout={effectiveDifficulty}
                  ticks={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))}
                  hint={
                    difficulty === 0
                      ? "Sem sucessos exigidos (teste automático)"
                      : `Exige ${effectiveDifficulty} sucesso(s) no teste`
                  }
                />

                <PipBoySlider
                  label="Dados Extras"
                  icon={<Dices size={12} />}
                  min={0}
                  max={3}
                  value={extraDice}
                  onChange={setExtraDice}
                  readout={`${2 + extraDice}d20`}
                  ticks={[0, 1, 2, 3].map((v) => ({ value: v, label: `${2 + v}d20` }))}
                  hint={
                    extraDice === 0 ? (
                      "Rolagem padrão sem custo"
                    ) : campaignId ? (
                      <>
                        Custo:{" "}
                        <span
                          className={`font-bold ${canAffordExtra ? "text-amber-300" : "text-red-400"}`}
                        >
                          {extraApCost} AP
                        </span>
                        {!canAffordExtra && " — pool insuficiente"}
                      </>
                    ) : (
                      <>
                        Custo:{" "}
                        <span
                          className={`font-bold ${canAffordExtra ? "text-amber-300" : "text-red-400"}`}
                        >
                          {extraLuckCost} Sorte
                        </span>
                        {!canAffordExtra && " — Sorte insuficiente"}
                      </>
                    )
                  }
                />

                <PipBoySlider
                  label="Complicação"
                  icon={<AlertTriangle size={12} />}
                  min={18}
                  max={20}
                  value={complicationRange}
                  onChange={setComplicationRange}
                  readout={complicationRange === 20 ? "20" : `${complicationRange}-20`}
                  ticks={[18, 19, 20].map((v) => ({ value: v, label: String(v) }))}
                  hint={
                    complicationRange === 20
                      ? "Complica apenas em 20 natural"
                      : `Complica em resultados ${complicationRange}-20`
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rollLocation}
                  onChange={(e) => setRollLocation(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Rolar dado de Localização de Acerto (1d20)</span>
              </label>

              <button
                type="button"
                onClick={() => void handleRoll2d20()}
                disabled={!character || isRolling || !canAffordExtra}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-widest rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRolling ? "Processando no servidor..." : `Executar Teste (${2 + extraDice}d20)`}
              </button>

              {rollError && (
                <p
                  data-testid="fallout-roll-error"
                  role="alert"
                  className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300"
                >
                  {rollError}
                </p>
              )}

              {/* Resultado do Teste */}
              {last2d20Result && (
                <div
                  data-testid="fallout-2d20-result"
                  className={`p-3 rounded border space-y-2 ${
                    last2d20Result.isSuccess
                      ? "bg-emerald-950/40 border-emerald-400"
                      : "bg-red-950/40 border-red-500/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm flex items-center gap-1.5">
                      {last2d20Result.isSuccess ? (
                        <>
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-emerald-300">SUCESSO NO TESTE!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} className="text-red-400" />
                          <span className="text-red-300">FALHA NO TESTE</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs font-bold">
                      Sucessos: {last2d20Result.totalSuccesses} / {last2d20Result.difficulty}
                    </span>
                  </div>

                  {/* Oferta de re-rolagem com Pontos de Sorte */}
                  {!last2d20Result.isSuccess && (
                    <p
                      data-testid="luck-reroll-hint"
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] ${
                        canReroll
                          ? "border-amber-500/50 bg-amber-950/30 text-amber-200"
                          : "border-zinc-700 bg-black/40 text-zinc-400"
                      }`}
                    >
                      <Star size={12} className={canReroll ? "text-amber-300" : "text-zinc-500"} />
                      {canReroll
                        ? `Gaste 1 Ponto de Sorte por dado para re-rolar (${luckPoints} disponível(is)).`
                        : "Sem Pontos de Sorte para re-rolar este teste."}
                    </p>
                  )}

                  {/* Dados individuais + re-rolagem por dado */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {last2d20Result.dice.map((d, idx) => {
                      const state = dieState(d);
                      const alreadyRerolled = rerolledIndexes.includes(idx);
                      const eligible = canReroll && !alreadyRerolled;

                      return (
                        <div key={idx} className="flex w-14 flex-col items-center gap-1">
                          <div
                            className="relative h-11 w-11"
                            title={
                              d.isCritical
                                ? "Acerto Crítico (2 sucessos)"
                                : d.isComplication
                                  ? "Complicação!"
                                  : d.successes > 0
                                    ? "Sucesso"
                                    : "Falha"
                            }
                          >
                            <img
                              src={getD20Icon(state)}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 h-full w-full"
                            />
                            <span
                              className={`absolute inset-0 flex items-center justify-center text-sm font-black ${
                                state === "complication" ? "text-white" : "text-zinc-900"
                              }`}
                            >
                              {d.value}
                            </span>
                            {d.isCritical && (
                              <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[9px] font-black text-black shadow">
                                ★2
                              </span>
                            )}
                            {alreadyRerolled && (
                              <span
                                title="Dado re-rolado com Ponto de Sorte"
                                className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-black shadow"
                              >
                                <RotateCw size={9} />
                              </span>
                            )}
                          </div>

                          {eligible && (
                            <button
                              type="button"
                              onClick={() => void handleRerollDie(idx)}
                              disabled={rerollingIndex !== null}
                              aria-label={`Re-rolar dado ${idx + 1} por 1 Ponto de Sorte`}
                              title="Re-rolar este dado por 1 Ponto de Sorte"
                              data-testid={`luck-reroll-${idx}`}
                              className="flex w-full items-center justify-center gap-0.5 rounded border border-amber-500/60 bg-amber-950/50 py-0.5 text-[9px] font-bold uppercase text-amber-200 transition-colors hover:bg-amber-900/60 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCw
                                size={9}
                                className={rerollingIndex === idx ? "animate-spin" : ""}
                              />
                              1
                              <Star size={8} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-emerald-500/20">
                    <span className="flex flex-wrap items-center gap-2">
                      {lastApCost > 0 && (
                        <span className="text-red-300 font-bold flex items-center gap-1">
                          <Zap size={12} /> -{lastApCost} AP do pool
                        </span>
                      )}
                      {lastLuckCost > 0 && (
                        <span className="text-amber-200 font-bold flex items-center gap-1">
                          <Star size={12} /> -{lastLuckCost} Sorte
                        </span>
                      )}
                      {lastApGenerated > 0 ? (
                        <span
                          data-testid="fallout-ap-generated"
                          className="text-amber-300 font-bold flex items-center gap-1"
                        >
                          <Zap size={12} /> +{lastApGenerated} AP para a equipe!
                        </span>
                      ) : (
                        <span className="text-emerald-500/70">0 AP gerado</span>
                      )}
                    </span>

                    {lastHitLocation && (
                      <span className="text-emerald-200 flex items-center gap-1.5">
                        <img
                          src={getHitLocationIcon(lastHitLocation.location as FalloutBodyLocation)}
                          alt=""
                          aria-hidden="true"
                          className="h-6 w-6"
                        />
                        Local: <strong>{lastHitLocation.label}</strong> ({lastHitLocation.roll})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Modo Dados de Combate (DC) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase text-amber-400 mb-1">
                    Arma / Ataque
                  </label>
                  <input
                    type="text"
                    value={weaponLabel}
                    onChange={(e) => setWeaponLabel(e.target.value)}
                    className="w-full bg-black border border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-amber-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-amber-400 mb-1">
                    Quantidade de Dados (DC)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={combatDiceCount}
                    onChange={(e) => setCombatDiceCount(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-black border border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-amber-200"
                  />
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/30 rounded p-2.5 space-y-1.5">
                <div className="text-[11px] text-amber-300/80">Faces do Dado de Combate (DC):</div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map((face) => (
                    <img
                      key={face}
                      src={getCombatDieFace(face)}
                      alt={`Face ${face}`}
                      className="h-7 w-7"
                    />
                  ))}
                </div>
                <div className="text-[10px] text-amber-300/70">
                  1 = 1 dano · 2 = 2 danos · 3-4 = 0 · 5-6 = 1 dano + efeito ⚡
                </div>
              </div>

              <button
                type="button"
                onClick={handleRollCombatDice}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-widest rounded transition-colors cursor-pointer"
              >
                Rolar {combatDiceCount} Dados de Combate (DC)
              </button>

              {lastCombatResult && (
                <div
                  data-testid="fallout-combat-result"
                  className="p-3 rounded border bg-amber-950/30 border-amber-400 space-y-2 text-amber-200"
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>Dano Total: {lastCombatResult.totalDamage}</span>
                    <span className="text-amber-300">
                      Efeitos ⚡: {lastCombatResult.totalEffects}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lastCombatResult.dice.map((d, i) => (
                      <div
                        key={i}
                        className="relative h-9 w-9"
                        title={`Face ${d.dieValue}: ${d.damage} de dano${d.effect ? " + efeito" : ""}`}
                      >
                        <img
                          src={getCombatDieFace(d.dieValue)}
                          alt={`Dado de combate: ${d.damage} de dano`}
                          className="h-full w-full"
                        />
                        {d.effect && (
                          <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-0.5 text-[9px] font-black text-black shadow">
                            ⚡
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
