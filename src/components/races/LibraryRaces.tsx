"use client";

import { useEffect, useState, useCallback } from "react";
import type { RpgRace } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { Spinner } from "@/components/ui";

type LibraryRacesProps = {
  onRegisterActions?: (actions: {
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  }) => void;
};

type TraitItem = { name: string; description: string };
type HeritageItem = { name: string; description: string };

const COMMON_LANGUAGES = [
  "Comum",
  "Élfico",
  "Anão",
  "Dracônico",
  "Gnômico",
  "Goblin",
  "Halfling",
  "Orc",
  "Silvestre",
  "Abissal",
  "Celestial",
  "Infernal",
  "Sombrio",
  "Subterrâneo",
];

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força (FOR)",
  destreza: "Destreza (DES)",
  vigor: "Vigor (VIG)",
  inteligencia: "Inteligência (INT)",
  empatia: "Empatia (EMP)",
};

const DEFAULT_RACE_ATTRIBUTES: Record<Attribute, number> = {
  forca: 0,
  destreza: 0,
  vigor: 0,
  inteligencia: 0,
  empatia: 0,
};

export function LibraryRaces({ onRegisterActions }: LibraryRacesProps = {}) {
  const [races, setRaces] = useState<RpgRace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchRace, setSearchRace] = useState("");
  const [systemFilter, setSystemFilter] = useState<"all" | "dnd5e" | "pf2e" | "custom">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDndCatalogModal, setShowDndCatalogModal] = useState(false);
  const [showPf2eCatalogModal, setShowPf2eCatalogModal] = useState(false);
  const [detailRace, setDetailRace] = useState<RpgRace | null>(null);

  // Form Criação
  const [activeCreateTab, setActiveCreateTab] = useState<"geral" | "atributos" | "idiomas" | "tracos" | "herancas">("geral");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSpeed, setCreateSpeed] = useState("30");
  const [createSize, setCreateSize] = useState("Médio");
  const [createHitPointsBonus, setCreateHitPointsBonus] = useState("0");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [createSourceSystem, setCreateSourceSystem] = useState("custom");
  const [createAttributes, setCreateAttributes] = useState<Record<Attribute, number>>({ ...DEFAULT_RACE_ATTRIBUTES });
  const [createLanguages, setCreateLanguages] = useState<string[]>(["Comum"]);
  const [createLanguageInput, setCreateLanguageInput] = useState("");
  const [createTraits, setCreateTraits] = useState<TraitItem[]>([]);
  const [createTraitName, setCreateTraitName] = useState("");
  const [createTraitDesc, setCreateTraitDesc] = useState("");
  const [createHeritages, setCreateHeritages] = useState<HeritageItem[]>([]);
  const [createHeritageName, setCreateHeritageName] = useState("");
  const [createHeritageDesc, setCreateHeritageDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Form Edição
  const [activeDetailTab, setActiveDetailTab] = useState<"geral" | "atributos" | "idiomas" | "tracos" | "herancas">("geral");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSpeed, setEditSpeed] = useState("30");
  const [editSize, setEditSize] = useState("Médio");
  const [editHitPointsBonus, setEditHitPointsBonus] = useState("0");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editSourceSystem, setEditSourceSystem] = useState("custom");
  const [editAttributes, setEditAttributes] = useState<Record<Attribute, number>>({ ...DEFAULT_RACE_ATTRIBUTES });
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [editLanguageInput, setEditLanguageInput] = useState("");
  const [editTraits, setEditTraits] = useState<TraitItem[]>([]);
  const [editTraitName, setEditTraitName] = useState("");
  const [editTraitDesc, setEditTraitDesc] = useState("");
  const [editHeritages, setEditHeritages] = useState<HeritageItem[]>([]);
  const [editHeritageName, setEditHeritageName] = useState("");
  const [editHeritageDesc, setEditHeritageDesc] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Ações Assíncronas
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isTranslatingModal, setIsTranslatingModal] = useState(false);

  // Catálogo D&D 5e
  const [dndCatalogList, setDndCatalogList] = useState<Array<{ index: string; name: string }>>([]);
  const [selectedDndIndexes, setSelectedDndIndexes] = useState<Set<string>>(new Set());
  const [searchDndCatalog, setSearchDndCatalog] = useState("");
  const [translateDndWithLLM, setTranslateDndWithLLM] = useState(true);
  const [isLoadingDndCatalog, setIsLoadingDndCatalog] = useState(false);
  const [isImportingDnd, setIsImportingDnd] = useState(false);

  // Catálogo Pathfinder 2e
  const [pf2eCatalogList, setPf2eCatalogList] = useState<
    Array<{
      key: string;
      name: string;
      description: string;
      hitPointsBonus: number;
      speed: number;
      size: string;
      attributeBonuses: Record<string, number>;
      languages: string[];
      traitsCount: number;
      heritagesCount: number;
    }>
  >([]);
  const [selectedPf2eKeys, setSelectedPf2eKeys] = useState<Set<string>>(new Set());
  const [searchPf2eCatalog, setSearchPf2eCatalog] = useState("");
  const [translatePf2eWithLLM, setTranslatePf2eWithLLM] = useState(false);
  const [isLoadingPf2eCatalog, setIsLoadingPf2eCatalog] = useState(false);
  const [isImportingPf2e, setIsImportingPf2e] = useState(false);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const resetCreateForm = useCallback(() => {
    setActiveCreateTab("geral");
    setCreateName("");
    setCreateDescription("");
    setCreateSpeed("30");
    setCreateSize("Médio");
    setCreateHitPointsBonus("0");
    setCreateImageUrl("");
    setCreateSourceSystem("custom");
    setCreateAttributes({ ...DEFAULT_RACE_ATTRIBUTES });
    setCreateLanguages(["Comum"]);
    setCreateLanguageInput("");
    setCreateTraits([]);
    setCreateTraitName("");
    setCreateTraitDesc("");
    setCreateHeritages([]);
    setCreateHeritageName("");
    setCreateHeritageDesc("");
  }, []);

  const fetchRaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/races", { credentials: "include" });
      const data = await response.json();

      if (data.success) {
        setRaces(data.data || []);
      } else {
        setError(data.error || "Falha ao carregar raças");
      }
    } catch {
      setError("Erro de rede ao buscar raças");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDndCatalog = useCallback(async () => {
    try {
      setIsLoadingDndCatalog(true);
      const res = await fetch("/api/races/dnd-catalog", { credentials: "include" });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setDndCatalogList(data.results);
      }
    } catch (e) {
      console.error("Erro ao buscar catálogo D&D 5e:", e);
    } finally {
      setIsLoadingDndCatalog(false);
    }
  }, []);

  const fetchPf2eCatalog = useCallback(async () => {
    try {
      setIsLoadingPf2eCatalog(true);
      const res = await fetch("/api/races/pf2e-catalog", { credentials: "include" });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setPf2eCatalogList(data.results);
      }
    } catch (e) {
      console.error("Erro ao buscar catálogo Pathfinder 2e:", e);
    } finally {
      setIsLoadingPf2eCatalog(false);
    }
  }, []);

  useEffect(() => {
    void fetchRaces();
  }, [fetchRaces]);

  // Registra ações na toolbar superior do ContentManager
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        openCreate: () => {
          resetCreateForm();
          setShowCreateModal(true);
        },
        openCatalog: () => {
          void fetchDndCatalog();
          setShowDndCatalogModal(true);
        },
        openPf2eCatalog: () => {
          void fetchPf2eCatalog();
          setShowPf2eCatalogModal(true);
        },
      });
    }
  }, [onRegisterActions, resetCreateForm, fetchDndCatalog, fetchPf2eCatalog]);

  const handleOpenDetailModal = (race: RpgRace) => {
    setDetailRace(race);
    setActiveDetailTab("geral");
    setEditName(race.name);
    setEditDescription(race.description || "");
    setEditSpeed(String(race.speed ?? 30));
    setEditSize(race.size || "Médio");
    setEditHitPointsBonus(String(race.hitPointsBonus ?? 0));
    setEditImageUrl(race.imageUrl || "");
    setEditSourceSystem(race.sourceSystem || "custom");

    const attrs = { ...DEFAULT_RACE_ATTRIBUTES };
    if (race.attributeBonuses && typeof race.attributeBonuses === "object") {
      ATTRIBUTES.forEach((attr) => {
        if (typeof race.attributeBonuses[attr] === "number") {
          attrs[attr] = race.attributeBonuses[attr];
        }
      });
    }
    setEditAttributes(attrs);

    setEditLanguages(Array.isArray(race.languages) ? [...race.languages] : []);
    setEditLanguageInput("");
    setEditTraits(
      Array.isArray(race.traits)
        ? race.traits.map((t) => ({ name: t.name, description: t.description || "" }))
        : []
    );
    setEditTraitName("");
    setEditTraitDesc("");
    setEditHeritages(
      Array.isArray(race.heritages)
        ? race.heritages.map((h) => ({ name: h.name, description: h.description || "" }))
        : []
    );
    setEditHeritageName("");
    setEditHeritageDesc("");
  };

  // Criação de Nova Raça
  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setError("Nome da raça é obrigatório");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Filtra atributos com valor != 0 para salvar apenas bônus definidos
      const cleanAttrBonuses: Record<string, number> = {};
      Object.entries(createAttributes).forEach(([key, val]) => {
        if (val !== 0) cleanAttrBonuses[key] = val;
      });

      const payload = {
        name: createName.trim(),
        description: createDescription.trim() || null,
        speed: parseInt(createSpeed, 10) || 30,
        size: createSize.trim() || "Médio",
        hitPointsBonus: parseInt(createHitPointsBonus, 10) || 0,
        imageUrl: createImageUrl.trim() || null,
        sourceSystem: createSourceSystem || "custom",
        attributeBonuses: cleanAttrBonuses,
        languages: createLanguages,
        traits: createTraits,
        heritages: createHeritages,
      };

      const res = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        resetCreateForm();
        showToast(`Raça "${payload.name}" criada com sucesso!`);
        fetchRaces();
      } else {
        setError(data.error || "Erro ao criar raça");
      }
    } catch {
      setError("Erro de rede ao criar raça");
    } finally {
      setIsCreating(false);
    }
  };

  // Salvar Edição
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailRace) return;
    if (!editName.trim()) {
      setError("Nome da raça é obrigatório");
      return;
    }

    try {
      setIsSavingEdit(true);
      setError(null);

      const cleanAttrBonuses: Record<string, number> = {};
      Object.entries(editAttributes).forEach(([key, val]) => {
        if (val !== 0) cleanAttrBonuses[key] = val;
      });

      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        speed: parseInt(editSpeed, 10) || 30,
        size: editSize.trim() || "Médio",
        hitPointsBonus: parseInt(editHitPointsBonus, 10) || 0,
        imageUrl: editImageUrl.trim() || null,
        sourceSystem: editSourceSystem || "custom",
        attributeBonuses: cleanAttrBonuses,
        languages: editLanguages,
        traits: editTraits,
        heritages: editHeritages,
      };

      const res = await fetch(`/api/races/${detailRace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setDetailRace(data.data);
        showToast("Raça atualizada com sucesso!");
        fetchRaces();
      } else {
        setError(data.error || "Erro ao salvar alterações");
      }
    } catch {
      setError("Erro de rede ao salvar raça");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Tradução via IA (do card ou do modal)
  const handleTranslateRace = async (raceId: string, isFromModal = false) => {
    try {
      if (isFromModal) setIsTranslatingModal(true);
      else setTranslatingId(raceId);
      setError(null);

      const res = await fetch(`/api/races/${raceId}/translate`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.success && data.data) {
        showToast("Raça traduzida com sucesso via IA!");
        if (detailRace && detailRace.id === raceId) {
          handleOpenDetailModal(data.data);
        }
        fetchRaces();
      } else {
        setError(data.error || "Erro ao traduzir raça");
      }
    } catch {
      setError("Erro de comunicação com o serviço de tradução");
    } finally {
      if (isFromModal) setIsTranslatingModal(false);
      setTranslatingId(null);
    }
  };

  // Duplicação
  const handleDuplicateRace = async (raceId: string) => {
    try {
      setDuplicatingId(raceId);
      setError(null);

      const res = await fetch(`/api/races/${raceId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        showToast("Raça duplicada com sucesso!");
        fetchRaces();
      } else {
        setError(data.error || "Erro ao duplicar raça");
      }
    } catch {
      setError("Erro de rede ao duplicar raça");
    } finally {
      setDuplicatingId(null);
    }
  };

  // Exclusão
  const handleDeleteRace = async (raceId: string, raceName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a raça "${raceName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/races/${raceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        showToast("Raça excluída com sucesso!");
        if (detailRace?.id === raceId) setDetailRace(null);
        fetchRaces();
      } else {
        setError(data.error || "Erro ao excluir raça");
      }
    } catch {
      setError("Erro de rede ao excluir raça");
    }
  };

  // Importação D&D 5e
  const handleImportDndRaces = async (all = false) => {
    try {
      setIsImportingDnd(true);
      setError(null);

      const payload = {
        all,
        indexes: all ? [] : Array.from(selectedDndIndexes),
        translateWithLLM: translateDndWithLLM,
      };

      const res = await fetch("/api/races/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setShowDndCatalogModal(false);
        setSelectedDndIndexes(new Set());
        showToast(data.message || "Raças do D&D 5e importadas com sucesso!");
        fetchRaces();
      } else {
        setError(data.error || "Erro ao importar raças do D&D 5e");
      }
    } catch {
      setError("Erro de conexão ao importar raças do D&D 5e");
    } finally {
      setIsImportingDnd(false);
    }
  };

  // Importação Pathfinder 2e
  const handleImportPf2eRaces = async (all = false) => {
    try {
      setIsImportingPf2e(true);
      setError(null);

      const payload = {
        all,
        keys: all ? [] : Array.from(selectedPf2eKeys),
        translateWithLLM: translatePf2eWithLLM,
      };

      const res = await fetch("/api/races/import-pf2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setShowPf2eCatalogModal(false);
        setSelectedPf2eKeys(new Set());
        showToast(data.message || "Ancestralidades PF2e importadas com sucesso!");
        fetchRaces();
      } else {
        setError(data.error || "Erro ao importar ancestralidades do PF2e");
      }
    } catch {
      setError("Erro de conexão ao importar ancestralidades do PF2e");
    } finally {
      setIsImportingPf2e(false);
    }
  };

  // Filtragem
  const filteredRaces = races.filter((race) => {
    const q = searchRace.toLowerCase().trim();
    const matchName = race.name.toLowerCase().includes(q);
    const matchDesc = (race.description || "").toLowerCase().includes(q);
    const matchSearch = !q || matchName || matchDesc;

    if (!matchSearch) return false;

    if (systemFilter === "dnd5e") return race.sourceSystem === "dnd5e";
    if (systemFilter === "pf2e") return race.sourceSystem === "pf2e";
    if (systemFilter === "custom") return !race.sourceSystem || race.sourceSystem === "custom";

    return true;
  });

  const totalPages = Math.ceil(filteredRaces.length / pageSize) || 1;
  const paginatedRaces = filteredRaces.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getSystemBadge = (system: string | null) => {
    if (system === "dnd5e") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-800/60 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          🐉 D&D 5e
        </span>
      );
    }
    if (system === "pf2e") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-cyan-800/60 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
          ⚔️ Pathfinder 2e
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-purple-800/60 bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-300">
        ✨ Personalizado
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toast de Sucesso */}
      {successMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-3 text-sm text-emerald-200 shadow-2xl backdrop-blur">
          {successMessage}
        </div>
      )}

      {/* Alerta de Erro */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 p-3 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      {/* Painel Principal */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl flex flex-col min-h-[500px]">
        {/* Header e Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-white text-sm">Raças e Ancestralidades Cadastradas</h3>
            <span className="text-xs text-purple-400 font-bold bg-purple-950/60 border border-purple-900/60 px-2.5 py-1 rounded-lg">
              {filteredRaces.length} {filteredRaces.length === 1 ? "raça" : "raças"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Campo de Busca */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nome ou traço..."
                value={searchRace}
                onChange={(e) => {
                  setSearchRace(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-56 rounded-xl border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
              {searchRace && (
                <button
                  type="button"
                  onClick={() => setSearchRace("")}
                  className="absolute right-2.5 top-1.5 text-xs text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por Sistema */}
            <select
              value={systemFilter}
              onChange={(e) => {
                setSystemFilter(e.target.value as "all" | "dnd5e" | "pf2e" | "custom");
                setCurrentPage(1);
              }}
              className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-purple-300 focus:border-purple-500 focus:outline-none"
            >
              <option value="all">Todos os Sistemas</option>
              <option value="dnd5e">D&D 5e</option>
              <option value="pf2e">Pathfinder 2e</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
        </div>

        {/* Grid de Cards */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredRaces.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-sm text-gray-400">
            <span className="text-4xl mb-2">🧝♂️</span>
            <p className="font-semibold text-gray-300">Nenhuma raça encontrada.</p>
            <p className="text-xs text-gray-500 max-w-sm mt-1">
              Cadastre uma nova raça manualmente ou importe catálogos completos do Pathfinder 2e ou D&D 5e através dos botões na barra superior.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {paginatedRaces.map((race) => {
              const traits = (race.traits as Array<{ name: string; description?: string }>) || [];
              const heritages = (race.heritages as Array<{ name: string; description?: string }>) || [];
              const languages = (race.languages as string[]) || [];
              const attrBonuses = (race.attributeBonuses as Record<string, number>) || {};

              return (
                <div
                  key={race.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-800 bg-gray-950/80 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-gray-900 hover:shadow-lg hover:shadow-purple-950/20"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition">
                          {race.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {getSystemBadge(race.sourceSystem)}
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300 font-medium">
                            📏 {race.size || "Médio"}
                          </span>
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300 font-medium">
                            ⚡ {race.speed} pés
                          </span>
                          {race.hitPointsBonus > 0 && (
                            <span className="rounded bg-rose-950/60 border border-rose-900/60 px-1.5 py-0.5 text-[10px] text-rose-300 font-bold">
                              ❤️ +{race.hitPointsBonus} HP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Modificadores de Atributos */}
                    {Object.keys(attrBonuses).length > 0 && (
                      <div className="mb-2.5 flex flex-wrap gap-1">
                        {Object.entries(attrBonuses).map(([attr, bonus]) => {
                          if (bonus === 0) return null;
                          const isPos = bonus > 0;
                          return (
                            <span
                              key={attr}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isPos
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                                  : "bg-red-950/80 text-red-300 border border-red-800/60"
                              }`}
                            >
                              {attr.slice(0, 3).toUpperCase()} {isPos ? `+${bonus}` : bonus}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Descrição Curta */}
                    <p className="line-clamp-2 text-xs text-gray-400 mb-3 leading-relaxed">
                      {race.description || "Nenhuma descrição informada."}
                    </p>

                    {/* Badges de Conteúdo (Traços, Heranças, Idiomas) */}
                    <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                      {traits.length > 0 && (
                        <span className="rounded-md bg-purple-950/50 border border-purple-900/40 px-2 py-0.5 text-purple-300 font-medium">
                          🌟 {traits.length} {traits.length === 1 ? "traço" : "traços"}
                        </span>
                      )}
                      {heritages.length > 0 && (
                        <span className="rounded-md bg-indigo-950/50 border border-indigo-900/40 px-2 py-0.5 text-indigo-300 font-medium">
                          🌳 {heritages.length} {heritages.length === 1 ? "herança" : "heranças"}
                        </span>
                      )}
                      {languages.length > 0 && (
                        <span className="rounded-md bg-gray-800/80 px-2 py-0.5 text-gray-300 font-medium">
                          🗣️ {languages.slice(0, 2).join(", ")}
                          {languages.length > 2 ? ` +${languages.length - 2}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="mt-3 flex items-center justify-between border-t border-gray-800/80 pt-2.5 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(race)}
                      className="rounded-lg bg-purple-600/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-500 transition shadow-sm"
                    >
                      Ver Detalhes
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTranslateRace(race.id)}
                        disabled={translatingId === race.id}
                        title="Traduzir raça para Português via IA (9Router)"
                        className="rounded-lg border border-purple-800/70 bg-purple-950/70 px-2 py-1 text-xs font-medium text-purple-300 hover:bg-purple-900 transition disabled:opacity-50"
                      >
                        {translatingId === race.id ? <Spinner size="sm" /> : "🌐 IA"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateRace(race.id)}
                        disabled={duplicatingId === race.id}
                        title="Duplicar esta raça"
                        className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        {duplicatingId === race.id ? <Spinner size="sm" /> : "📋"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRace(race.id, race.name)}
                        title="Excluir raça"
                        className="rounded-lg border border-red-900/60 bg-red-950/60 px-2 py-1 text-xs text-red-300 hover:bg-red-900 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE CRIAÇÃO DE RAÇA                                                  */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-purple-700/60 bg-gray-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🧝♂️</span> Criar Nova Raça / Ancestralidade
                </h3>
                <p className="text-xs text-gray-400">Defina atributos, traços raciais e linhagens</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-800 gap-2">
              {[
                { id: "geral", label: "📝 Geral" },
                { id: "atributos", label: "📊 Atributos" },
                { id: "idiomas", label: "🗣️ Idiomas" },
                { id: "tracos", label: `🌟 Traços (${createTraits.length})` },
                { id: "herancas", label: `🌳 Heranças (${createHeritages.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCreateTab(tab.id as typeof activeCreateTab)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                    activeCreateTab === tab.id
                      ? "border-purple-500 text-purple-300 bg-purple-950/40"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateRace} className="space-y-4">
              {/* Aba 1: Geral */}
              {activeCreateTab === "geral" && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Nome da Raça *
                      </label>
                      <input
                        type="text"
                        required
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Ex: Anão da Montanha, Alto Elfo, Tiefling"
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Sistema de Origem
                      </label>
                      <select
                        value={createSourceSystem}
                        onChange={(e) => setCreateSourceSystem(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="custom">Personalizado (Custom)</option>
                        <option value="pf2e">Pathfinder 2e</option>
                        <option value="dnd5e">D&D 5e</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Tamanho
                      </label>
                      <select
                        value={createSize}
                        onChange={(e) => setCreateSize(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="Miúdo">Miúdo (Tiny)</option>
                        <option value="Pequeno">Pequeno (Small)</option>
                        <option value="Médio">Médio (Medium)</option>
                        <option value="Grande">Grande (Large)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Deslocamento / Speed (em pés)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={createSpeed}
                        onChange={(e) => setCreateSpeed(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Bônus de Pontos de Vida (HP)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={createHitPointsBonus}
                        onChange={(e) => setCreateHitPointsBonus(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      URL da Imagem / Retrato
                    </label>
                    <input
                      type="text"
                      value={createImageUrl}
                      onChange={(e) => setCreateImageUrl(e.target.value)}
                      placeholder="https://exemplo.com/imagem.png"
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Descrição & Lore
                    </label>
                    <textarea
                      rows={4}
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="História, cultura, fisiologia e aspectos marcantes da raça..."
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Aba 2: Atributos */}
              {activeCreateTab === "atributos" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    Defina os modificadores raciais de atributos (+2, +1, -1, 0).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ATTRIBUTES.map((attr) => (
                      <div key={attr} className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                        <label className="block text-xs font-bold text-purple-300 mb-1.5">
                          {ATTRIBUTE_LABELS[attr]}
                        </label>
                        <input
                          type="number"
                          min="-10"
                          max="10"
                          value={createAttributes[attr]}
                          onChange={(e) =>
                            setCreateAttributes((prev) => ({
                              ...prev,
                              [attr]: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aba 3: Idiomas */}
              {activeCreateTab === "idiomas" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={createLanguageInput}
                      onChange={(e) => setCreateLanguageInput(e.target.value)}
                      placeholder="Adicionar novo idioma (ex: Élfico)"
                      className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = createLanguageInput.trim();
                          if (val && !createLanguages.includes(val)) {
                            setCreateLanguages([...createLanguages, val]);
                            setCreateLanguageInput("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = createLanguageInput.trim();
                        if (val && !createLanguages.includes(val)) {
                          setCreateLanguages([...createLanguages, val]);
                          setCreateLanguageInput("");
                        }
                      }}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition"
                    >
                      + Adicionar
                    </button>
                  </div>

                  {/* Badges de Idiomas Selecionados */}
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 min-h-[60px]">
                    <div className="flex flex-wrap gap-1.5">
                      {createLanguages.length === 0 ? (
                        <span className="text-xs text-gray-500">Nenhum idioma adicionado ainda.</span>
                      ) : (
                        createLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-800 bg-purple-950/80 px-2.5 py-1 text-xs font-semibold text-purple-200"
                          >
                            <span>{lang}</span>
                            <button
                              type="button"
                              onClick={() => setCreateLanguages(createLanguages.filter((l) => l !== lang))}
                              className="text-purple-400 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sugestões Rápidas */}
                  <div>
                    <span className="block text-xs font-semibold text-gray-400 mb-1.5">
                      Sugestões Rápidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            if (!createLanguages.includes(lang)) {
                              setCreateLanguages([...createLanguages, lang]);
                            }
                          }}
                          className="rounded-md border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] text-gray-300 hover:border-purple-600 hover:text-purple-300 transition"
                        >
                          + {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Aba 4: Traços Raciais */}
              {activeCreateTab === "tracos" && (
                <div className="space-y-4">
                  {/* Form Adicionar Traço */}
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-2">
                    <span className="block text-xs font-bold text-purple-300">
                      Adicionar Traço / Habilidade Especial
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Nome do traço (ex: Visão no Escuro)"
                        value={createTraitName}
                        onChange={(e) => setCreateTraitName(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Descrição do efeito ou regra..."
                        value={createTraitDesc}
                        onChange={(e) => setCreateTraitDesc(e.target.value)}
                        className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (createTraitName.trim()) {
                            setCreateTraits([
                              ...createTraits,
                              { name: createTraitName.trim(), description: createTraitDesc.trim() },
                            ]);
                            setCreateTraitName("");
                            setCreateTraitDesc("");
                          }
                        }}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition"
                      >
                        + Adicionar Traço
                      </button>
                    </div>
                  </div>

                  {/* Lista de Traços */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {createTraits.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhum traço racial cadastrado.</p>
                    ) : (
                      createTraits.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                        >
                          <div>
                            <span className="text-xs font-bold text-white">🌟 {t.name}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{t.description || "Sem descrição."}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateTraits(createTraits.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-200 text-xs px-1.5 py-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Aba 5: Heranças */}
              {activeCreateTab === "herancas" && (
                <div className="space-y-4">
                  {/* Form Adicionar Herança */}
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-2">
                    <span className="block text-xs font-bold text-indigo-300">
                      Adicionar Linhagem / Sub-raça / Herança
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Nome da herança (ex: Anão da Rocha Viva)"
                        value={createHeritageName}
                        onChange={(e) => setCreateHeritageName(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Descrição da sub-linhagem..."
                        value={createHeritageDesc}
                        onChange={(e) => setCreateHeritageDesc(e.target.value)}
                        className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (createHeritageName.trim()) {
                            setCreateHeritages([
                              ...createHeritages,
                              { name: createHeritageName.trim(), description: createHeritageDesc.trim() },
                            ]);
                            setCreateHeritageName("");
                            setCreateHeritageDesc("");
                          }
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition"
                      >
                        + Adicionar Herança
                      </button>
                    </div>
                  </div>

                  {/* Lista de Heranças */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {createHeritages.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhuma herança ou sub-raça cadastrada.</p>
                    ) : (
                      createHeritages.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                        >
                          <div>
                            <span className="text-xs font-bold text-indigo-200">🌳 {h.name}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{h.description || "Sem descrição."}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateHeritages(createHeritages.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-200 text-xs px-1.5 py-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreating ? <Spinner size="sm" /> : "Criar Raça Completa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DETALHES E EDIÇÃO DE RAÇA                                        */}
      {/* ========================================================================= */}
      {detailRace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-purple-700/60 bg-gray-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🧝♂️</span> {editName || detailRace.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {getSystemBadge(editSourceSystem)}
                  <span className="text-xs text-gray-400">ID: {detailRace.id.slice(0, 8)}...</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTranslateRace(detailRace.id, true)}
                  disabled={isTranslatingModal}
                  className="rounded-xl border border-purple-700 bg-purple-950/80 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTranslatingModal ? <Spinner size="sm" /> : "🌐 Traduzir com IA"}
                </button>

                <button
                  type="button"
                  onClick={() => setDetailRace(null)}
                  className="text-gray-400 hover:text-white text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-800 gap-2">
              {[
                { id: "geral", label: "📝 Geral" },
                { id: "atributos", label: "📊 Atributos" },
                { id: "idiomas", label: `🗣️ Idiomas (${editLanguages.length})` },
                { id: "tracos", label: `🌟 Traços (${editTraits.length})` },
                { id: "herancas", label: `🌳 Heranças (${editHeritages.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                    activeDetailTab === tab.id
                      ? "border-purple-500 text-purple-300 bg-purple-950/40"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Aba 1: Geral */}
              {activeDetailTab === "geral" && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Nome da Raça *
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Sistema de Origem
                      </label>
                      <select
                        value={editSourceSystem}
                        onChange={(e) => setEditSourceSystem(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="custom">Personalizado (Custom)</option>
                        <option value="pf2e">Pathfinder 2e</option>
                        <option value="dnd5e">D&D 5e</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Tamanho
                      </label>
                      <select
                        value={editSize}
                        onChange={(e) => setEditSize(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="Miúdo">Miúdo (Tiny)</option>
                        <option value="Pequeno">Pequeno (Small)</option>
                        <option value="Médio">Médio (Medium)</option>
                        <option value="Grande">Grande (Large)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Deslocamento / Speed (em pés)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={editSpeed}
                        onChange={(e) => setEditSpeed(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Bônus de Pontos de Vida (HP)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={editHitPointsBonus}
                        onChange={(e) => setEditHitPointsBonus(e.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      URL da Imagem
                    </label>
                    <input
                      type="text"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://exemplo.com/imagem.png"
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Descrição & Lore
                    </label>
                    <textarea
                      rows={4}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Aba 2: Atributos */}
              {activeDetailTab === "atributos" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    Modificadores raciais de atributos da ficha.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ATTRIBUTES.map((attr) => (
                      <div key={attr} className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                        <label className="block text-xs font-bold text-purple-300 mb-1.5">
                          {ATTRIBUTE_LABELS[attr]}
                        </label>
                        <input
                          type="number"
                          min="-10"
                          max="10"
                          value={editAttributes[attr]}
                          onChange={(e) =>
                            setEditAttributes((prev) => ({
                              ...prev,
                              [attr]: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aba 3: Idiomas */}
              {activeDetailTab === "idiomas" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLanguageInput}
                      onChange={(e) => setEditLanguageInput(e.target.value)}
                      placeholder="Adicionar novo idioma..."
                      className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = editLanguageInput.trim();
                          if (val && !editLanguages.includes(val)) {
                            setEditLanguages([...editLanguages, val]);
                            setEditLanguageInput("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = editLanguageInput.trim();
                        if (val && !editLanguages.includes(val)) {
                          setEditLanguages([...editLanguages, val]);
                          setEditLanguageInput("");
                        }
                      }}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition"
                    >
                      + Adicionar
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 min-h-[60px]">
                    <div className="flex flex-wrap gap-1.5">
                      {editLanguages.length === 0 ? (
                        <span className="text-xs text-gray-500">Nenhum idioma registrado.</span>
                      ) : (
                        editLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-800 bg-purple-950/80 px-2.5 py-1 text-xs font-semibold text-purple-200"
                          >
                            <span>{lang}</span>
                            <button
                              type="button"
                              onClick={() => setEditLanguages(editLanguages.filter((l) => l !== lang))}
                              className="text-purple-400 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-gray-400 mb-1.5">
                      Sugestões Rápidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            if (!editLanguages.includes(lang)) {
                              setEditLanguages([...editLanguages, lang]);
                            }
                          }}
                          className="rounded-md border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] text-gray-300 hover:border-purple-600 hover:text-purple-300 transition"
                        >
                          + {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Aba 4: Traços Raciais */}
              {activeDetailTab === "tracos" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-2">
                    <span className="block text-xs font-bold text-purple-300">
                      Adicionar Traço / Habilidade Especial
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Nome do traço"
                        value={editTraitName}
                        onChange={(e) => setEditTraitName(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Descrição do efeito ou regra..."
                        value={editTraitDesc}
                        onChange={(e) => setEditTraitDesc(e.target.value)}
                        className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (editTraitName.trim()) {
                            setEditTraits([
                              ...editTraits,
                              { name: editTraitName.trim(), description: editTraitDesc.trim() },
                            ]);
                            setEditTraitName("");
                            setEditTraitDesc("");
                          }
                        }}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition"
                      >
                        + Adicionar Traço
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editTraits.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhum traço racial registrado.</p>
                    ) : (
                      editTraits.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                        >
                          <div>
                            <span className="text-xs font-bold text-white">🌟 {t.name}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{t.description || "Sem descrição."}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditTraits(editTraits.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-200 text-xs px-1.5 py-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Aba 5: Heranças */}
              {activeDetailTab === "herancas" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-2">
                    <span className="block text-xs font-bold text-indigo-300">
                      Adicionar Linhagem / Sub-raça / Herança
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Nome da herança"
                        value={editHeritageName}
                        onChange={(e) => setEditHeritageName(e.target.value)}
                        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Descrição da linhagem..."
                        value={editHeritageDesc}
                        onChange={(e) => setEditHeritageDesc(e.target.value)}
                        className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (editHeritageName.trim()) {
                            setEditHeritages([
                              ...editHeritages,
                              { name: editHeritageName.trim(), description: editHeritageDesc.trim() },
                            ]);
                            setEditHeritageName("");
                            setEditHeritageDesc("");
                          }
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition"
                      >
                        + Adicionar Herança
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editHeritages.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhuma herança registrada.</p>
                    ) : (
                      editHeritages.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-2.5"
                        >
                          <div>
                            <span className="text-xs font-bold text-indigo-200">🌳 {h.name}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{h.description || "Sem descrição."}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditHeritages(editHeritages.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-200 text-xs px-1.5 py-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                <button
                  type="button"
                  onClick={() => handleDeleteRace(detailRace.id, detailRace.name)}
                  className="rounded-xl border border-red-900/60 bg-red-950/60 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-900 transition"
                >
                  Excluir Raça
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailRace(null)}
                    className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingEdit ? <Spinner size="sm" /> : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CATÁLOGO D&D 5E                                                  */}
      {/* ========================================================================= */}
      {showDndCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-amber-700/60 bg-gray-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🐉</span> Catálogo de Raças — D&D 5e
                </h3>
                <p className="text-xs text-gray-400">
                  Importe as 9 raças clássicas do SRD com traços e sub-raças
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDndCatalogModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Busca e Seleção Rápida */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Buscar raça no catálogo..."
                value={searchDndCatalog}
                onChange={(e) => setSearchDndCatalog(e.target.value)}
                className="w-64 rounded-xl border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
              />

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const allIndexes = dndCatalogList.map((r) => r.index);
                    setSelectedDndIndexes(new Set(allIndexes));
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Selecionar Todas
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDndIndexes(new Set())}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Toggle Tradução */}
            <label className="flex items-center gap-2.5 rounded-xl border border-gray-800 bg-gray-950 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={translateDndWithLLM}
                onChange={(e) => setTranslateDndWithLLM(e.target.checked)}
                className="rounded border-gray-700 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs text-gray-300">
                🌐 <strong>Traduzir com IA via 9Router</strong> (nomes, descrições, traços e sub-raças para Português)
              </span>
            </label>

            {/* Lista de Raças */}
            {isLoadingDndCatalog ? (
              <div className="flex justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {dndCatalogList
                  .filter((r) => r.name.toLowerCase().includes(searchDndCatalog.toLowerCase()))
                  .map((r) => {
                    const isSelected = selectedDndIndexes.has(r.index);
                    return (
                      <label
                        key={r.index}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                          isSelected
                            ? "border-amber-500/70 bg-amber-950/40 text-amber-200"
                            : "border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedDndIndexes);
                            if (isSelected) next.delete(r.index);
                            else next.add(r.index);
                            setSelectedDndIndexes(next);
                          }}
                          className="rounded border-gray-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold">{r.name}</span>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400">
                {selectedDndIndexes.size} selecionada(s)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDndCatalogModal(false)}
                  className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleImportDndRaces(false)}
                  disabled={isImportingDnd || selectedDndIndexes.size === 0}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImportingDnd ? <Spinner size="sm" /> : `Importar (${selectedDndIndexes.size})`}
                </button>
                <button
                  type="button"
                  onClick={() => handleImportDndRaces(true)}
                  disabled={isImportingDnd}
                  className="rounded-xl border border-amber-600 bg-amber-950/80 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900 transition disabled:opacity-50"
                >
                  Importar Todas as 9
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CATÁLOGO PATHFINDER 2E                                           */}
      {/* ========================================================================= */}
      {showPf2eCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-cyan-700/60 bg-gray-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⚔️</span> Catálogo de Ancestralidades — Pathfinder 2e
                </h3>
                <p className="text-xs text-gray-400">
                  14 ancestralidades completas com PV base, traços especiais e heranças
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPf2eCatalogModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Busca e Seleção Rápida */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Buscar ancestralidade..."
                value={searchPf2eCatalog}
                onChange={(e) => setSearchPf2eCatalog(e.target.value)}
                className="w-64 rounded-xl border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const allKeys = pf2eCatalogList.map((r) => r.key);
                    setSelectedPf2eKeys(new Set(allKeys));
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Selecionar Todas
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPf2eKeys(new Set())}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Toggle Tradução / Refinamento */}
            <label className="flex items-center gap-2.5 rounded-xl border border-gray-800 bg-gray-950 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={translatePf2eWithLLM}
                onChange={(e) => setTranslatePf2eWithLLM(e.target.checked)}
                className="rounded border-gray-700 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-xs text-gray-300">
                🌐 <strong>Re-traduzir / Enriquecer via IA (9Router)</strong> (dados já vêm pré-traduzidos em PT-BR)
              </span>
            </label>

            {/* Lista de Ancestralidades */}
            {isLoadingPf2eCatalog ? (
              <div className="flex justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {pf2eCatalogList
                  .filter((r) => r.name.toLowerCase().includes(searchPf2eCatalog.toLowerCase()))
                  .map((r) => {
                    const isSelected = selectedPf2eKeys.has(r.key);
                    return (
                      <label
                        key={r.key}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                          isSelected
                            ? "border-cyan-500/70 bg-cyan-950/40 text-cyan-200"
                            : "border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedPf2eKeys);
                            if (isSelected) next.delete(r.key);
                            else next.add(r.key);
                            setSelectedPf2eKeys(next);
                          }}
                          className="mt-0.5 rounded border-gray-700 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white">{r.name}</span>
                            <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-900">
                              ❤️ {r.hitPointsBonus} PV
                            </span>
                          </div>
                          <p className="line-clamp-1 text-[11px] text-gray-400 mt-0.5">
                            {r.description}
                          </p>
                          <div className="flex gap-2 mt-1 text-[10px] text-gray-400">
                            <span>⚡ {r.speed} pés</span>
                            <span>🌟 {r.traitsCount} traços</span>
                            <span>🌳 {r.heritagesCount} heranças</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400">
                {selectedPf2eKeys.size} selecionada(s)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPf2eCatalogModal(false)}
                  className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleImportPf2eRaces(false)}
                  disabled={isImportingPf2e || selectedPf2eKeys.size === 0}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImportingPf2e ? <Spinner size="sm" /> : `Importar (${selectedPf2eKeys.size})`}
                </button>
                <button
                  type="button"
                  onClick={() => handleImportPf2eRaces(true)}
                  disabled={isImportingPf2e}
                  className="rounded-xl border border-cyan-600 bg-cyan-950/80 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-900 transition disabled:opacity-50"
                >
                  Importar Todas as 14
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
