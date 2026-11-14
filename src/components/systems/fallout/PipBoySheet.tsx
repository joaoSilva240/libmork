"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Ficha Pip-Boy 3000 (STAT / SPECIAL / INV / DATA)
// =============================================================================

import React, { useState } from "react";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_DEFAULT_BODY_PARTS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutBodyLocation,
  type FalloutBodyPart,
  type FalloutCharacter,
  type FalloutCharacterPerk,
  type FalloutItem,
  type FalloutSkillName,
} from "@/lib/systems/fallout/types";
import {
  adjustFalloutPerkRank,
  calculateEffectiveMaxHp,
  calculateDefense,
  calculateInitiative,
  calculateCarryWeightMax,
  normalizeFalloutPerk,
} from "@/lib/systems/fallout/rules";
import {
  getFalloutItemIcon,
  getFalloutOriginIcon,
  getFalloutPerkIcon,
} from "@/lib/systems/fallout/assets";
import { FALLOUT_DAMAGE_TYPE_LABELS } from "@/lib/systems/fallout/itemCatalog";
import { generateUUID } from "@/lib/utils/uuid";
import { PipBoyPaperdoll } from "./PipBoyPaperdoll";
import { PipBoyPortrait } from "./PipBoyPortrait";
import { PipBoyRollFab } from "./PipBoyRollFab";
import { APTrackerWidget } from "./APTrackerWidget";
import { FalloutDiceRollerModal } from "./FalloutDiceRollerModal";
import { PipBoyPerkPickerModal } from "./PipBoyPerkPickerModal";
import { PipBoyItemPickerModal } from "./PipBoyItemPickerModal";
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
  Plus,
  Minus,
  X,
  ChevronDown,
} from "lucide-react";

const PIPBOY_TABS = [
  { id: "stat", label: "STAT", icon: <Activity className="h-5 w-5" /> },
  { id: "special", label: "S.P.E.C.I.A.L.", icon: <Star className="h-5 w-5" /> },
  { id: "inv", label: "INV", icon: <Package className="h-5 w-5" /> },
  { id: "data", label: "DATA", icon: <Database className="h-5 w-5" /> },
] as const;

type PipBoyTabId = (typeof PIPBOY_TABS)[number]["id"];

const ITEM_RANGE_LABELS: Record<string, string> = {
  close: "Curto",
  medium: "Médio",
  long: "Longo",
  extreme: "Extremo",
};

/** Estatísticas completas do item exibidas no accordion da aba INV. */
function PipBoyItemStats({ item }: { item: FalloutItem }) {
  if (item.type === "weapon") {
    return (
      <div className="space-y-1 text-[11px] text-emerald-400">
        <p>
          Dano: <span className="text-emerald-200">{item.damageDiceRating} DC</span> (
          {FALLOUT_DAMAGE_TYPE_LABELS[item.damageType] ?? item.damageType})
        </p>
        {item.qualities.length > 0 && (
          <p>
            Qualidades: <span className="text-emerald-300">{item.qualities.join(", ")}</span>
          </p>
        )}
        {item.damageEffects.length > 0 && (
          <p>
            Efeitos: <span className="text-emerald-300">{item.damageEffects.join(", ")}</span>
          </p>
        )}
        <p className="text-emerald-500">
          Munição: {item.ammoType ?? "—"} • Cadência: {item.fireRate} • Alcance:{" "}
          {ITEM_RANGE_LABELS[item.range] ?? item.range}
        </p>
      </div>
    );
  }

  if (item.type === "apparel") {
    const rd = item.resistances;
    return (
      <div className="space-y-1 text-[11px] text-emerald-400">
        <p>
          RD: Físico {rd.physical} • Energia {rd.energy} • Radiação {rd.radiation} • Veneno{" "}
          {rd.poison}
        </p>
        <p className="text-emerald-500">
          Cobre:{" "}
          {item.locationsCovered.length > 0
            ? item.locationsCovered.map((loc) => FALLOUT_DEFAULT_BODY_PARTS[loc].label).join(", ")
            : "—"}
        </p>
      </div>
    );
  }

  if (item.type === "consumable") {
    return (
      <div className="space-y-1 text-[11px] text-emerald-400">
        <p className="text-emerald-500">
          Categoria: {item.category} • Quantidade: {item.quantity}
        </p>
        {item.hpRestored ? <p>Restaura {item.hpRestored} HP</p> : null}
        {item.addictive && <p className="text-amber-400">Potencialmente viciante</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[11px] text-emerald-400">
      {item.description && <p className="leading-relaxed">{item.description}</p>}
      {item.quantity !== undefined && (
        <p className="text-emerald-500">Quantidade: {item.quantity}</p>
      )}
    </div>
  );
}

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
  const [expandedPerk, setExpandedPerk] = useState<string | null>(null);
  const [isPerkPickerOpen, setIsPerkPickerOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);

  const canEdit = !readOnly && Boolean(onUpdateCharacter);

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

  const handleAddPerk = (perk: FalloutCharacterPerk) => {
    if (readOnly || !onUpdateCharacter) return;
    onUpdateCharacter({ perks: [...character.perks, perk] });
  };

  const handleRemovePerk = (name: string) => {
    if (readOnly || !onUpdateCharacter) return;
    onUpdateCharacter({
      perks: character.perks.filter((entry) => normalizeFalloutPerk(entry).name !== name),
    });
  };

  const handlePerkRank = (name: string, delta: number) => {
    if (readOnly || !onUpdateCharacter) return;
    onUpdateCharacter({
      perks: character.perks.map((entry) => {
        const perk = normalizeFalloutPerk(entry);
        return perk.name === name ? adjustFalloutPerkRank(perk, delta) : entry;
      }),
    });
  };

  const handleAddItem = (item: FalloutItem) => {
    if (readOnly || !onUpdateCharacter) return;
    // Id de instância único: o mesmo item do catálogo pode ser carregado várias vezes.
    onUpdateCharacter({ items: [...character.items, { ...item, id: generateUUID() }] });
  };

  const handleRemoveItem = (id: string) => {
    if (readOnly || !onUpdateCharacter) return;
    onUpdateCharacter({ items: character.items.filter((item) => item.id !== id) });
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                Equipamentos &amp; Suprimentos ({character.items.length})
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsItemPickerOpen(true)}
                  aria-label="Adicionar item"
                  className="flex shrink-0 items-center gap-1 rounded border border-emerald-500 bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar item
                </button>
              )}
            </div>
            {character.items.length === 0 ? (
              <p className="text-xs text-emerald-600 italic">
                Nenhum equipamento registrado no Pip-Boy.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {character.items.map((item) => {
                  const expanded = expandedItem === item.id;
                  return (
                    <li
                      key={item.id}
                      data-testid={`item-row-${item.id}`}
                      className="rounded border border-emerald-900/50 bg-black/50"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedItem(expanded ? null : item.id)}
                        aria-expanded={expanded}
                        aria-controls={`item-details-${item.id}`}
                        className="flex w-full items-center justify-between gap-2 p-2 text-xs cursor-pointer"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <img
                            src={getFalloutItemIcon(item.type)}
                            alt=""
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0"
                          />
                          <span className="truncate font-bold text-emerald-200">{item.name}</span>
                          <span className="shrink-0 text-[10px] uppercase text-emerald-500">
                            [{item.type}]
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-emerald-400">
                          {item.weight} lbs • {item.costCaps} Tampas
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                      {expanded && (
                        <div
                          data-testid={`item-details-${item.id}`}
                          id={`item-details-${item.id}`}
                          className="space-y-2 border-t border-emerald-900/50 px-2 py-2"
                        >
                          <PipBoyItemStats item={item} />
                          {canEdit && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                aria-label={`Remover ${item.name}`}
                                className="text-emerald-600 hover:text-red-400 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h4 className="font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <img src={getFalloutPerkIcon()} alt="" aria-hidden="true" className="h-4 w-4" />
                Vantagens (Perks) &amp; Características
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsPerkPickerOpen(true)}
                  aria-label="Adicionar perk"
                  className="flex shrink-0 items-center gap-1 rounded border border-emerald-500 bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar perk
                </button>
              )}
            </div>
            {character.perks.length === 0 ? (
              <p className="text-emerald-600 italic">Nenhuma vantagem registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {character.perks.map((entry, idx) => {
                  const perk = normalizeFalloutPerk(entry);
                  const expanded = expandedPerk === perk.name;
                  const rankLabel = `Rank ${perk.rank}${perk.maxRank ? ` / ${perk.maxRank}` : ""}`;
                  return (
                    <li
                      key={`${perk.name}-${idx}`}
                      data-testid={`perk-item-${perk.name}`}
                      className="rounded border border-emerald-900/50 bg-black/50"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedPerk(expanded ? null : perk.name)}
                        aria-expanded={expanded}
                        aria-controls={`perk-details-${perk.name}`}
                        className="flex w-full items-center justify-between gap-2 p-2 text-xs cursor-pointer"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <img
                            src={perk.imageUrl || getFalloutPerkIcon()}
                            alt=""
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0"
                          />
                          <span className="truncate font-bold text-emerald-200">{perk.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-emerald-400">
                          {rankLabel}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                      {expanded && (
                        <div
                          data-testid={`perk-details-${perk.name}`}
                          id={`perk-details-${perk.name}`}
                          className="space-y-2 border-t border-emerald-900/50 px-2 py-2"
                        >
                          {perk.description && (
                            <p className="text-[11px] leading-relaxed text-emerald-400">
                              {perk.description}
                            </p>
                          )}
                          {perk.requirements && (
                            <p className="text-[10px] text-emerald-500">
                              Requisitos:{" "}
                              <span className="text-emerald-300">{perk.requirements}</span>
                            </p>
                          )}
                          {!perk.description && !perk.requirements && (
                            <p className="text-[11px] italic text-emerald-600">
                              Perk registrado sem detalhes do catálogo.
                            </p>
                          )}
                          {canEdit && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePerkRank(perk.name, -1)}
                                  disabled={perk.rank <= 1}
                                  aria-label={`Diminuir rank de ${perk.name}`}
                                  className="rounded border border-emerald-500/50 p-1 text-emerald-300 hover:bg-emerald-950 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-[10px] text-emerald-400">{rankLabel}</span>
                                <button
                                  type="button"
                                  onClick={() => handlePerkRank(perk.name, 1)}
                                  disabled={perk.maxRank !== undefined && perk.rank >= perk.maxRank}
                                  aria-label={`Aumentar rank de ${perk.name}`}
                                  className="rounded border border-emerald-500/50 p-1 text-emerald-300 hover:bg-emerald-950 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePerk(perk.name)}
                                aria-label={`Remover ${perk.name}`}
                                className="text-emerald-600 hover:text-red-400 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
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

      <PipBoyPerkPickerModal
        isOpen={isPerkPickerOpen}
        onClose={() => setIsPerkPickerOpen(false)}
        character={character}
        onSelect={handleAddPerk}
      />

      <PipBoyItemPickerModal
        isOpen={isItemPickerOpen}
        onClose={() => setIsItemPickerOpen(false)}
        onSelect={handleAddItem}
      />
    </div>
  );
}
