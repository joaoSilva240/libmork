"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Modal Rolador de Dados (2d20 & Combat Dice)
// Suporta compra de dados extras com AP, Tag Skills, Localização e Dados 3D
// =============================================================================

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutSkillName,
  type FalloutRollResult,
  type CombatDiceRollResult,
  type FalloutCharacter,
  type FalloutBodyLocation,
} from "@/lib/systems/fallout/types";
import { roll2d20, rollCombatDice, calculateHitLocation } from "@/lib/systems/fallout/rules";
import {
  getCombatDieFace,
  getD20Icon,
  getHitLocationIcon,
  type D20DieState,
} from "@/lib/systems/fallout/assets";
import { showDice3D } from "@/lib/dice3d";
import { useSocket } from "@/context/SocketContext";
import { Dices, Zap, AlertTriangle, CheckCircle2, Flame } from "lucide-react";

interface FalloutDiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: FalloutCharacter | null;
  campaignId?: string | null;
  initialAttribute?: FalloutAttribute;
  initialSkill?: FalloutSkillName;
  onApGenerated?: (apCount: number) => void;
}

export function FalloutDiceRollerModal({
  isOpen,
  onClose,
  character,
  campaignId,
  initialAttribute = "agi",
  initialSkill = "small_guns",
  onApGenerated,
}: FalloutDiceRollerModalProps) {
  const { rollDice, emitFalloutDiceRoll } = useSocket();

  const [mode, setMode] = useState<"test2d20" | "combatDice">("test2d20");

  // Estado do Teste 2d20
  const [selectedAttr, setSelectedAttr] = useState<FalloutAttribute>(initialAttribute);
  const [selectedSkill, setSelectedSkill] = useState<FalloutSkillName>(initialSkill);
  const [extraDice, setExtraDice] = useState<number>(0); // 0 a 3 (total 2 a 5d20)
  const [difficulty, setDifficulty] = useState<number>(1);
  const [complicationRange, setComplicationRange] = useState<number>(20);
  const [rollLocation, setRollLocation] = useState<boolean>(true);

  const [last2d20Result, setLast2d20Result] = useState<FalloutRollResult | null>(null);
  const [lastHitLocation, setLastHitLocation] = useState<{
    location: string;
    label: string;
    roll: number;
  } | null>(null);

  // Estado dos Dados de Combate (DC)
  const [combatDiceCount, setCombatDiceCount] = useState<number>(4);
  const [weaponLabel, setWeaponLabel] = useState<string>("Pistola 10mm");
  const [lastCombatResult, setLastCombatResult] = useState<CombatDiceRollResult | null>(null);

  // Valores extraídos do personagem (ou padrão)
  const attrVal = character?.attributes?.[selectedAttr] ?? 6;
  const skillState = character?.skills?.[selectedSkill];
  const skillRank = skillState?.rank ?? 2;
  const isTag = skillState?.isTag ?? character?.tagSkills?.includes(selectedSkill) ?? false;
  const targetNumber = attrVal + skillRank;

  const handleRoll2d20 = () => {
    const result = roll2d20({
      attributeValue: attrVal,
      skillRank,
      isTagSkill: isTag,
      extraDiceCount: extraDice,
      difficulty,
      complicationThreshold: complicationRange,
    });

    const loc = rollLocation ? calculateHitLocation() : null;

    setLast2d20Result(result);
    setLastHitLocation(loc);

    // Dispara dados 3D na tela
    showDice3D(
      result.dice.map((d) => ({
        sides: 20 as const,
        value: d.value,
      })),
    );

    if (result.apGenerated > 0 && onApGenerated) {
      onApGenerated(result.apGenerated);
    }

    const attrName = FALLOUT_ATTRIBUTE_CONFIGS[selectedAttr].shortLabel;
    const skillName = FALLOUT_SKILL_CONFIGS[selectedSkill].label;
    const diceStr = result.dice.map((d) => d.value).join(", ");

    if (campaignId) {
      rollDice({
        campaignId,
        actorId: character?.id,
        actorName: character?.name || "Sobrevivente",
        rollType: "pericia",
        formula: `${result.dice.length}d20 (Alvo ${targetNumber})`,
        result: result.totalSuccesses,
        diceDetail: `${attrName} + ${skillName}${isTag ? " [TAG]" : ""} | Dados: [${diceStr}] | Sucessos: ${result.totalSuccesses}/${difficulty}${
          result.apGenerated > 0 ? ` (+${result.apGenerated} AP)` : ""
        }${result.totalComplications > 0 ? ` | Complicações: ${result.totalComplications}` : ""}${
          loc ? ` | Local: ${loc.label} (${loc.roll})` : ""
        }`,
        hit: result.isSuccess,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Terminal de Rolagem Pip-Boy 2d20">
      <div className="font-mono text-emerald-400 bg-black/90 border border-emerald-500/40 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-500/40 pb-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">
            Terminal de Rolagem Pip-Boy 2d20
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-emerald-500 hover:text-emerald-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
        {/* Seletor de Modo */}
        <div className="grid grid-cols-2 gap-2 border-b border-emerald-500/30 pb-3">
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
                      {FALLOUT_ATTRIBUTE_CONFIGS[attr].label} ({character?.attributes?.[attr] ?? 6})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase text-emerald-500 mb-1">Perícia</label>
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
            <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/40 rounded p-3">
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
              </div>
            </div>

            {/* Parâmetros de Dificuldade e Dados Extras */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] uppercase text-emerald-500 mb-1">
                  Dificuldade (0-5)
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full bg-black border border-emerald-600/50 rounded px-2 py-1 text-xs text-emerald-200"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-emerald-500 mb-1">
                  Dados Extras (+AP)
                </label>
                <select
                  aria-label="Dados Extras"
                  value={extraDice}
                  onChange={(e) => setExtraDice(Number(e.target.value))}
                  className="w-full bg-black border border-emerald-600/50 rounded px-2 py-1 text-xs text-emerald-200"
                >
                  <option value={0}>2d20 (Padrão)</option>
                  <option value={1}>3d20 (+1 AP)</option>
                  <option value={2}>4d20 (+3 AP)</option>
                  <option value={3}>5d20 (+6 AP)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-emerald-500 mb-1">
                  Complicação
                </label>
                <select
                  value={complicationRange}
                  onChange={(e) => setComplicationRange(Number(e.target.value))}
                  className="w-full bg-black border border-emerald-600/50 rounded px-2 py-1 text-xs text-emerald-200"
                >
                  <option value={20}>20</option>
                  <option value={19}>19-20</option>
                  <option value={18}>18-20</option>
                </select>
              </div>
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
              onClick={handleRoll2d20}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-widest rounded transition-colors cursor-pointer"
            >
              Executar Teste ({2 + extraDice}d20)
            </button>

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

                {/* Dados individuais */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {last2d20Result.dice.map((d, idx) => {
                    const state: D20DieState = d.isCritical
                      ? "crit"
                      : d.isComplication
                        ? "complication"
                        : d.successes > 0
                          ? "success"
                          : "neutral";
                    return (
                      <div
                        key={idx}
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
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-500/20">
                  {last2d20Result.apGenerated > 0 ? (
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Zap size={12} /> +{last2d20Result.apGenerated} AP Gerado(s)!
                    </span>
                  ) : (
                    <span className="text-emerald-500/70">0 AP gerado</span>
                  )}

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
    </Modal>
  );
}
