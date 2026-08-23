"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/types";

type ContentOverlayProps = {
  campaignId: string;
  campaign?: Campaign | null;
  onClose: () => void;
};

type ContentTab = "skills" | "spells" | "items" | "conditions";
type ContentItem = Record<string, unknown> & { id: string; name: string; campaignId: string | null };

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  return String(value);
};

export function ContentOverlay({ campaignId, campaign, onClose }: ContentOverlayProps) {
  const [activeTab, setActiveTab] = useState<ContentTab>("skills");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  const tabs: { key: ContentTab; label: string }[] = [
    { key: "skills", label: "Perícias" },
    { key: "spells", label: "Magias" },
    { key: "items", label: "Itens" },
    { key: "conditions", label: "Condições" },
  ];

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSearchQuery("");
    setSelectedItem(null);
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/content/${activeTab}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar conteúdo");
        return;
      }

      setItems(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, activeTab]);

  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setSearchQuery("");
      setSelectedItem(null);
      
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/content/${activeTab}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar conteúdo");
          return;
        }

        setItems(data.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [campaignId, activeTab]);

  const toggleItemEnabled = async (item: ContentItem, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) {
        // Desabilitar = deletar o item privado da campanha
        const response = await fetch(`/api/campaigns/${campaignId}/content/${activeTab}/${item.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Erro ao desabilitar conteúdo");
          return;
        }
      } else {
        // Habilitar = criar uma cópia privada na campanha (se for global) ou reativar
        // Para simplificar, vamos apenas recarregar a lista
        // A lógica real de enable/disable depende de como você quer implementar
      }

      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItemDetails = (item: ContentItem) => {
    if (activeTab === "skills") {
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold text-gray-400">Atributo Chave:</span>{" "}
            <span className="text-white">{formatValue(item.keyAttribute)}</span>
          </div>
          {item.rollExpression !== null && item.rollExpression !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Rolagem:</span>{" "}
              <span className="text-white">{formatValue(item.rollExpression)}</span>
            </div>
          )}
          {item.description !== null && item.description !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Descrição:</span>
              <p className="mt-1 text-gray-300">{formatValue(item.description)}</p>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "spells") {
      return (
        <div className="space-y-2 text-sm">
          <div className="flex gap-4">
            <div>
              <span className="font-semibold text-gray-400">Círculo:</span>{" "}
              <span className="text-white">{formatValue(item.circle)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-400">Custo de Mana:</span>{" "}
              <span className="text-white">{formatValue(item.manaCost)}</span>
            </div>
          </div>
          {item.useType !== null && item.useType !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Tipo de Uso:</span>{" "}
              <span className="text-white">{formatValue(item.useType)}</span>
            </div>
          )}
          {item.duration !== null && item.duration !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Duração:</span>{" "}
              <span className="text-white">{formatValue(item.duration)}</span>
            </div>
          )}
          {item.description !== null && item.description !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Descrição:</span>
              <p className="mt-1 text-gray-300">{formatValue(item.description)}</p>
            </div>
          )}
          {item.extraEffect !== null && item.extraEffect !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Efeito Extra:</span>
              <p className="mt-1 text-gray-300">{formatValue(item.extraEffect)}</p>
            </div>
          )}
          {item.actionCostOverride !== null && item.actionCostOverride !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Custo de Ações:</span>{" "}
              <span className="text-white">{formatValue(item.actionCostOverride)}</span>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "items") {
      return (
        <div className="space-y-3 text-sm">
          {item.description !== null && item.description !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Descrição:</span>
              <p className="mt-1 text-gray-300">{formatValue(item.description)}</p>
            </div>
          )}
          {item.qualityDescription !== null && item.qualityDescription !== undefined && item.qualityDescription !== "" && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3">
              <span className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs">
                ✦ Qualidade
              </span>
              <p className="mt-1 text-emerald-100 text-xs">{formatValue(item.qualityDescription)}</p>
            </div>
          )}
          {item.counterpointDescription !== null && item.counterpointDescription !== undefined && item.counterpointDescription !== "" ? (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3">
              <span className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
                ⚠️ Contraponto (Defeito do Mestre)
              </span>
              <p className="mt-1 text-rose-100 text-xs">{formatValue(item.counterpointDescription)}</p>
            </div>
          ) : item.qualityDescription ? (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-2.5 text-xs text-amber-300 flex items-center justify-between">
              <span>⚡ Aguardando revisão do Mestre para definir o Contraponto.</span>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeTab === "conditions") {
      return (
        <div className="space-y-2 text-sm">
          {item.description !== null && item.description !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Descrição:</span>
              <p className="mt-1 text-gray-300">{formatValue(item.description)}</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-5xl flex-col rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
          <div>
            <h2 className="text-lg font-bold text-white">Gerenciar Conteúdo</h2>
            {campaign && (
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-300">
                  Motor: {campaign.rulesEngine === "d20_mod" ? "d20 + modificador" : "2d20 somado"}
                </span>
                <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-300">
                  PvP: {campaign.pvpEnabled ? "ativado" : "desativado"}
                </span>
                <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-300">
                  Sombra: +{campaign.difficultyModifierShadowPoints}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-2 border-b border-gray-800 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-transparent focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-3 overflow-hidden">
          {/* Lista */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Nenhum item encontrado</p>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const isEnabled = item.campaignId === campaignId;
                  const isGlobal = item.campaignId === null;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                        selectedItem?.id === item.id
                          ? "border-purple-600 bg-purple-900/20"
                          : "border-gray-800 bg-gray-900 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleItemEnabled(item, isEnabled)}
                        disabled={isGlobal}
                        className="h-4 w-4 accent-purple-600 disabled:opacity-50"
                      />
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="flex-1 text-left text-sm text-white hover:text-purple-300"
                      >
                        {item.name}
                        {isGlobal && (
                          <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                            Global
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3">
            {selectedItem ? (
              <div>
                <h3 className="mb-3 text-lg font-bold text-white">{selectedItem.name}</h3>
                {renderItemDetails(selectedItem)}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                Selecione um item para ver os detalhes
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
