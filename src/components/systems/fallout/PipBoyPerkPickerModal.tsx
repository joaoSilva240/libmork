"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Seletor de Perks da Biblioteca Global (Pip-Boy)
// =============================================================================

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  FALLOUT_ATTRIBUTES,
  type FalloutCharacter,
  type FalloutCharacterPerk,
} from "@/lib/systems/fallout/types";
import {
  getFalloutAttributeShortLabel,
  getFalloutPerkRequirementText,
  getMaxFalloutPerks,
  normalizeFalloutPerk,
} from "@/lib/systems/fallout/rules";
import {
  getPerkRequirementAttributes,
  getUnmetPerkRequirements,
} from "@/lib/systems/fallout/perkRequirements";
import { getFalloutPerkIcon } from "@/lib/systems/fallout/assets";
import { useFalloutPerkCatalog, type CatalogPerk } from "@/hooks/useFalloutPerkCatalog";
import { Plus, RefreshCw, X } from "lucide-react";

interface PipBoyPerkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: FalloutCharacter;
  onSelect: (perk: FalloutCharacterPerk) => void;
}

export function PipBoyPerkPickerModal({
  isOpen,
  onClose,
  character,
  onSelect,
}: PipBoyPerkPickerModalProps) {
  const { catalog, isLoading, error, retry } = useFalloutPerkCatalog(isOpen);
  const [search, setSearch] = useState("");
  const [attributeFilter, setAttributeFilter] = useState<
    (typeof FALLOUT_ATTRIBUTES)[number] | null
  >(null);
  const [showBlocked, setShowBlocked] = useState(false);

  const ownedNames = new Set(character.perks.map((perk) => normalizeFalloutPerk(perk).name));
  const maxPerks = getMaxFalloutPerks(character.level);
  const atLimit = ownedNames.size >= maxPerks;
  const term = search.trim().toLowerCase();
  const visiblePerks = catalog.filter((perk) => {
    if (term && !perk.name.toLowerCase().includes(term)) return false;
    if (
      attributeFilter &&
      !getPerkRequirementAttributes(
        getFalloutPerkRequirementText(perk.structuredEffects),
      ).includes(attributeFilter)
    ) {
      return false;
    }
    if (!showBlocked) {
      const reqs = getFalloutPerkRequirementText(perk.structuredEffects);
      const unmet = getUnmetPerkRequirements(reqs, character.attributes, character.level);
      if (unmet.length > 0) return false;
    }
    return true;
  });

  const selectPerk = (perk: CatalogPerk) => {
    onSelect({
      name: perk.name,
      rank: 1,
      maxRank: Math.max(1, perk.circle),
      description: perk.description,
      requirements: getFalloutPerkRequirementText(perk.structuredEffects),
      imageUrl: perk.imageUrl,
      sourceKey: perk.id,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Seletor de Perks Pip-Boy">
      <div className="relative flex max-h-[calc(100dvh-5rem)] flex-col font-mono text-emerald-400 bg-black/90 border border-emerald-500/40 rounded-lg p-4">
        <Modal.CloseButton className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-black/70 text-xs text-emerald-400 hover:border-emerald-300 hover:text-emerald-200 cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </Modal.CloseButton>

        <div className="pipboy-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <h3 className="border-b border-emerald-500/30 pb-2 pr-8 text-xs font-bold uppercase tracking-widest text-emerald-300">
            Perks da Biblioteca Global
          </h3>

          <input
            type="text"
            aria-label="Buscar perks"
            placeholder="Buscar perk pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-emerald-500/50 rounded px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
          />

          <div className="flex flex-wrap gap-1.5">
            {FALLOUT_ATTRIBUTES.map((attribute) => {
              const active = attributeFilter === attribute;
              return (
                <button
                  key={attribute}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAttributeFilter(active ? null : attribute)}
                  className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                    active
                      ? "bg-emerald-500/25 border-emerald-400 text-emerald-200"
                      : "bg-black/50 border-emerald-900/50 text-emerald-500 hover:text-emerald-300"
                  }`}
                >
                  {getFalloutAttributeShortLabel(attribute)}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-[10px] text-emerald-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlocked}
              onChange={(e) => setShowBlocked(e.target.checked)}
              className="accent-emerald-500"
            />
            Mostrar perks bloqueadas
          </label>

          {atLimit && (
            <div className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
              Limite de perks atingido ({ownedNames.size}/{maxPerks})
            </div>
          )}

          {isLoading ? (
            <p className="text-[11px] text-emerald-500 animate-pulse">
              Carregando catálogo oficial do Fallout 2d20...
            </p>
          ) : error ? (
            <div
              data-testid="perk-catalog-error"
              className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 space-y-2"
            >
              <p className="text-[11px] text-amber-300">{error}</p>
              <button
                type="button"
                onClick={retry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black border border-amber-500 text-[11px] font-bold text-amber-300 hover:bg-amber-950 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          ) : visiblePerks.length === 0 ? (
            <p className="text-[11px] text-emerald-600 italic">
              Nenhum perk encontrado para os filtros atuais.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visiblePerks.map((perk) => {
                const requirements = getFalloutPerkRequirementText(perk.structuredEffects);
                const unmet = getUnmetPerkRequirements(
                  requirements,
                  character.attributes,
                  character.level,
                );
                const owned = ownedNames.has(perk.name);
                return (
                  <li
                    key={perk.id}
                    data-testid={`perk-card-${perk.id}`}
                    className="rounded border border-emerald-500/30 bg-black/60 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={perk.imageUrl || getFalloutPerkIcon()}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 shrink-0 opacity-80"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-emerald-200">
                            {perk.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-emerald-500">
                            máx. {Math.max(1, perk.circle)}
                          </span>
                        </div>
                        {requirements && (
                          <p
                            className={`text-[10px] ${unmet.length > 0 ? "text-amber-400" : "text-emerald-400"}`}
                          >
                            {requirements}
                          </p>
                        )}
                        {unmet.length > 0 && (
                          <p
                            data-testid="perk-requirements-warning"
                            className="text-[10px] text-amber-400"
                          >
                            Requisitos não atendidos: {unmet.join(", ")}
                          </p>
                        )}
                        {perk.description && (
                          <p className="text-[10px] leading-relaxed text-emerald-600">
                            {perk.description}
                          </p>
                        )}
                      </div>
                      {owned ? (
                        <span className="shrink-0 text-[10px] uppercase text-emerald-600">
                          Já possui
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => selectPerk(perk)}
                        disabled={owned || atLimit || unmet.length > 0}
                        aria-label={`Adicionar ${perk.name}`}
                        className="shrink-0 rounded border border-emerald-500 bg-emerald-950 p-1.5 text-emerald-300 hover:bg-emerald-900 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-emerald-600 leading-relaxed">
            Nível {character.level}: máximo {maxPerks} perk(s). Perks bloqueadas ficam ocultas por padrão.
          </p>
        </div>
      </div>
    </Modal>
  );
}
