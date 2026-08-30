"use client";

import { getTechnicalLabel, formatTechnicalField } from "@/lib/content/pf2e-item-formatter";
import { useEffect, useState } from "react";
import { ATTRIBUTES, SPELL_USE_TYPES } from "@/lib/utils/constants";
import type { ContentType } from "@/lib/validators/content";
import { Button, Form, Input, Spinner } from "@/components/ui";
import type { Spell } from "@/types";

import { LibraryClasses } from "@/components/classes/LibraryClasses";
import { LibraryClassFeatures } from "@/components/classes/LibraryClassFeatures";
import { LibraryRaces } from "@/components/races/LibraryRaces";
import { LibraryNpcs } from "@/components/npcs/LibraryNpcs";
import { LibraryWorlds } from "@/components/worlds/LibraryWorlds";
import { useRef } from "react";
import { getCsrfToken } from "@/lib/client/csrf";

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

type ManagerContentType = ContentType | "classes" | "class-features" | "races" | "npcs" | "worlds";

const TYPE_CONFIGS: Record<ManagerContentType, TypeConfig> = {
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
    showInList: [],
  },
  conditions: {
    label: "Condições",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
    ],
    showInList: [],
  },
  classes: {
    label: "Classes",
    fields: [],
    showInList: [],
  },
  "class-features": {
    label: "Habilidades de Classe",
    fields: [],
    showInList: [],
  },
  races: {
    label: "Raças",
    fields: [],
    showInList: [],
  },
  npcs: {
    label: "NPCs",
    fields: [],
    showInList: [],
  },
  worlds: {
    label: "Mundos",
    fields: [],
    showInList: [],
  },
};

const CONTENT_TYPE_ORDER: ManagerContentType[] = [
  "skills",
  "spells",
  "items",
  "conditions",
  "classes",
  "class-features",
  "races",
  "npcs",
  "worlds",
];

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

function getItemPrice(item: Item): number {
  const system = getSourceSystem(item);
  const rawPrice = system.price ?? item.price;
  if (rawPrice === null || rawPrice === undefined) return 0;
  if (typeof rawPrice === "number") return rawPrice;
  if (typeof rawPrice === "string") {
    const trimmed = rawPrice.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return getItemPrice({ price: parsed });
      } catch {
        const num = parseFloat(trimmed);
        return isNaN(num) ? 0 : num;
      }
    }
    const num = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  }
  if (typeof rawPrice === "object") {
    let valueObj = rawPrice as Record<string, unknown>;
    if (valueObj.value && typeof valueObj.value === "object") {
      valueObj = valueObj.value as Record<string, unknown>;
    } else if (typeof valueObj.value === "number") {
      return valueObj.value;
    } else if (typeof valueObj.value === "string") {
      const num = parseFloat(valueObj.value.replace(/[^0-9.]/g, ""));
      return isNaN(num) ? 0 : num;
    }
    let totalGp = 0;
    if (typeof valueObj.pp === "number") totalGp += valueObj.pp * 10;
    if (typeof valueObj.gp === "number") totalGp += valueObj.gp;
    if (typeof valueObj.sp === "number") totalGp += valueObj.sp / 10;
    if (typeof valueObj.cp === "number") totalGp += valueObj.cp / 100;
    return totalGp;
  }
  return 0;
}

function getItemLevel(item: Item): number {
  const system = getSourceSystem(item);
  const sysLevel = system.level;
  if (sysLevel && typeof sysLevel === "object" && "value" in sysLevel) {
    const val = (sysLevel as Record<string, unknown>).value;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) return n;
    }
  } else if (typeof sysLevel === "number") {
    return sysLevel;
  } else if (typeof sysLevel === "string") {
    const n = parseInt(sysLevel, 10);
    if (!isNaN(n)) return n;
  }

  const rawLevel = item.level;
  if (typeof rawLevel === "number") return rawLevel;
  if (typeof rawLevel === "string") {
    const n = parseInt(rawLevel, 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function getItemBulk(item: Item): number {
  const system = getSourceSystem(item);
  const sysBulk = system.bulk;
  let val: unknown = sysBulk;
  if (sysBulk && typeof sysBulk === "object" && "value" in sysBulk) {
    val = (sysBulk as Record<string, unknown>).value;
  }
  if (val === null || val === undefined) {
    val = item.bulk;
  }
  if (val === "L" || val === "l") return 0.1;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    if (val.toUpperCase() === "L") return 0.1;
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function getSpellActions(spell: Item): number | null {
  const override = spell.actionCostOverride;
  if (typeof override === "number" && override >= 0 && override <= 3) {
    return override;
  }
  const castingTime = spell.castingTime;
  if (typeof castingTime === "string") {
    const clean = castingTime.toLowerCase();
    if (clean.includes("1 action") || clean.includes("1 ação") || clean.includes("1 acao")) return 1;
    if (clean.includes("2 action") || clean.includes("2 ações") || clean.includes("2 acoes")) return 2;
    if (clean.includes("3 action") || clean.includes("3 ações") || clean.includes("3 acoes")) return 3;
    if (clean.includes("1")) return 1;
    if (clean.includes("2")) return 2;
    if (clean.includes("3")) return 3;
  }
  return null;
}

function getTechnicalValue(system: Record<string, unknown>, key: string): unknown {
  const raw = system[key];
  return raw && typeof raw === "object" && "value" in raw ? (raw as Record<string, unknown>).value : raw;
}

export function ContentManager({ basePath, title }: ContentManagerProps) {
  const [activeType, setActiveType] = useState<ManagerContentType>("skills");
  const classActionsRef = useRef<{
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  } | null>(null);
  const raceActionsRef = useRef<{
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  } | null>(null);
  const npcActionsRef = useRef<{
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  } | null>(null);
  const worldActionsRef = useRef<{ openCreate: () => void } | null>(null);
  const isCampaignContext = basePath.includes("/api/campaigns/");
  const availableTypes = isCampaignContext
    ? CONTENT_TYPE_ORDER.filter((t) => t !== "npcs" && t !== "worlds" && t !== "classes" && t !== "class-features" && t !== "races")
    : CONTENT_TYPE_ORDER;
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
  // State de Filtros Avançados - Magias
  const [spellCircleFilter, setSpellCircleFilter] = useState<number | "all">("all");
  const [spellManaMin, setSpellManaMin] = useState<number>(0);
  const [spellManaMax, setSpellManaMax] = useState<number>(50);
  const [spellActionsFilter, setSpellActionsFilter] = useState<number | "all">("all");

  // State de Filtros Avançados - Itens
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "weapons" | "armors" | "magic" | "consumables">("all");
  const [itemPriceMin, setItemPriceMin] = useState<number>(0);
  const [itemPriceMax, setItemPriceMax] = useState<number>(1000);
  const [itemLevelFilter, setItemLevelFilter] = useState<number | "all">("all");
  const [itemBulkFilter, setItemBulkFilter] = useState<number | "all">("all");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedSpell, setSelectedSpell] = useState<Item | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [modalLanguage, setModalLanguage] = useState<"en" | "pt">("en");
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationCode, setTranslationCode] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeType,
    searchContent,
    spellCircleFilter,
    spellManaMin,
    spellManaMax,
    spellActionsFilter,
    itemTypeFilter,
    itemPriceMin,
    itemPriceMax,
    itemLevelFilter,
    itemBulkFilter,
  ]);

  useEffect(() => {
    if (!selectedSpell || (activeType !== "spells" && activeType !== "items")) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedSpell(null);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedSpell]);

  // Helpers para traduzir — com feedback acionável e retry
  const humanizeTranslationError = (code: string | null, rawError: string): string => {
    if (!code) return rawError || "Erro desconhecido ao traduzir.";
    if (code === "translation_provider_unconfigured") return "Tradução não configurada: defina NINEROUTER_KEY no .env ou variável ZimaOS.";
    if (code === "translation_provider_timeout") return "Tradução indisponível: tempo esgotado ao contatar 9Router (modelo 120b lento, 25s). Tente novamente.";
    if (code === "translation_provider_unreachable") return "Tradução indisponível: verifique conexão com 9Router (100.83.170.1 não alcançável do container). Tente novamente ou configure NINEROUTER_URL público (docs/deploy-zimaos.md).";
    if (code.startsWith("translation_provider_http_")) {
      const status = code.replace("translation_provider_http_", "");
      const snippet = rawError.includes(":") ? rawError.split(":").slice(1).join(":").trim().slice(0, 200) : "";
      return `Erro do provedor 9Router (HTTP ${status})${snippet ? `: ${snippet}` : ""}. Verifique KEY/modelo.`;
    }
    if (code === "translation_provider_empty") return "Tradução indisponível: resposta vazia do 9Router.";
    if (code === "translation_provider_invalid_json") return "Tradução indisponível: resposta inválida (JSON) do 9Router.";
    return rawError || `Erro: ${code}`;
  };

  const triggerTranslate = async (spellId: string, type: typeof activeType) => {
    setTranslationError(null);
    setTranslationCode(null);
    setIsTranslating(true);
    try {
      const csrfToken = getCsrfToken();
      const res = await fetch(`/api/content/${type}/${spellId}/translate`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; translation?: unknown; error?: string; code?: string; details?: string };
      if (!res.ok) {
        const code = (data.code as string) || (data.error as string) || `translation_provider_http_${res.status}`;
        const raw = (data.error as string) || `HTTP ${res.status}`;
        // Normaliza code se vier como mensagem completa
        const normalizedCode = code.startsWith("translation_provider_") ? code.split(":")[0].trim() : code.startsWith("translation_provider") ? code : `translation_provider_http_${res.status}`;
        // Se error já contém code prefix, extrai
        const finalCode = (data.code || (raw.startsWith("translation_provider_") ? raw.split(":")[0].trim() : normalizedCode)) as string;
        const msg = humanizeTranslationError(finalCode, raw);
        throw Object.assign(new Error(msg), { code: finalCode, raw });
      }
      if (data.success && data.translation) {
        setItems((prevItems) =>
          prevItems.map((item) => (item.id === spellId ? { ...item, translation: data.translation } : item))
        );
        setSelectedSpell((prev) => (prev && prev.id === spellId ? { ...prev, translation: data.translation } as Item : prev));
        setModalLanguage("pt");
        setTranslationError(null);
        setTranslationCode(null);
      } else {
        throw new Error("Resposta sem tradução");
      }
    } catch (err) {
      const e = err as { code?: string; message?: string; raw?: string };
      const code = (e.code as string) || "translation_provider_unreachable";
      const rawMsg = (e.raw as string) || (e.message as string) || "Erro desconhecido";
      const human = e.message && e.message.includes("Tradução") ? e.message : humanizeTranslationError(code, rawMsg);
      setTranslationCode(code);
      setTranslationError(human);
      console.error(`Erro ao traduzir ${type === "items" ? "item" : "magia"}:`, code, rawMsg);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRetryTranslate = () => {
    if (!selectedSpell) return;
    const id = selectedSpell.id as string;
    triggerTranslate(id, activeType);
  };

  useEffect(() => {
    if (!selectedSpell || (activeType !== "spells" && activeType !== "items")) {
      Promise.resolve().then(() => {
        setIsTranslating(false);
        setTranslationError(null);
        setTranslationCode(null);
      });
      return;
    }

    const spell = selectedSpell as unknown as Spell;
    const hasTranslation = !!spell.translation;
    if (hasTranslation) {
      Promise.resolve().then(() => {
        setModalLanguage("pt");
        setTranslationError(null);
        setTranslationCode(null);
      });
      return;
    }

    // No translation, trigger translation
    Promise.resolve().then(() => {
      setModalLanguage("en");
      setTranslationError(null);
      setTranslationCode(null);
    });

    const spellId = spell.id as string;
    let active = true;

    // Usa helper com tratamento granular
    (async () => {
      setIsTranslating(true);
      try {
        const csrfToken = getCsrfToken();
        const res = await fetch(`/api/content/${activeType}/${spellId}/translate`, {
          method: "POST",
          credentials: "include",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; translation?: unknown; error?: string; code?: string; details?: string };
        if (!active) return;
        if (!res.ok) {
          const raw = (data.error as string) || `HTTP ${res.status}`;
          const code = (data.code as string) || (raw.startsWith("translation_provider_") ? raw.split(":")[0].trim() : `translation_provider_http_${res.status}`);
          const msg = humanizeTranslationError(code, raw);
          setTranslationCode(code);
          setTranslationError(msg);
          console.error(`Erro ao traduzir ${activeType === "items" ? "item" : "magia"}:`, code, raw);
          return;
        }
        if (data.success && data.translation) {
          setItems((prevItems) => prevItems.map((item) => (item.id === spellId ? { ...item, translation: data.translation } : item)));
          setSelectedSpell((prev) => (prev && prev.id === spellId ? { ...prev, translation: data.translation } as Item : prev));
          setModalLanguage("pt");
          setTranslationError(null);
          setTranslationCode(null);
        }
      } catch (err) {
        if (!active) return;
        const e = err as { code?: string; message?: string };
        const code = (e.code as string) || "translation_provider_unreachable";
        const raw = (e.message as string) || "Erro desconhecido";
        const msg = raw.includes("Tradução") ? raw : humanizeTranslationError(code, raw);
        setTranslationCode(code);
        setTranslationError(msg);
        console.error(`Erro ao traduzir ${activeType === "items" ? "item" : "magia"}:`, code, raw);
      } finally {
        if (active) setIsTranslating(false);
      }
    })();

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
    if (activeType === "classes" || activeType === "class-features" || activeType === "races" || activeType === "npcs" || activeType === "worlds") {
      setIsLoading(false);
      return;
    }

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
  ) => {
    return config.fields.map((field) => {
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
              className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition disabled:bg-gray-950"
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
              className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">{title}</h2>

        <div className="flex items-center gap-2">
          {activeType === "classes" && (
            <>
              <button
                type="button"
                onClick={() => classActionsRef.current?.openCreate()}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Criar Classe</span>
              </button>
              <button
                type="button"
                onClick={() => classActionsRef.current?.openPf2eCatalog?.()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>⚔️</span>
                <span>Catálogo Pathfinder 2e</span>
              </button>
              <button
                type="button"
                onClick={() => classActionsRef.current?.openCatalog()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>🐉</span>
                <span>Catálogo D&D 5e</span>
              </button>
            </>
          )}

          {activeType === "races" && (
            <>
              <button
                type="button"
                onClick={() => raceActionsRef.current?.openCreate()}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Criar Raça</span>
              </button>
              <button
                type="button"
                onClick={() => raceActionsRef.current?.openPf2eCatalog?.()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>⚔️</span>
                <span>Catálogo Pathfinder 2e</span>
              </button>
              <button
                type="button"
                onClick={() => raceActionsRef.current?.openCatalog()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>🐉</span>
                <span>Catálogo D&D 5e</span>
              </button>
            </>
          )}

          {activeType === "npcs" && (
            <>
              <button
                type="button"
                onClick={() => npcActionsRef.current?.openCreate()}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Criar Novo NPC</span>
              </button>
              <button
                type="button"
                onClick={() => npcActionsRef.current?.openPf2eCatalog?.()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>⚔️</span>
                <span>Catálogo Pathfinder 2e</span>
              </button>
              <button
                type="button"
                onClick={() => npcActionsRef.current?.openCatalog()}
                className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg flex items-center gap-2"
              >
                <span>🐉</span>
                <span>Catálogo D&D 5e (334 Monstros)</span>
              </button>
            </>
          )}

          {activeType === "worlds" && (
            <button
              type="button"
              onClick={() => worldActionsRef.current?.openCreate()}
              className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Criar Mundo</span>
            </button>
          )}

          {activeType !== "classes" && activeType !== "class-features" && activeType !== "races" && activeType !== "npcs" && activeType !== "worlds" && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 border-b border-gray-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setActiveType(type);
                  setFormData({});
                  setEditingId(null);
                  setSelectedSpell(null);
                  setSearchContent("");
                  setItemTypeFilter("all");
                  setSpellCircleFilter("all");
                  setSpellManaMin(0);
                  setSpellManaMax(50);
                  setSpellActionsFilter("all");
                  setItemPriceMin(0);
                  setItemPriceMax(1000);
                  setItemLevelFilter("all");
                  setItemBulkFilter("all");
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

          {activeType !== "classes" && activeType !== "class-features" && activeType !== "races" && activeType !== "npcs" && activeType !== "worlds" && (
            <input
              type="text"
              placeholder={`Buscar ${config.label.toLowerCase()} por nome...`}
              value={searchContent}
              onChange={(e) => setSearchContent(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
            />
          )}
        </div>

        {/* Painel de Filtros Avançados para Magias */}
        {activeType === "spells" && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gray-800/80 bg-gray-950/70 p-3 text-xs">
            {/* Círculo */}
            <select
              value={spellCircleFilter}
              onChange={(e) => setSpellCircleFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none transition-all"
            >
              <option value="all">Círculo (Todos)</option>
              <option value={0}>Truque (0)</option>
              <option value={1}>1º Círculo</option>
              <option value={2}>2º Círculo</option>
              <option value={3}>3º Círculo</option>
              <option value={4}>4º Círculo</option>
              <option value={5}>5º Círculo</option>
              <option value={6}>6º Círculo</option>
              <option value={7}>7º Círculo</option>
              <option value={8}>8º Círculo</option>
              <option value={9}>9º Círculo</option>
            </select>

            {/* Custo de Mana (Sliders Minimalistas Min/Max) */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-white">
              <span className="text-[11px] font-semibold text-purple-300 whitespace-nowrap">
                {spellManaMin} MP - {spellManaMax >= 50 ? "50+ MP" : `${spellManaMax} MP`}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={spellManaMin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSpellManaMin(val > spellManaMax ? spellManaMax : val);
                  }}
                  className="h-1 w-16 accent-purple-500 cursor-pointer"
                  title={`Min: ${spellManaMin} MP`}
                />
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={spellManaMax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSpellManaMax(val < spellManaMin ? spellManaMin : val);
                  }}
                  className="h-1 w-16 accent-purple-500 cursor-pointer"
                  title={`Max: ${spellManaMax >= 50 ? "50+ MP" : `${spellManaMax} MP`}`}
                />
              </div>
            </div>

            {/* Tempo de Conjuração (Chips ultra-compactos) */}
            <div className="flex flex-wrap gap-1 items-center">
              {[
                ["all", "Todas"],
                [1, "1 Ação"],
                [2, "2 Ações"],
                [3, "3 Ações"],
              ].map(([actValue, actLabel]) => (
                <button
                  key={String(actValue)}
                  type="button"
                  onClick={() => setSpellActionsFilter(actValue as number | "all")}
                  className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
                    spellActionsFilter === actValue
                      ? "bg-purple-600 text-white shadow"
                      : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {actLabel}
                </button>
              ))}
            </div>

            {/* Botão Limpar ultra-compacto */}
            {(spellCircleFilter !== "all" || spellManaMin !== 0 || spellManaMax !== 50 || spellActionsFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSpellCircleFilter("all");
                  setSpellManaMin(0);
                  setSpellManaMax(50);
                  setSpellActionsFilter("all");
                }}
                className="rounded-xl border border-gray-800 bg-gray-900 px-2 py-1 text-xs text-purple-400 hover:bg-gray-800 hover:text-purple-300 transition-all font-bold"
                title="Limpar Filtros"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Painel de Filtros Avançados para Itens */}
        {activeType === "items" && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gray-800/80 bg-gray-950/70 p-3 text-xs">
            {/* Tipo */}
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value as typeof itemTypeFilter)}
              className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none transition-all"
            >
              <option value="all">Tipo (Todos)</option>
              <option value="weapons">⚔️ Armas</option>
              <option value="armors">🛡️ Armaduras</option>
              <option value="magic">✨ Mágicos</option>
              <option value="consumables">🧪 Consumíveis</option>
            </select>

            {/* Custo / Preço (Sliders Minimalistas Min/Max) */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-white">
              <span className="text-[11px] font-semibold text-purple-300 whitespace-nowrap">
                {itemPriceMin} - {itemPriceMax >= 1000 ? "1000+ PO" : `${itemPriceMax} PO`}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={itemPriceMin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setItemPriceMin(val > itemPriceMax ? itemPriceMax : val);
                  }}
                  className="h-1 w-16 accent-purple-500 cursor-pointer"
                  title={`Min: ${itemPriceMin} PO`}
                />
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={itemPriceMax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setItemPriceMax(val < itemPriceMin ? itemPriceMin : val);
                  }}
                  className="h-1 w-16 accent-purple-500 cursor-pointer"
                  title={`Max: ${itemPriceMax >= 1000 ? "1000+ PO" : `${itemPriceMax} PO`}`}
                />
              </div>
            </div>

            {/* Nível */}
            <select
              value={itemLevelFilter}
              onChange={(e) => setItemLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none transition-all"
            >
              <option value="all">Nível (Todos)</option>
              {Array.from({ length: 21 }, (_, i) => (
                <option key={i} value={i}>
                  Nv {i}
                </option>
              ))}
            </select>

            {/* Peso / Bulk */}
            <select
              value={itemBulkFilter}
              onChange={(e) => setItemBulkFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none transition-all"
            >
              <option value="all">Peso (Todos)</option>
              <option value={0}>0 Bulk</option>
              <option value={0.1}>L (Leve)</option>
              <option value={1}>1 Bulk</option>
              <option value={2}>2 Bulk</option>
              <option value={3}>3+ Bulk</option>
            </select>

            {/* Botão Limpar ultra-compacto */}
            {(itemTypeFilter !== "all" || itemPriceMin !== 0 || itemPriceMax !== 1000 || itemLevelFilter !== "all" || itemBulkFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setItemTypeFilter("all");
                  setItemPriceMin(0);
                  setItemPriceMax(1000);
                  setItemLevelFilter("all");
                  setItemBulkFilter("all");
                }}
                className="rounded-xl border border-gray-800 bg-gray-900 px-2 py-1 text-xs text-purple-400 hover:bg-gray-800 hover:text-purple-300 transition-all font-bold"
                title="Limpar Filtros"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {activeType === "classes" ? (
        <LibraryClasses
          onRegisterActions={(actions) => (classActionsRef.current = actions)}
          onNavigateToFeatures={() => setActiveType("class-features")}
        />
      ) : activeType === "class-features" ? (
        <LibraryClassFeatures />
      ) : activeType === "races" ? (
        <LibraryRaces onRegisterActions={(actions) => (raceActionsRef.current = actions)} />
      ) : activeType === "npcs" ? (
        <LibraryNpcs onRegisterActions={(actions) => (npcActionsRef.current = actions)} />
      ) : activeType === "worlds" ? (
        <LibraryWorlds onRegisterActions={(actions) => (worldActionsRef.current = actions)} />
      ) : (
        /* Área Principal de Conteúdo (Full Width) */
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl flex flex-col max-h-[calc(100vh-16rem)]">
        <h3 className="mb-3 font-semibold text-white text-sm flex items-center justify-between">
          <span>{config.label} Cadastradas</span>
          <span className="text-xs text-purple-400 font-bold bg-purple-950/60 border border-purple-900/60 px-2.5 py-1 rounded-lg">{items.length} itens</span>
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
        ) : (() => {
          const filteredItems = items.filter((item) => {
            const name = String(item.name || "").toLowerCase();
            const desc = String(item.description || "").toLowerCase();
            const matchSearch = name.includes(searchContent.toLowerCase()) || desc.includes(searchContent.toLowerCase());
            if (!matchSearch) return false;

            if (activeType === "spells") {
              if (spellCircleFilter !== "all") {
                const circle = typeof item.circle === "number" ? item.circle : 0;
                if (circle !== spellCircleFilter) return false;
              }
              const mana = typeof item.manaCost === "number" ? item.manaCost : 0;
              if (mana < spellManaMin) return false;
              if (spellManaMax < 50 && mana > spellManaMax) return false;
              if (spellActionsFilter !== "all") {
                const actions = getSpellActions(item);
                if (actions !== spellActionsFilter) return false;
              }
            }

            if (activeType === "items") {
              if (itemTypeFilter !== "all") {
                const sourceData = item.sourceData && typeof item.sourceData === "object" ? item.sourceData as Record<string, unknown> : {};
                const source = sourceData.source && typeof sourceData.source === "object" ? sourceData.source as Record<string, unknown> : {};
                const category = String(item.category || source.category || "").toLowerCase();
                const text = `${name} ${desc} ${category}`;

                if (itemTypeFilter === "weapons") {
                  if (!category.includes("weapon") && !/sword|bow|axe|blade|dagger|spear|mace|staff|hammer|weapon|arma|espada|machado|arco|adaga|lança|clava|cajado|martelo|cimitarra/i.test(text)) return false;
                } else if (itemTypeFilter === "armors") {
                  if (!/armor|shield|chain|plate|leather|helm|escudo|armadura|cota|couro|elmo/i.test(text)) return false;
                } else if (itemTypeFilter === "magic") {
                  if (!Boolean(item.qualityDescription || item.counterpointDescription || /magic|ring|wand|scroll|potion|mágico|anel|vara|pergaminho|poção/i.test(text))) return false;
                } else if (itemTypeFilter === "consumables") {
                  if (!/potion|food|ration|herb|poção|comida|ração|erva|kit|tocha|corda/i.test(text)) return false;
                }
              }

              const price = getItemPrice(item);
              if (price < itemPriceMin) return false;
              if (itemPriceMax < 1000 && price > itemPriceMax) return false;
              if (itemLevelFilter !== "all") {
                const level = getItemLevel(item);
                if (level !== itemLevelFilter) return false;
              }
              if (itemBulkFilter !== "all") {
                const bulk = getItemBulk(item);
                if (itemBulkFilter === 3) {
                  if (bulk < 3) return false;
                } else {
                  if (bulk !== itemBulkFilter) return false;
                }
              }
            }

            return true;
          });

          const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
          const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

          return (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {paginatedItems.map((item) => (
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
                      className={`rounded-xl border border-gray-800 bg-gray-950 p-3.5 hover:border-purple-600/60 hover:shadow-lg transition-all cursor-pointer ${
                        activeType === "spells" || activeType === "items" ? "focus:outline-none focus:ring-2 focus:ring-purple-500" : ""
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
                              <p className="line-clamp-2 text-gray-400 text-xs mt-1">
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
              </div>

              {filteredItems.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 mt-3">
                  <span className="text-xs text-gray-400">
                    Exibindo {Math.min((currentPage - 1) * pageSize + 1, filteredItems.length)} a {Math.min(currentPage * pageSize, filteredItems.length)} de {filteredItems.length} {config.label.toLowerCase()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Anterior
                    </button>
                    <span className="px-2 text-xs font-bold text-purple-400">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
      )}

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

              {translationError && (
                <div className="mt-4 rounded-xl border border-red-800 bg-red-900/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-red-300">Tradução indisponível</p>
                      <p className="mt-1 text-xs leading-5 text-red-200">{translationError}</p>
                      {translationCode && <p className="mt-1 text-[11px] font-mono text-red-300/70">{translationCode}</p>}
                      <p className="mt-2 text-[11px] text-red-300/80">Dica: verifique se NINEROUTER_URL é pública (Funnel/Cloudflare) ou se o host está no Tailnet. Código tenta fallback host.docker.internal automaticamente quando 100.83.170.1 falha.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetryTranslate}
                      disabled={isTranslating}
                      className="shrink-0 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {isTranslating ? "Tentando..." : "Tentar novamente"}
                    </button>
                  </div>
                </div>
              )}

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
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setSelectedSpell(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="item-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-purple-800 bg-gray-950 p-6 text-gray-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                 <div className="flex items-center gap-3">{item.imageUrl && !failedImages.has(String(item.id)) ? <img src={String(item.imageUrl)} alt={`Imagem de ${String(item.name)}`} className="h-11 w-11 rounded-lg border border-purple-900/60 object-cover" onError={() => setFailedImages((previous) => new Set(previous).add(String(item.id)))} /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-purple-900/60 bg-gray-900 text-xl text-gray-600">✦</div>}<h3 id="item-details-title" className="text-xl font-bold text-purple-200">{String(getItemField("name"))}</h3></div>
                 <div className="flex items-center gap-2">{isTranslating && <span className="text-xs text-purple-400 animate-pulse">Traduzindo item...</span>}{translation && <div className="flex gap-1 rounded-lg border border-purple-800 bg-gray-900 p-0.5"><button type="button" onClick={() => setModalLanguage("pt")} className="rounded px-2 py-1 text-xs">PT</button><button type="button" onClick={() => setModalLanguage("en")} className="rounded px-2 py-1 text-xs">EN</button></div>}</div>
                 <button type="button" aria-label="Fechar detalhes do item" onClick={() => setSelectedSpell(null)} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white">✕</button>
               </div>
               {translationError && (
                 <div className="mt-4 rounded-xl border border-red-800 bg-red-900/30 p-3 text-sm">
                   <div className="flex items-start justify-between gap-3">
                     <div className="flex-1">
                       <p className="font-bold text-red-300">Tradução indisponível</p>
                       <p className="mt-1 text-xs leading-5 text-red-200">{translationError}</p>
                       {translationCode && <p className="mt-1 text-[11px] font-mono text-red-300/70">{translationCode}</p>}
                       <p className="mt-2 text-[11px] text-red-300/80">Dica: verifique NINEROUTER_URL público ou rota Tailscale. Fallback host.docker.internal tentado automaticamente.</p>
                     </div>
                     <button
                       type="button"
                       onClick={handleRetryTranslate}
                       disabled={isTranslating}
                       className="shrink-0 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                     >
                       {isTranslating ? "Tentando..." : "Tentar novamente"}
                     </button>
                   </div>
                 </div>
               )}
               <div className="space-y-5 pt-5">
                 <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-purple-900/20 pb-3 text-xs text-gray-300">
                  {ITEM_TECHNICAL_FIELDS.map(field => display(field, field))}
                </div>
                 {getItemField("description") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Descrição</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("description"))}</p></section> : null}
                 {getItemField("qualityDescription") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Qualidade</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("qualityDescription"))}</p></section> : null}
                 {getItemField("counterpointDescription") ? <section><h4 className="mb-1 text-sm font-semibold text-purple-300">Contraponto</h4><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{String(getItemField("counterpointDescription"))}</p></section> : null}
              </div>
            </div>
          </div>
        );
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
                  className="w-1/2 rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg"
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
