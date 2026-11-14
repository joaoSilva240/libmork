"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Seletor de Itens da Biblioteca Global (Pip-Boy)
// =============================================================================

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { FalloutItem } from "@/lib/systems/fallout/types";
import {
  FALLOUT_ITEM_FILTER_CATEGORIES,
  catalogItemToFalloutItem,
  getFalloutItemCategory,
  getFalloutItemCategoryLabel,
  type FalloutItemFilterCategory,
} from "@/lib/systems/fallout/itemCatalog";
import { getFalloutItemIcon } from "@/lib/systems/fallout/assets";
import { useFalloutItemCatalog } from "@/hooks/useFalloutItemCatalog";
import { Plus, RefreshCw, X } from "lucide-react";

interface PipBoyItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: FalloutItem) => void;
}

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  physical: "Físico",
  energy: "Energia",
  radiation: "Radiação",
  poison: "Veneno",
};

/** Resumo curto de estatísticas exibido no card do seletor. */
function itemStatSummary(item: FalloutItem): string | null {
  if (item.type === "weapon") {
    return `${item.damageDiceRating} DC • ${DAMAGE_TYPE_LABELS[item.damageType] ?? item.damageType}`;
  }
  if (item.type === "apparel") {
    return `RD ${item.resistances.physical} fís. / ${item.resistances.energy} energ.`;
  }
  if (item.type === "consumable" && item.hpRestored) {
    return `+${item.hpRestored} HP`;
  }
  return null;
}

export function PipBoyItemPickerModal({
  isOpen,
  onClose,
  onSelect,
}: PipBoyItemPickerModalProps) {
  const { catalog, isLoading, error, retry } = useFalloutItemCatalog(isOpen);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FalloutItemFilterCategory | null>(null);

  const term = search.trim().toLowerCase();
  const visibleItems = catalog.filter((item) => {
    if (term && !item.name.toLowerCase().includes(term)) return false;
    if (categoryFilter && getFalloutItemCategory(item) !== categoryFilter) return false;
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Seletor de Itens Pip-Boy">
      <div className="relative flex max-h-[calc(100dvh-5rem)] flex-col font-mono text-emerald-400 bg-black/90 border border-emerald-500/40 rounded-lg p-4">
        <Modal.CloseButton className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-black/70 text-xs text-emerald-400 hover:border-emerald-300 hover:text-emerald-200 cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </Modal.CloseButton>

        <div className="pipboy-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <h3 className="border-b border-emerald-500/30 pb-2 pr-8 text-xs font-bold uppercase tracking-widest text-emerald-300">
            Equipamentos da Biblioteca Global
          </h3>

          <input
            type="text"
            aria-label="Buscar itens"
            placeholder="Buscar item pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-emerald-500/50 rounded px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
          />

          <div className="flex flex-wrap gap-1.5">
            {FALLOUT_ITEM_FILTER_CATEGORIES.map((category) => {
              const active = categoryFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(active ? null : category)}
                  className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                    active
                      ? "bg-emerald-500/25 border-emerald-400 text-emerald-200"
                      : "bg-black/50 border-emerald-900/50 text-emerald-500 hover:text-emerald-300"
                  }`}
                >
                  {getFalloutItemCategoryLabel(category)}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <p className="text-[11px] text-emerald-500 animate-pulse">
              Carregando catálogo oficial do Fallout 2d20...
            </p>
          ) : error ? (
            <div
              data-testid="item-catalog-error"
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
          ) : visibleItems.length === 0 ? (
            <p className="text-[11px] text-emerald-600 italic">
              Nenhum item encontrado para os filtros atuais.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleItems.map((entry) => {
                const item = catalogItemToFalloutItem(entry);
                const category = getFalloutItemCategory(entry);
                const summary = itemStatSummary(item);
                return (
                  <li
                    key={entry.id}
                    data-testid={`item-card-${entry.id}`}
                    className="rounded border border-emerald-500/30 bg-black/60 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={entry.imageUrl || getFalloutItemIcon(category)}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 shrink-0 opacity-80"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-emerald-200">
                            {entry.name}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase text-emerald-500">
                            {category}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-400">
                          {item.weight} lbs • {item.costCaps} Tampas
                          {summary ? ` • ${summary}` : ""}
                        </p>
                        {entry.description && (
                          <p className="text-[10px] leading-relaxed text-emerald-600">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        aria-label={`Adicionar ${entry.name}`}
                        className="shrink-0 rounded border border-emerald-500 bg-emerald-950 p-1.5 text-emerald-300 hover:bg-emerald-900 cursor-pointer"
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
            Itens são adicionados ao inventário com peso e tampas do compêndio oficial.
          </p>
        </div>
      </div>
    </Modal>
  );
}
