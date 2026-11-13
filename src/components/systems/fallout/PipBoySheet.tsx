"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Ficha Pip-Boy 3000 (STAT / SPECIAL / INV / DATA)
// =============================================================================

import React, { useState } from "react";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutBodyLocation,
  type FalloutBodyPart,
  type FalloutCharacter,
  type FalloutSkillName,
} from "@/lib/systems/fallout/types";
import {
  calculateEffectiveMaxHp,
  calculateDefense,
  calculateInitiative,
  calculateCarryWeightMax,
} from "@/lib/systems/fallout/rules";
import {
  getFalloutItemIcon,
  getFalloutOriginIcon,
  getFalloutPerkIcon,
} from "@/lib/systems/fallout/assets";
import { PipBoyPaperdoll } from "./PipBoyPaperdoll";
import { PipBoyPortrait } from "./PipBoyPortrait";
import { PipBoyRollFab } from "./PipBoyRollFab";
import { APTrackerWidget } from "./APTrackerWidget";
import { FalloutDiceRollerModal } from "./FalloutDiceRollerModal";
import { PipBoyTabNav } from "./PipBoyTabNav";
import {
  Heart,
  Biohazard,
  Shield,
  Zap,
  Coins,
  Package,
  Star,
  Activity,
  Database,
} from "lucide-react";

const PIPBOY_TABS = [
  { id: "stat", label: "STAT", icon: <Activity className="h-5 w-5" /> },
  { id: "special", label: "S.P.E.C.I.A.L.", icon: <Star className="h-5 w-5" /> },
  { id: "inv", label: "INV", icon: <Package className="h-5 w-5" /> },
  { id: "data", label: "DATA", icon: <Database className="h-5 w-5" /> },
] as const;

type PipBoyTabId = (typeof PIPBOY_TABS)[number]["id"];

interface PipBoySheetProps {
  character: FalloutCharacter;
  onUpdateCharacter?: (patch: Partial<FalloutCharacter>) => void;
  readOnly?: boolean;
  isMaster?: boolean;
}

export function PipBoySheet({
  character,
  onUpdateCharacter,
  readOnly = false,
  isMaster = false,
}: PipBoySheetProps) {
  const [activeTab, setActiveTab] = useState<PipBoyTabId>("stat");
  const [isRollerOpen, setIsRollerOpen] = useState(false);
  const [rollerInitialAttr, setRollerInitialAttr] = useState<FalloutAttribute>("agi");
  const [rollerInitialSkill, setRollerInitialSkill] = useState<FalloutSkillName>("small_guns");

  const effectiveMaxHp = calculateEffectiveMaxHp(character.hpMax, character.radiation);
  const radPercent = Math.min(
    100,
    Math.round((character.radiation / Math.max(1, character.hpMax)) * 100),
  );
  const hpPercent = Math.min(
    100 - radPercent,
    Math.round((character.hpCurrent / Math.max(1, character.hpMax)) * 100),
  );

  const handleAdjustCaps = (delta: number) => {
    if (readOnly || !onUpdateCharacter) return;
    onUpdateCharacter({ caps: Math.max(0, character.caps + delta) });
  };

  const handleUpdateBodyPart = (location: FalloutBodyLocation, patch: Partial<FalloutBodyPart>) => {
    if (readOnly || !onUpdateCharacter) return;
    const updatedParts = {
      ...character.bodyParts,
      [location]: {
        ...character.bodyParts[location],
        ...patch,
      },
    };
    onUpdateCharacter({ bodyParts: updatedParts });
  };

  const handleToggleTagSkill = (skill: FalloutSkillName) => {
    if (readOnly || !onUpdateCharacter) return;
    const currentSkill = character.skills[skill] || { name: skill, rank: 0, isTag: false };
    const nextTag = !currentSkill.isTag;
    const nextTagList = nextTag
      ? [...new Set([...character.tagSkills, skill])]
      : character.tagSkills.filter((s) => s !== skill);

    onUpdateCharacter({
      tagSkills: nextTagList,
      skills: {
        ...character.skills,
        [skill]: { ...currentSkill, isTag: nextTag },
      },
    });
  };

  const openSkillRoll = (skill: FalloutSkillName) => {
    const defaultAttr = FALLOUT_SKILL_CONFIGS[skill].defaultAttribute;
    setRollerInitialAttr(defaultAttr);
    setRollerInitialSkill(skill);
    setIsRollerOpen(true);
  };

  return (
    <div
      data-testid="pipboy-sheet"
      className="bg-zinc-950 border-2 border-emerald-500/50 rounded-xl p-4 pb-28 font-mono text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.12)] space-y-4"
    >
      {/* Cabeçalho Pip-Boy 3000 — retrato do personagem criado + identificação */}
      <div className="flex items-center gap-3 pb-3 border-b border-emerald-500/40">
        <PipBoyPortrait character={character} className="h-24 w-20" />
        <div className="min-w-0">
          <span className="text-xs text-emerald-500 uppercase">
            Nível {character.level} • {character.origin.replace(/_/g, " ")}
          </span>
          <h2 className="text-xl font-bold text-emerald-200 tracking-wider mt-1 truncate">
            {character.name}
          </h2>
        </div>
      </div>

      {/* Navegação por Abas do Pip-Boy — padrão BottomNav tematizado */}
      <PipBoyTabNav
        tabs={PIPBOY_TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as PipBoyTabId)}
      />

      {/* ABA STAT: Saúde, Radiação, AP da Equipe e stats derivadas */}
      {activeTab === "stat" && (
        <div className="space-y-3">
          {/* Barra Combinada de HP + Radiação */}
          <div className="bg-black/70 border border-emerald-500/40 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Heart size={15} className="text-emerald-400" />
                <span className="font-bold text-emerald-200">
                  PV: {character.hpCurrent} / {effectiveMaxHp}
                </span>
                <span className="text-[11px] text-emerald-500">(Teto Base: {character.hpMax})</span>
              </div>

              <div className="flex items-center gap-2">
                <Biohazard size={15} className="text-red-400" />
                <span className="font-bold text-red-400">RADS: {character.radiation}</span>
              </div>
            </div>

            {/* Barra Visual de PV (Verde) e Radiação (Vermelho no final da barra) */}
            <div className="w-full h-3.5 bg-zinc-900 border border-emerald-700/60 rounded overflow-hidden flex">
              <div
                style={{ width: `${hpPercent}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title={`PV Atuais: ${character.hpCurrent}`}
              />
              <div className="flex-1 bg-zinc-900" />
              {radPercent > 0 && (
                <div
                  style={{ width: `${radPercent}%` }}
                  className="bg-red-600/90 transition-all duration-300"
                  title={`Radiação acumulada: ${character.radiation}`}
                />
              )}
            </div>
          </div>

          {/* AP da Equipe — logo abaixo do PV do jogador */}
          <APTrackerWidget campaignId={character.campaignId} isMaster={isMaster} />

          {/* Estatísticas Derivadas em linha única */}
          <div className="pipboy-scrollbar flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap rounded-lg border border-emerald-500/30 bg-black/60 px-3 py-2 text-[11px]">
            <span className="flex items-center gap-1.5" title="Defesa">
              <Shield size={13} className="text-emerald-400" />
              <span className="uppercase text-emerald-500">Defesa</span>
              <strong className="text-emerald-200">
                {calculateDefense(character.attributes.agi)}
              </strong>
            </span>
            <span className="h-4 w-px shrink-0 bg-emerald-500/30" aria-hidden="true" />
            <span className="flex items-center gap-1.5" title="Iniciativa">
              <Zap size={13} className="text-emerald-400" />
              <span className="uppercase text-emerald-500">Iniciativa</span>
              <strong className="text-emerald-200">
                {calculateInitiative(character.attributes.per, character.attributes.agi)}
              </strong>
            </span>
            <span className="h-4 w-px shrink-0 bg-emerald-500/30" aria-hidden="true" />
            <span className="flex items-center gap-1.5" title="Pontos de Sorte">
              <Star size={13} className="text-amber-300" />
              <span className="uppercase text-emerald-500">Sorte</span>
              <strong className="text-amber-300">
                {character.luckPointsCurrent} / {character.attributes.luc}
              </strong>
            </span>
            <span className="h-4 w-px shrink-0 bg-emerald-500/30" aria-hidden="true" />
            <span className="flex items-center gap-1.5" title="Tampas (Caps)">
              <Coins size={13} className="text-amber-400" />
              <span className="uppercase text-emerald-500">Caps</span>
              <strong className="text-amber-400">{character.caps}</strong>
            </span>
          </div>

          {/* Atributos S.P.E.C.I.A.L. (movidos da aba SPECIAL) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-2">
              S.P.E.C.I.A.L.
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {FALLOUT_ATTRIBUTES.map((attr) => {
                const cfg = FALLOUT_ATTRIBUTE_CONFIGS[attr];
                const val = character.attributes[attr] ?? 5;
                return (
                  <div
                    key={attr}
                    className="bg-black/70 border border-emerald-500/40 rounded p-2.5 text-center"
                    title={cfg.description}
                  >
                    <div className="text-[10px] font-bold uppercase text-emerald-500">
                      {cfg.shortLabel}
                    </div>
                    <div className="text-2xl font-extrabold text-emerald-200 my-1">{val}</div>
                    <div className="text-[10px] text-emerald-400/80 truncate">{cfg.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA S.P.E.C.I.A.L.: 17 Perícias (os 7 atributos ficam na aba STAT) */}
      {activeTab === "special" && (
        <div className="space-y-4">
          {/* Lista das 17 Perícias Oficiais */}
          <div className="bg-black/70 border border-emerald-500/40 rounded-lg p-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-2 pb-1.5 border-b border-emerald-500/30">
              Perícias &amp; Especializações (Tag Skills ★)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {FALLOUT_SKILLS.map((sk) => {
                const cfg = FALLOUT_SKILL_CONFIGS[sk];
                const state = character.skills[sk] || { name: sk, rank: 0, isTag: false };
                const isTag = state.isTag || character.tagSkills.includes(sk);
                const attrVal = character.attributes[cfg.defaultAttribute] ?? 5;
                const tn = attrVal + state.rank;

                return (
                  <div
                    key={sk}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${
                      isTag
                        ? "bg-emerald-950/40 border-emerald-400/60 text-emerald-200"
                        : "bg-black/50 border-emerald-900/40 text-emerald-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleToggleTagSkill(sk)}
                        className={`text-xs cursor-pointer ${
                          isTag ? "text-amber-400" : "text-emerald-800 hover:text-emerald-500"
                        }`}
                        title="Alternar Tag Skill (Crítico em dados <= Rank)"
                      >
                        ★
                      </button>
                      <span className="font-semibold truncate">{cfg.label}</span>
                      <span className="text-[10px] text-emerald-600 uppercase">
                        ({cfg.defaultAttribute.toUpperCase()})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-emerald-300 font-bold">
                        Rank {state.rank} (TN {tn})
                      </span>
                      <button
                        type="button"
                        onClick={() => openSkillRoll(sk)}
                        data-testid={`btn-roll-skill-${sk}`}
                        title={`Rolar ${cfg.label}`}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold uppercase cursor-pointer"
                      >
                        Rolar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA INV: Inventário, Carga e Tampas */}
      {activeTab === "inv" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-black/70 border border-emerald-500/40 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2">
              <Package size={15} />
              <span>
                Capacidade de Carga Máxima:{" "}
                <strong>{calculateCarryWeightMax(character.attributes.str)} lbs</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={15} className="text-amber-400" />
              <span className="text-amber-300 font-bold">Tampas: {character.caps}</span>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustCaps(-10)}
                    className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-200 cursor-pointer"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustCaps(10)}
                    className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-200 cursor-pointer"
                  >
                    +10
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-black/70 border border-emerald-500/40 rounded-lg p-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-2">
              Equipamentos &amp; Suprimentos ({character.items.length})
            </h4>
            {character.items.length === 0 ? (
              <p className="text-xs text-emerald-600 italic">
                Nenhum equipamento registrado no Pip-Boy.
              </p>
            ) : (
              <div className="space-y-1.5">
                {character.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded border border-emerald-900/50 bg-black/50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={getFalloutItemIcon(item.type)}
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                      />
                      <span className="font-bold text-emerald-200">{item.name}</span>
                      <span className="text-[10px] uppercase text-emerald-500">[{item.type}]</span>
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      {item.weight} lbs • {item.costCaps} Tampas
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monitor de Membros & Armadura (movido para o Inventário) */}
          <PipBoyPaperdoll
            bodyParts={character.bodyParts}
            onUpdateBodyPart={handleUpdateBodyPart}
            readOnly={readOnly}
            actorKind={character.origin === "mister_handy" ? "robot" : "character"}
          />
        </div>
      )}

      {/* ABA DATA: Perks, Origem e Progressão */}
      {activeTab === "data" && (
        <div className="bg-black/70 border border-emerald-500/40 rounded-lg p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
            <span className="flex items-center gap-1.5">
              <img src={getFalloutOriginIcon()} alt="" aria-hidden="true" className="h-4 w-4" />
              Origem: <strong className="uppercase">{character.origin.replace(/_/g, " ")}</strong>
            </span>
            <span>
              XP Acumulado: <strong>{character.xp} XP</strong>
            </span>
          </div>

          <div>
            <h4 className="font-bold uppercase tracking-wider text-emerald-300 mb-1.5 flex items-center gap-1.5">
              <img src={getFalloutPerkIcon()} alt="" aria-hidden="true" className="h-4 w-4" />
              Vantagens (Perks) &amp; Características
            </h4>
            {character.perks.length === 0 ? (
              <p className="text-emerald-600 italic">Nenhuma vantagem registrada.</p>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-emerald-300">
                {character.perks.map((perk, idx) => (
                  <li key={idx}>{perk}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante circular de rolagem (dado d20) acima do dock */}
      <PipBoyRollFab onClick={() => setIsRollerOpen(true)} />

      <FalloutDiceRollerModal
        isOpen={isRollerOpen}
        onClose={() => setIsRollerOpen(false)}
        character={character}
        campaignId={character.campaignId}
        initialAttribute={rollerInitialAttr}
        initialSkill={rollerInitialSkill}
      />
    </div>
  );
}
