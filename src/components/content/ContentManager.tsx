"use client";

import { getTechnicalLabel, formatTechnicalField } from "@/lib/content/pf2e-item-formatter";
import { useEffect, useState } from "react";
import { ATTRIBUTES, SPELL_USE_TYPES } from "@/lib/utils/constants";
import type { ContentType } from "@/lib/validators/content";
import { Button, Form, Input, Spinner } from "@/components/ui";
import type { Spell } from "@/types";

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  placeholder?: string;
};

type TypeConfig = {
  label: string;
  fields: FieldDef[];
  showInList: string[];
};

const TYPE_CONFIGS: Record<ContentType, TypeConfig> = {
  skills: {
    label: "Perícias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "rollExpression", label: "Expressão de Rolagem", type: "text", placeholder: "1d20 + destreza" },
      { name: "keyAttribute", label: "Atributo Chave", type: "select", options: ATTRIBUTES, required: true },
    ],
    showInList: ["keyAttribute", "rollExpression"],
  },
  spells: {
    label: "Magias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "circle", label: "Círculo (1-9)", type: "number", min: 1, max: 9, required: true },
      { name: "manaCost", label: "Custo de Mana", type: "number", min: 0, required: true },
      { name: "useType", label: "Condições", type: "text" },
      { name: "castingTime", label: "Tempo de Conjuração", type: "text" },
      { name: "range", label: "Alcance", type: "text" },
      { name: "target", label: "Alvo", type: "text" },
      { name: "area", label: "Área", type: "text" },
      { name: "duration", label: "Duração", type: "text" },
      { name: "damageType", label: "Tipo de Dano", type: "text" },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "extraEffect", label: "Efeito Extra", type: "textarea" },
      { name: "actionCostOverride", label: "Custo de Ações (override, 0-3)", type: "number", min: 0, max: 3 },
    ],
    showInList: ["circle", "manaCost"],
  },
  items: {
    label: "Itens",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "qualityDescription", label: "Qualidade", type: "textarea" },
      { name: "counterpointDescription", label: "Contraponto", type: "textarea" },
    ],
    showInList: ["description"],
  },
  conditions: {
    label: "Condições",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
    ],
    showInList: ["description"],
  },
};

const CONTENT_TYPE_ORDER: ContentType[] = ["skills", "spells", "items", "conditions"];

type ContentManagerProps = {
  basePath: string;
  title: string;
};

type Item = Record<string, unknown>;

function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

const ITEM_TECHNICAL_FIELDS = ["level", "price", "bulk", "quantity", "usage", "category", "group", "damage", "traits", "ac", "resiliency"];

function getSourceSystem(item: Item): Record<string, unknown> {
  const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
  return sourceData.system && typeof sourceData.system === "object" ? sourceData.system as Record<string, unknown> : {};
}

function getTechnicalValue(system: Record<string, unknown>, key: string): unknown {
  const raw = system[key];
  return raw && typeof raw === "object" && "value" in raw ? (raw as Record<string, unknown>).value : raw;
}

export function ContentManager({ basePath, title }: ContentManagerProps) {
  const [activeType, setActiveType] = useState<ContentType>("skills");
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Overlay de criação, busca, filtro e importação de conteúdo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchContent, setSearchContent] = useState("");
  const [isImportingDnd, setIsImportingDnd] = useState(false);
  const [itemSubCategory, setItemSubCategory] = useState<"all" | "weapons" | "armors" | "magic" | "consumables">("all");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedSpell, setSelectedSpell] = useState<Item | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [modalLanguage, setModalLanguage] = useState<"en" | "pt">("en");

  useEffect(() => {
    if (!selectedSpell || (activeType !== "spells" && activeType !== "items")) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedSpell(null);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedSpell]);

  useEffect(() => {
    if (!selectedSpell || (activeType !== "spells" && activeType !== "items")) {
      Promise.resolve().then(() => {
        setIsTranslating(false);
      });
      return;
    }

    const spell = selectedSpell as unknown as Spell;
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

    fetch(`/api/content/${activeType}/${spellId}/translate`, {
      method: "POST",
      credentials: "include",
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
          // Update selectedSpell state
          setSelectedSpell((prev) =>
            prev && prev.id === spellId
              ? { ...prev, translation: data.translation }
              : prev
          );
          // Mude a linguagem do modal para PT-BR por padrão
          setModalLanguage("pt");
        }
      })
      .catch((err) => {
        console.error(`Erro ao traduzir ${activeType === "items" ? "item" : "magia"}:`, err instanceof Error ? err.message : "erro desconhecido");
      })
      .finally(() => {
        if (active) {
          setIsTranslating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSpell, activeType]);

  const handleImportDndContent = async () => {
    setError(null);
    setIsImportingDnd(true);
    try {
      const response = await fetch("/api/content/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: activeType }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar conteúdo");
        return;
      }
      await loadItems();
      alert(data.message || "Conteúdo importado com sucesso!");
    } catch {
      setError("Erro de conexão ao importar conteúdo.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  const config = TYPE_CONFIGS[activeType];

  const loadItems = async () => {
    try {
      const response = await fetch(`${basePath}/${activeType}`, { credentials: "include" });
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
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${basePath}/${activeType}`, { credentials: "include" });
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
    })();

    return () => {
      cancelled = true;
    };
  }, [basePath, activeType]);

  const buildPayload = (source: Record<string, string>) => {
    const payload: Record<string, unknown> = {};

    for (const field of config.fields) {
      const value = source[field.name];
      if (field.type === "number") {
        if (value === "" || value === undefined) continue;
        payload[field.name] = Number(value);
      } else if (value !== "" && value !== undefined) {
        payload[field.name] = value;
      }
    }

    return payload;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`${basePath}/${activeType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(formData)),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar conteúdo");
        return;
      }

      setFormData({});
      setShowCreateModal(false);
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (item: Item) => {
    const initial: Record<string, string> = {};
    for (const field of config.fields) {
      initial[field.name] = toFormValue(item[field.name]);
    }
    setEditData(initial);
    setEditingId(item.id as string);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editData)),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar alterações");
        return;
      }

      setEditingId(null);
      setEditData({});
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Excluir esta ${config.label.toLowerCase().replace(/s$/, "")}?`)) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir conteúdo");
        return;
      }

      if (editingId === id) {
        setEditingId(null);
      }
      if (selectedSpell?.id === id) {
        setSelectedSpell(null);
      }
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const renderFields = (
    data: Record<string, string>,
    onChange: (name: string, value: string) => void,
    disabled: boolean,
    prefix: string
  ) =>
    config.fields.map((field) => {
      const key = `${prefix}-${field.name}`;
      if (field.type === "textarea") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <textarea
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-900"
              rows={2}
            />
          </div>
        );
      }
      if (field.type === "select") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <select
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Selecione</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <Input
          key={key}
          label={field.label}
          name={`${prefix}-${field.name}`}
          type={field.type}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={data[field.name] || ""}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">{title}</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Criar {config.label.replace(/s$/, "")}</span>
          </button>

          <button
            type="button"
            onClick={handleImportDndContent}
            disabled={isImportingDnd}
            className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <span>🐉</span>
          <span>{isImportingDnd ? "Importando..." : activeType === "items" ? "Importar itens SF2e" : `Importar ${config.label}`}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3 border-b border-gray-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPE_ORDER.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setActiveType(type);
                  setFormData({});
                   setEditingId(null);
                   setSelectedSpell(null);
                   setSearchContent("");
                  setItemSubCategory("all");
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeType === type
                    ? "bg-purple-600 text-white shadow"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {TYPE_CONFIGS[type].label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder={`Buscar ${config.label.toLowerCase()} por nome...`}
            value={searchContent}
            onChange={(e) => setSearchContent(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Subcategorias quando a aba de Itens estiver ativa */}
        {activeType === "items" && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              ["all", "Todos os Itens"],
              ["weapons", "⚔️ Armas"],
              ["armors", "🛡️ Armaduras & Escudos"],
              ["magic", "✨ Itens Mágicos"],
              ["consumables", "🧪 Consumíveis & Diversos"],
            ].map(([subKey, subLabel]) => (
              <button
                key={subKey}
                onClick={() => setItemSubCategory(subKey as typeof itemSubCategory)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  itemSubCategory === subKey
                    ? "bg-purple-950 text-purple-300 border border-purple-800/80"
                    : "bg-gray-950 text-gray-400 border border-gray-800 hover:text-white"
                }`}
              >
                {subLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Área Principal de Conteúdo (Full Width) */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 font-semibold text-white text-sm flex items-center justify-between">
          <span>{config.label} Cadastradas</span>
          <span className="text-xs text-purple-400 font-bold">{items.length} itens</span>
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center w-full min-h-[300px]">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 space-y-2">
            <p>Nenhuma {config.label.toLowerCase().replace(/s$/, "")} cadastrada ainda.</p>
            <p className="text-xs text-gray-500">
              Clique em <strong>+ Criar {config.label.replace(/s$/, "")}</strong> ou <strong>Importar conteúdo</strong> para popular.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items
              .filter((item) => {
                const name = String(item.name || "").toLowerCase();
                const desc = String(item.description || "").toLowerCase();
                const matchSearch = name.includes(searchContent.toLowerCase()) || desc.includes(searchContent.toLowerCase());
                if (!matchSearch) return false;

                if (activeType !== "items" || itemSubCategory === "all") return true;

                 const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
                 const source = sourceData.source && typeof sourceData.source === "object" ? sourceData.source as Record<string, unknown> : {};
                 const category = String(item.category || source.category || "").toLowerCase();
                 const text = `${name} ${desc} ${category}`;
                 if (itemSubCategory === "weapons") {
                   return category.includes("weapon") || /sword|bow|axe|blade|dagger|spear|mace|staff|hammer|weapon|arma|espada|machado|arco|adaga|lança|clava|cajado|martelo|cimitarra/i.test(text);
                }
                if (itemSubCategory === "armors") {
                  return /armor|shield|chain|plate|leather|helm|escudo|armadura|cota|couro|elmo/i.test(text);
                }
                if (itemSubCategory === "magic") {
                  return Boolean(item.qualityDescription || item.counterpointDescription || /magic|ring|wand|scroll|potion|mágico|anel|vara|pergaminho|poção/i.test(text));
                }
                if (itemSubCategory === "consumables") {
                  return /potion|food|ration|herb|poção|comida|ração|erva|kit|tocha|corda/i.test(text);
                }

                return true;
              })
               .map((item) => (
                 <div
                   key={item.id as string}
                    role={activeType === "spells" || activeType === "items" ? "button" : undefined}
                    tabIndex={activeType === "spells" || activeType === "items" ? 0 : undefined}
                    onClick={activeType === "spells" || activeType === "items" ? () => setSelectedSpell(item) : undefined}
                   onKeyDown={
                      activeType === "spells" || activeType === "items"
                       ? (event) => {
                           if (event.key === "Enter" || event.key === " ") {
                             event.preventDefault();
                              setSelectedSpell(item);
                           }
                         }
                       : undefined
                   }
                   className={`rounded-xl border border-gray-800 bg-gray-950 p-3 ${
                      activeType === "spells" || activeType === "items" ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500" : ""
                   }`}
                 >
                     <div className={activeType === "spells" || activeType === "items" ? "flex items-center gap-3" : "flex items-start justify-between"}>
                      {(activeType === "spells" || activeType === "items") && item.imageUrl && !failedImages.has(item.id as string) ? (
                       <img
                         src={String(item.imageUrl)}
                         alt={`Ícone de ${String(item.name)}`}
                         width={96}
                         height={96}
                         loading="lazy"
                          className="h-24 w-24 shrink-0 rounded-lg object-cover"
                         onError={() => setFailedImages((previous) => new Set(previous).add(item.id as string))}
                       />
                      ) : activeType === "spells" || activeType === "items" ? (
                        <div aria-label={`Ícone indisponível para ${String(item.name)}`} className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-3xl text-gray-600">✦</div>
                     ) : null}
                     <div className="min-w-0 flex-1">
                       <div className="flex items-start justify-between gap-2">
                          {activeType === "spells" || activeType === "items" ? (
                           <span className="text-left font-bold text-sm text-white hover:text-purple-300">
                             {item.name as string}
                           </span>
                         ) : (
                           <button
                             onClick={() =>
                               editingId === item.id ? setEditingId(null) : startEditing(item)
                             }
                             className="text-left font-bold text-sm text-white hover:text-purple-300 flex items-center gap-1.5"
                           >
                             <span>{item.name as string}</span>
                             <span className="text-xs text-purple-400 opacity-70">
                               {editingId === item.id ? "−" : "✎"}
                             </span>
                           </button>
                         )}
                          {(activeType === "spells" || activeType === "items") && (
                           <button
                             type="button"
                             aria-label={`Editar ${String(item.name)}`}
                             onClick={(event) => {
                               event.stopPropagation();
                               if (editingId === item.id) {
                                 setEditingId(null);
                               } else {
                                 startEditing(item);
                               }
                             }}
                             className="shrink-0 text-xs text-purple-400 hover:text-purple-300"
                           >
                             ✎
                           </button>
                         )}
                       </div>

                      <div className="mt-1 space-y-0.5 text-xs text-gray-400">
                         {config.showInList.map((field) => {
                          const value = item[field];
                          if (value === null || value === undefined || value === "") return null;
                          return (
                            <p key={field} className="text-gray-300">
                              <strong className="text-gray-400">{field}:</strong> {String(value)}
                            </p>
                          );
                         })}
                         {activeType === "items" && (() => {
                           const system = getSourceSystem(item);
                           const technical = ITEM_TECHNICAL_FIELDS
                             .map((field) => [field, getTechnicalValue(system, field)] as const)
                             .filter(([, value]) => value !== null && value !== undefined && value !== "")
                             .slice(0, 3);
                           return technical.map(([field, value]) => {
                             const formatted = formatTechnicalField(field, value, modalLanguage);
                             if (!formatted) return null;
                             return (
                               <p key={`technical-${field}`} className="text-gray-300 text-xs">
                                 <strong className="text-gray-400">{getTechnicalLabel(field, modalLanguage)}:</strong> {formatted}
                               </p>
                             );
                           });
                         })()}
                        {Boolean(item.description) && (
                          <p className="text-gray-400 text-[11px] line-clamp-2 mt-1">
                            {String(item.description)}
                          </p>
                        )}
                        {item.campaignId ? (
                          <p className="text-[10px] text-purple-400 font-semibold pt-1">
                            Privado da campanha
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-500 pt-1">Global</p>
                        )}
                      </div>
                    </div>

                     <button
                       onClick={(event) => {
                         event.stopPropagation();
                         handleDelete(item.id as string);
                       }}
                       className="ml-2 shrink-0 text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>

                  {editingId === item.id && (
                     <div className="space-y-3 border-t border-gray-800 mt-3 pt-3" onClick={(event) => event.stopPropagation()}>
                      <p className="text-xs font-bold text-purple-300">
                        Editar {config.label.replace(/s$/, "")}
                      </p>
                      {renderFields(
                        editData,
                        (name, value) => setEditData((prev) => ({ ...prev, [name]: value })),
                        isSaving,
                        "edit"
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isSaving}
                          onClick={() => handleSaveEdit(item.id as string)}
                        >
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {selectedSpell && activeType === "spells" && (() => {
        const spell = selectedSpell as unknown as Spell;
        const isPt = modalLanguage === "pt";
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

        const displayName = getField("name") ? String(getField("name")) : String(spell.name);
        const displayDescription = getField("description") ? String(getField("description")) : null;
        const displayExtraEffect = getField("extraEffect") ? String(getField("extraEffect")) : null;
        const displayDuration = getField("duration") ? String(getField("duration")) : null;

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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setSelectedSpell(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="spell-details-title"
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-purple-800 bg-gray-950 p-6 text-gray-100 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                <div className="flex items-center gap-3">
                  {spell.imageUrl && !failedImages.has(spell.id as string) ? (
                    <img
                      src={String(spell.imageUrl)}
                      alt={`Imagem da magia ${displayName}`}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-lg border border-purple-900/60 object-cover"
                      onError={() => setFailedImages((previous) => new Set(previous).add(spell.id as string))}
                    />
                  ) : (
                    <div
                      aria-label={`Imagem indisponível para ${displayName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-purple-900/60 bg-gray-900 text-xl text-gray-600"
                    >
                      ✦
                    </div>
                  )}
                  <h3 id="spell-details-title" className="text-xl font-bold text-purple-200">
                    {displayName}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {isTranslating && (
                    <span className="text-xs text-purple-400 animate-pulse">
                      Traduzindo magia via IA...
                    </span>
                  )}
                  {spell.translation ? (
                    <div className="flex gap-1.5 rounded-lg border border-purple-800 bg-gray-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => setModalLanguage("pt")}
                        className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                          modalLanguage === "pt"
                            ? "bg-purple-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        🇧🇷 PT-BR
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalLanguage("en")}
                        className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                          modalLanguage === "en"
                            ? "bg-purple-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        🇺🇸 EN
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Fechar detalhes da magia"
                    onClick={() => setSelectedSpell(null)}
                    className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-5 pt-5">
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
                      {displayDuration && (
                        <span><strong className="text-purple-400 font-bold">{durationLabel}:</strong> {String(displayDuration)}</span>
                      )}
                      {renderActionCost(spell.actionCostOverride, getField("castingTime") as string) && (
                        <span className="inline-flex items-center gap-1"><strong className="text-purple-400 font-bold">{castingTimeLabel}:</strong> {renderActionCost(spell.actionCostOverride, getField("castingTime") as string)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {displayDescription ? (
                  <section>
                    <h4 className="mb-1 text-sm font-semibold text-purple-300">{descriptionLabel}</h4>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{displayDescription}</p>
                  </section>
                ) : null}
                 {displayExtraEffect ? (
                   <section>
                     <h4 className="mb-1 text-sm font-semibold text-purple-300">{extraEffectLabel}</h4>
                     <p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{displayExtraEffect}</p>
                   </section>
                 ) : null}
               </div>
            </div>
          </div>
        );
      })()}

      {selectedSpell && activeType === "items" && (() => {
         const item = selectedSpell;
         const translation = item.translation && typeof item.translation === "object" ? item.translation as Record<string, unknown> : null;
         const getItemField = (key: string) => modalLanguage === "pt" && translation?.[key] ? translation[key] : item[key];
        const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
        const system = sourceData.system && typeof sourceData.system === "object" ? sourceData.system as Record<string, unknown> : {};
        const display = (key: string, label: string) => {
          const raw = system[key];
          const value = raw && typeof raw === "object" && "value" in raw ? (raw as Record<string, unknown>).value : raw;
          if (value === null || value === undefined || value === "") return null;
          const formatted = formatTechnicalField(key, value, modalLanguage);
          if (!formatted) return null;
          return <span><strong className="text-purple-400">{getTechnicalLabel(key, modalLanguage)}:</strong> {formatted}</span>;
        };
        return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setSelectedSpell(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="item-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-purple-800 bg-gray-950 p-6 text-gray-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
               <div className="flex items-center gap-3">{item.imageUrl && !failedImages.has(String(item.id)) ? <img src={String(item.imageUrl)} alt={`Imagem de ${String(item.name)}`} className="h-11 w-11 rounded-lg border border-purple-900/60 object-cover" onError={() => setFailedImages((previous) => new Set(previous).add(String(item.id)))} /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-purple-900/60 bg-gray-900 text-xl text-gray-600">✦</div>}<h3 id="item-details-title" className="text-xl font-bold text-purple-200">{String(getItemField("name"))}</h3></div>
               <div className="flex items-center gap-2">{isTranslating && <span className="text-xs text-purple-400 animate-pulse">Traduzindo item...</span>}{translation && <div className="flex gap-1 rounded-lg border border-purple-800 bg-gray-900 p-0.5"><button type="button" onClick={() => setModalLanguage("pt")} className="rounded px-2 py-1 text-xs">PT</button><button type="button" onClick={() => setModalLanguage("en")} className="rounded px-2 py-1 text-xs">EN</button></div>}</div>
              <button type="button" aria-label="Fechar detalhes do item" onClick={() => setSelectedSpell(null)} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white">✕</button>
            </div>
            <div className="space-y-5 pt-5">
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-purple-900/20 pb-3 text-xs text-gray-300">
                {ITEM_TECHNICAL_FIELDS.map(field => display(field, field))}
              </div>
               {getItemField("description") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Descrição</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("description"))}</p></section> : null}
               {getItemField("qualityDescription") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Qualidade</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("qualityDescription"))}</p></section> : null}
               {getItemField("counterpointDescription") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Contraponto</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("counterpointDescription"))}</p></section> : null}
            </div>
          </div>
        </div>;
      })()}

      {/* Modal / Overlay de Criação de Conteúdo */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <h3 className="text-base font-bold text-purple-200">
                Criar Nova {config.label.replace(/s$/, "")}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <Form onSubmit={handleCreate} error={undefined}>
              {renderFields(
                formData,
                (name, value) => setFormData((prev) => ({ ...prev, [name]: value })),
                isCreating,
                "create"
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 rounded-xl border border-gray-800 bg-gray-900 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <Button type="submit" variant="master" isLoading={isCreating} className="w-1/2">
                  Criar
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
