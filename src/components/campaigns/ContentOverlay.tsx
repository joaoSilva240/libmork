"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign, Spell } from "@/types";
import { formatTechnicalField, getTechnicalLabel } from "@/lib/content/pf2e-item-formatter";
import { Spinner } from "@/components/ui";

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
  const [modalLanguage, setModalLanguage] = useState<"en" | "pt">("pt");
  const [isTranslating, setIsTranslating] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if ((activeTab !== "spells" && activeTab !== "items") || !selectedItem) {
      Promise.resolve().then(() => {
        setIsTranslating(false);
      });
      return;
    }

    const spell = selectedItem as unknown as Spell;
    const hasTranslation = !!spell.translation;
    if (hasTranslation) {
      Promise.resolve().then(() => {
        setModalLanguage("pt");
      });
      return;
    }

    // No translation, trigger translation
    Promise.resolve().then(() => {
      setModalLanguage("en");
      setIsTranslating(true);
    });

    const spellId = spell.id as string;
    let active = true;

    fetch(`/api/content/${activeTab}/${spellId}/translate`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro na requisição de tradução");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.success && data.translation) {
          // Update items array so it's cached locally
          setItems((prevItems) =>
            prevItems.map((item) =>
              item.id === spellId ? { ...item, translation: data.translation } : item
            )
          );
          // Update selectedItem state
          setSelectedItem((prev) =>
            prev && prev.id === spellId
              ? { ...prev, translation: data.translation }
              : prev
          );
          // Mude a linguagem do modal para PT-BR por padrão
          setModalLanguage("pt");
        }
      })
      .catch((err) => {
        console.error(`Erro ao traduzir ${activeTab === "items" ? "item" : "magia"}:`, err instanceof Error ? err.message : "erro desconhecido");
      })
      .finally(() => {
        if (active) {
          setIsTranslating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedItem, activeTab]);

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
      const isPt = modalLanguage === "pt";
      const spell = item as unknown as Spell;
      const translation = (spell.translation || null) as Record<string, unknown> | null;

      const getField = (key: string) => {
        if (isPt && translation && translation[key] !== undefined && translation[key] !== null && translation[key] !== "") {
          return translation[key];
        }
        return spell[key as keyof Spell];
      };

      const formatDamage = (dmg: unknown): string => {
        if (!dmg) return "";
        if (typeof dmg === "string") return dmg;
        if (typeof dmg === "object") {
          if (Array.isArray(dmg)) {
            return dmg.map(formatDamage).filter(Boolean).join(", ");
          }
          const typedDmg = dmg as Record<string, unknown>;
          const parts: string[] = [];
          if (typedDmg.formula) {
            parts.push(String(typedDmg.formula));
          } else if (typedDmg.dice) {
            let diceStr = String(typedDmg.dice);
            if (typedDmg.bonus !== undefined && typedDmg.bonus !== null) {
              const bonusNum = Number(typedDmg.bonus);
              if (bonusNum > 0) diceStr += ` + ${bonusNum}`;
              else if (bonusNum < 0) diceStr += ` - ${Math.abs(bonusNum)}`;
            }
            parts.push(diceStr);
          } else if (typedDmg.diceCount && typedDmg.diceSides) {
            let diceStr = `${typedDmg.diceCount}d${typedDmg.diceSides}`;
            if (typedDmg.bonus !== undefined && typedDmg.bonus !== null) {
              const bonusNum = Number(typedDmg.bonus);
              if (bonusNum > 0) diceStr += ` + ${bonusNum}`;
              else if (bonusNum < 0) diceStr += ` - ${Math.abs(bonusNum)}`;
            }
            parts.push(diceStr);
          }
          if (parts.length > 0) {
            return parts.join(" ");
          }
          return JSON.stringify(dmg);
        }
        return String(dmg);
      };

      const renderStructuredEffects = (effects: unknown) => {
        if (!effects) return null;
        if (Array.isArray(effects)) {
          return (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
              {effects.map((eff: unknown, idx: number) => {
                if (typeof eff === "string") {
                  return <li key={idx}>{eff}</li>;
                }
                if (typeof eff === "object" && eff !== null) {
                  const typedEff = eff as Record<string, unknown>;
                  const name = String(typedEff.name || typedEff.type || typedEff.label || `Efeito ${idx + 1}`);
                  const desc = String(typedEff.description || typedEff.value || typedEff.formula || JSON.stringify(eff));
                  return (
                    <li key={idx}>
                      <strong className="text-purple-300">{name}</strong>: {desc}
                    </li>
                  );
                }
                return <li key={idx}>{String(eff)}</li>;
              })}
            </ul>
          );
        }
        if (typeof effects === "object") {
          return (
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-300 font-mono">
              {JSON.stringify(effects, null, 2)}
            </pre>
          );
        }
        return <p className="text-sm text-gray-300">{String(effects)}</p>;
      };

      const parseUseType = (val: string | null | undefined): string => {
        if (!val) return isPt ? "Somático" : "Somatic";
        const parts = val.split(",").map((p) => p.trim().toLowerCase());
        const mapped = parts.map((part) => {
          if (part === "somatic" || part === "somático") return isPt ? "Somático" : "Somatic";
          if (part === "verbal" || part === "falada") return isPt ? "Falada" : "Verbal";
          if (part === "manual" || part === "material" || part === "componentes") return isPt ? "Componentes" : "Material";
          return part;
        });
        return mapped.filter(Boolean).join(", ");
      };

      const rawUseType = getField("useType");
      const displayUseType = parseUseType(rawUseType ? String(rawUseType) : null);

      const circleLabel = isPt ? "Círculo" : "Circle";
      const manaCostLabel = isPt ? "Custo de Mana" : "Mana Cost";
      const useTypeLabel = isPt ? "Condições" : "Conditions";
      const durationLabel = isPt ? "Duração" : "Duration";
      const actionCostLabel = isPt ? "Custo de Ações" : "Action Cost";
      const descriptionLabel = isPt ? "Descrição" : "Description";
      const extraEffectLabel = isPt ? "Efeito Extra" : "Extra Effect";

      const rangeLabel = isPt ? "Alcance" : "Range";
      const targetLabel = isPt ? "Alvo" : "Target";
      const areaLabel = isPt ? "Área" : "Area";
      const castingTimeLabel = isPt ? "Tempo de Conjuração" : "Casting Time";
      const damageTypeLabel = isPt ? "Tipo de Dano" : "Damage Type";
      const damageLabel = isPt ? "Dano" : "Damage";

      const displayDamageVal = getField("damage");
      const displayDamage = displayDamageVal ? formatDamage(displayDamageVal) : null;

      const renderActionCost = (cost: number | null | undefined, textVal: string | null | undefined) => {
        if (cost !== null && cost !== undefined) {
          if (cost >= 1 && cost <= 3) {
            const dots = Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < cost ? "text-purple-500 font-bold" : "text-gray-600"}>
                {i < cost ? "●" : "○"}
              </span>
            ));
            return (
              <div className="flex items-center gap-1.5" title={`${cost} ações`}>
                <div className="flex gap-0.5 text-lg leading-none">{dots}</div>
                <span className="text-xs text-gray-400">({cost} {cost === 1 ? "ação" : "ações"})</span>
              </div>
            );
          }
          if (cost === 0) {
            return <span className="text-white font-medium">⚡ {isPt ? "Reação" : "Reaction"}</span>;
          }
        }
        if (textVal) {
          const cleanText = textVal.toLowerCase();
          if (cleanText.includes("reaction") || cleanText.includes("reação") || cleanText.includes("reac.")) {
            return <span className="text-white font-medium">⚡ {isPt ? "Reação" : "Reaction"}</span>;
          }
          return <span className="text-white font-medium">{textVal}</span>;
        }
        return null;
      };

      const renderArea = (areaVal: string | null | undefined) => {
        if (!areaVal) return null;
        const lower = areaVal.toLowerCase();
        let icon = "⛶";
        if (lower.includes("cone")) icon = "📐";
        else if (lower.includes("burst") || lower.includes("emanation") || lower.includes("circle") || lower.includes("cylinder")) icon = "⭕";
        else if (lower.includes("line")) icon = "▬";
        else if (lower.includes("cube")) icon = "⬜";

        return (
          <span className="flex items-center gap-1.5">
            <span>{icon}</span>
            <span>{areaVal}</span>
          </span>
        );
      };

      return (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-4">
            {/* Lado Esquerdo (Box de Dano Compacto - D20) */}
            {displayDamage && (
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-950/25 border border-purple-900/30 w-24 shrink-0">
                {/* D20 SVG */}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full text-purple-600 hover:text-purple-500 transition-colors" viewBox="0 0 100 100" fill="currentColor">
                    <polygon points="50,2 95,25 95,75 50,98 5,75 5,25" fill="rgba(15, 10, 25, 0.8)" stroke="currentColor" strokeWidth="3" />
                    <polygon points="50,2 50,98" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="5,25 95,25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="5,75 95,75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="50,2 5,75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="50,2 95,75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="5,25 50,98" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                    <polygon points="95,25 50,98" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                  </svg>
                  <span className="relative z-10 text-center text-[10px] font-black text-white px-1 leading-tight break-all">
                    {displayDamage}
                  </span>
                </div>
                {/* Tipo de Dano */}
                {getField("damageType") && (
                  <div className="mt-1 text-[10px] text-purple-300 font-bold uppercase tracking-wider text-center">
                    {String(getField("damageType"))}
                  </div>
                )}
              </div>
            )}

            {/* Lado Direito (Informações Técnicas - Linhas 1 e 2) */}
            <div className={`${displayDamage ? "flex-1" : "w-full"} space-y-2`}>
              {/* Linha 1 (Círculo, Custo de Mana, Alvo, Alcance, Área) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-300 pb-3 border-b border-purple-900/20">
                <span><strong className="text-purple-400 font-bold">{circleLabel}:</strong> {spell.circle}</span>
                <span><strong className="text-purple-400 font-bold">{manaCostLabel}:</strong> {spell.manaCost}</span>
                {getField("target") && (
                  <span><strong className="text-purple-400 font-bold">{targetLabel}:</strong> {String(getField("target"))}</span>
                )}
                {getField("range") && (
                  <span><strong className="text-purple-400 font-bold">{rangeLabel}:</strong> {String(getField("range"))}</span>
                )}
                {getField("area") && (
                  <span className="inline-flex items-center gap-1"><strong className="text-purple-400 font-bold">{areaLabel}:</strong> {renderArea(getField("area") as string)}</span>
                )}
              </div>

              {/* Linha 2 (Condições, Duração, Tempo de Conjuração) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-300 pt-2 pb-3 border-b border-purple-900/20">
                {displayUseType && (
                  <span><strong className="text-purple-400 font-bold">{useTypeLabel}:</strong> {displayUseType}</span>
                )}
                {getField("duration") && (
                  <span><strong className="text-purple-400 font-bold">{durationLabel}:</strong> {String(getField("duration"))}</span>
                )}
                {renderActionCost(spell.actionCostOverride, getField("castingTime") as string) && (
                  <span className="inline-flex items-center gap-1"><strong className="text-purple-400 font-bold">{castingTimeLabel}:</strong> {renderActionCost(spell.actionCostOverride, getField("castingTime") as string)}</span>
                )}
              </div>
            </div>
          </div>

          {getField("description") !== null && getField("description") !== undefined && getField("description") !== "" && (
            <div>
              <span className="font-semibold text-gray-400">{descriptionLabel}:</span>
              <p className="mt-1 text-gray-300 whitespace-pre-wrap leading-relaxed">{formatValue(getField("description"))}</p>
            </div>
          )}
          {getField("extraEffect") !== null && getField("extraEffect") !== undefined && getField("extraEffect") !== "" && (
            <div>
              <span className="font-semibold text-gray-400">{extraEffectLabel}:</span>
              <p className="mt-1 text-gray-300 whitespace-pre-wrap leading-relaxed">{formatValue(getField("extraEffect"))}</p>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "items") {
      const translation = item.translation && typeof selectedItem?.translation === "object" ? item.translation as Record<string, unknown> : null;
      const getItemField = (key: string) => modalLanguage === "pt" && translation?.[key] ? translation[key] : item[key];
      const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
      const system = sourceData.system && typeof sourceData.system === "object" ? sourceData.system as Record<string, unknown> : {};
      const technical = ["level", "price", "bulk", "quantity", "usage", "category", "group", "damage", "traits", "ac", "resiliency"];

      return (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-purple-900/20 pb-3 text-xs text-gray-300">
            {technical.map((key) => {
              const raw = system[key];
              const value = raw && typeof raw === "object" && "value" in raw ? (raw as Record<string, unknown>).value : raw;
              if (value === null || value === undefined || value === "") return null;
              
              const formattedValue = formatTechnicalField(key, value, modalLanguage);
              if (!formattedValue) return null;
              
              return (
                <span key={key}>
                  <strong className="text-purple-400">{getTechnicalLabel(key, modalLanguage)}:</strong> {formattedValue}
                </span>
              );
            })}
          </div>
           {getItemField("description") !== null && getItemField("description") !== undefined && (
            <div>
              <span className="font-semibold text-gray-400">Descrição:</span>
               <p className="mt-1 text-gray-300">{formatValue(getItemField("description"))}</p>
            </div>
          )}
           {getItemField("qualityDescription") !== null && getItemField("qualityDescription") !== undefined && getItemField("qualityDescription") !== "" && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3">
              <span className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs">
                ✦ Qualidade
              </span>
               <p className="mt-1 text-emerald-100 text-xs">{formatValue(getItemField("qualityDescription"))}</p>
            </div>
          )}
           {getItemField("counterpointDescription") !== null && getItemField("counterpointDescription") !== undefined && getItemField("counterpointDescription") !== "" ? (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3">
              <span className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
                ⚠️ Contraponto (Defeito do Mestre)
              </span>
               <p className="mt-1 text-rose-100 text-xs">{formatValue(getItemField("counterpointDescription"))}</p>
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
                <Spinner size="md" />
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Nenhum item encontrado</p>
            ) : (
               <div className={activeTab === "items" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-1"}>
                 {filteredItems.map((item) => {
                   const isEnabled = item.campaignId === campaignId;
                   const isGlobal = item.campaignId === null;
                   const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
                   const system = sourceData.system && typeof sourceData.system === "object" ? sourceData.system as Record<string, unknown> : {};
                   const technicalFields = ["category", "level", "price", "bulk", "quantity", "usage", "damage", "traits", "ac", "resiliency"];
                   const technical = technicalFields
                     .map((key) => {
                       const raw = system[key];
                       const value = raw && typeof raw === "object" && "value" in raw ? (raw as Record<string, unknown>).value : raw;
                       return [key, value] as const;
                     })
                     .filter(([, value]) => value !== null && value !== undefined && value !== "")
                     .slice(0, 3);

                    return (
                     <div
                       key={item.id}
                       className={`${activeTab === "items" ? "flex flex-col" : "flex items-center gap-2"} rounded-lg border p-2 transition-colors ${
                         selectedItem?.id === item.id
                           ? "border-purple-600 bg-purple-900/20"
                           : "border-gray-800 bg-gray-900 hover:border-gray-700"
                       }`}
                     >
                       {activeTab === "items" && (
                         <div className="mb-2 flex items-start gap-3">
                           {item.imageUrl && !failedImages.has(item.id) ? (
                             <img
                               src={String(item.imageUrl)}
                               alt={`Imagem de ${item.name}`}
                               width={72}
                               height={72}
                               loading="lazy"
                               className="h-[72px] w-[72px] shrink-0 rounded-lg border border-purple-900/60 object-cover"
                               onError={() => setFailedImages((previous) => new Set(previous).add(item.id))}
                             />
                           ) : (
                             <div aria-label={`Imagem indisponível para ${item.name}`} className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-gray-950 text-2xl text-gray-600">✦</div>
                           )}
                           <div className="min-w-0 flex-1">
                             <button
                               onClick={() => setSelectedItem(item)}
                               onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedItem(item); } }}
                               aria-label={`Ver detalhes de ${item.name}`}
                               className="text-left text-sm font-bold text-white hover:text-purple-300"
                             >
                               {item.name}
                             </button>
                             {isGlobal && <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">Global</span>}
                             {technical.length > 0 && (
                               <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                                 {technical.map(([key, value]) => {
                                   const formatted = formatTechnicalField(key, value, modalLanguage);
                                   if (!formatted) return null;
                                   return (
                                     <span key={key}>
                                       <strong className="text-purple-300">{getTechnicalLabel(key, modalLanguage)}:</strong> {formatted}
                                     </span>
                                   );
                                 })}
                                </div>
                             )}
                             {item.description !== null && item.description !== undefined && <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{String(item.description)}</p>}
                           </div>
                         </div>
                       )}
                       <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleItemEnabled(item, isEnabled)}
                        disabled={isGlobal}
                        className="h-4 w-4 accent-purple-600 disabled:opacity-50"
                      />
                      {activeTab !== "items" && <button
                        onClick={() => setSelectedItem(item)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedItem(item); } }}
                        aria-label={`Ver detalhes de ${item.name}`}
                        className="flex-1 text-left text-sm text-white hover:text-purple-300"
                      >
                        {item.name}
                        {isGlobal && (
                          <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                            Global
                          </span>
                        )}
                      </button>}
                      {activeTab === "items" && <button
                        onClick={() => setSelectedItem(item)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedItem(item); } }}
                        aria-label={`Ver detalhes de ${item.name}`}
                        className="flex-1 text-left text-sm text-white hover:text-purple-300"
                      >
                        Ver detalhes
                      </button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="w-1/2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3">
            {selectedItem ? (() => {
              const isSpell = activeTab === "spells";
              const isPt = modalLanguage === "pt";
              const spell = selectedItem as unknown as Spell;
              const translation = (spell.translation || null) as Record<string, unknown> | null;

              const getField = (key: string) => {
                if (isPt && translation && translation[key] !== undefined && translation[key] !== null && translation[key] !== "") {
                  return translation[key];
                }
                return spell[key as keyof Spell];
              };

               const itemTranslation = selectedItem.translation && typeof selectedItem.translation === "object" ? selectedItem.translation as Record<string, unknown> : null;
               const displayName = isSpell ? (getField("name") ? String(getField("name")) : spell.name) : (modalLanguage === "pt" && itemTranslation?.name ? String(itemTranslation.name) : selectedItem.name);

              return (
                <div>
                  <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
               <div className="flex items-center gap-3">
                      {isSpell && (
                        spell.imageUrl ? (
                          <img
                            src={String(spell.imageUrl)}
                            alt={`Imagem da magia ${displayName}`}
                            width={44}
                            height={44}
                            className="h-11 w-11 rounded-lg border border-purple-900/60 object-cover"
                          />
                        ) : (
                          <div
                            aria-label={`Imagem indisponível para ${displayName}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-purple-900/60 bg-gray-900 text-xl text-gray-600"
                          >
                            ✦
                          </div>
                        )
                      )}
                       <h3 className="text-lg font-bold text-white">{displayName}</h3>
                    </div>
                    {(isSpell || activeTab === "items") && (
                      <div className="flex items-center gap-2">
                        {isTranslating && (
                          <span className="text-[10px] text-purple-400 animate-pulse">
                            Traduzindo...
                          </span>
                        )}
                        {spell.translation ? (
                          <div className="flex gap-1 rounded-lg border border-purple-800 bg-gray-900 p-0.5">
                            <button
                              type="button"
                              onClick={() => setModalLanguage("pt")}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                                modalLanguage === "pt"
                                  ? "bg-purple-600 text-white"
                                  : "text-gray-400 hover:text-white"
                              }`}
                            >
                              PT
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalLanguage("en")}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                                modalLanguage === "en"
                                  ? "bg-purple-600 text-white"
                                  : "text-gray-400 hover:text-white"
                              }`}
                            >
                              EN
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {renderItemDetails(selectedItem)}
                </div>
              );
            })() : (
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
