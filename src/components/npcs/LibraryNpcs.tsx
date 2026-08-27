"use client";

import { useEffect, useRef, useState } from "react";
import type { Npc } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getModifier } from "@/lib/engine/attributes";
import { Button, Form, Input, Spinner } from "@/components/ui";

type CampaignOption = { id: string; name: string };
type ClassOption = { id: string; name: string };

type NpcFormState = {
  name: string;
  npcType: string;
  level: string;
  xp: string;
  hitPoints: string;
  hitPointsMax: string;
  manaPoints: string;
  manaPointsMax: string;
  block: string;
  xpReward: string;
  classId: string;
  attributes: Record<Attribute, string>;
};

const DEFAULT_ATTRIBUTES: Record<Attribute, string> = {
  forca: "10",
  destreza: "10",
  vigor: "10",
  inteligencia: "10",
  empatia: "10",
};

const EMPTY_FORM: NpcFormState = {
  name: "",
  npcType: "common",
  level: "1",
  xp: "0",
  hitPoints: "10",
  hitPointsMax: "10",
  manaPoints: "0",
  manaPointsMax: "0",
  block: "0",
  xpReward: "0",
  classId: "",
  attributes: { ...DEFAULT_ATTRIBUTES },
};

type NpcDetail = Npc & { includedCampaigns?: CampaignOption[] };

function toForm(npc: Npc): NpcFormState {
  return {
    name: npc.name,
    npcType: npc.npcType,
    level: String(npc.level),
    xp: String(npc.xp),
    hitPoints: String(npc.hitPoints),
    hitPointsMax: String(npc.hitPointsMax),
    manaPoints: String(npc.manaPoints),
    manaPointsMax: String(npc.manaPointsMax),
    block: String(npc.block),
    xpReward: String(npc.xpReward),
    classId: npc.classId ?? "",
    attributes: {
      forca: String(npc.attributes.forca),
      destreza: String(npc.attributes.destreza),
      vigor: String(npc.attributes.vigor),
      inteligencia: String(npc.attributes.inteligencia),
      empatia: String(npc.attributes.empatia),
    },
  };
}

function toPayload(form: NpcFormState) {
  return {
    name: form.name,
    npcType: form.npcType,
    level: Number(form.level) || 1,
    xp: Number(form.xp) || 0,
    hitPoints: Number(form.hitPoints) || 0,
    hitPointsMax: Number(form.hitPointsMax) || 0,
    manaPoints: Number(form.manaPoints) || 0,
    manaPointsMax: Number(form.manaPointsMax) || 0,
    block: Number(form.block) || 0,
    xpReward: Number(form.xpReward) || 0,
    classId: form.classId || null,
    attributes: Object.fromEntries(
      ATTRIBUTES.map((attr) => [attr, Number(form.attributes[attr]) || 0])
    ),
  };
}

type LibraryNpcsProps = {
  onRegisterActions?: (actions: {
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  }) => void;
};

export function LibraryNpcs({ onRegisterActions }: LibraryNpcsProps = {}) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NpcFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const createFileRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NpcFormState>(EMPTY_FORM);
  const [editDetail, setEditDetail] = useState<NpcDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [includeCampaignId, setIncludeCampaignId] = useState("");
  const [isIncluding, setIsIncluding] = useState(false);
  const [isImportingDnd, setIsImportingDnd] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchNpc, setSearchNpc] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchNpc]);

  const filteredNpcs = npcs.filter((n) =>
    n.name.toLowerCase().includes(searchNpc.toLowerCase())
  );
  const totalPages = Math.ceil(filteredNpcs.length / pageSize) || 1;
  const paginatedNpcs = filteredNpcs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Catálogo Completo do D&D 5e (334 Monstros)
  const [showDndCatalogModal, setShowDndCatalogModal] = useState(false);
  const [dndCatalogList, setDndCatalogList] = useState<Array<{ index: string; name: string }>>([]);
  const [selectedDndIndexes, setSelectedDndIndexes] = useState<Set<string>>(new Set());
  const [searchDndCatalog, setSearchDndCatalog] = useState("");
  const [translateDndWithLLM, setTranslateDndWithLLM] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const handleOpenDndCatalogModal = async () => {
    setShowDndCatalogModal(true);
    setError(null);
    setIsLoadingCatalog(true);
    try {
      const res = await fetch("/api/npcs/dnd-catalog", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.results) {
        setDndCatalogList(data.results);
      }
    } catch {
      setError("Erro ao carregar catálogo D&D 5e.");
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Catálogo Completo do Pathfinder 2e
  const [showPf2eCatalogModal, setShowPf2eCatalogModal] = useState(false);
  const [pf2eCatalogList, setPf2eCatalogList] = useState<Array<{ index: string; name: string; pack: string; path: string }>>([]);
  const [selectedPf2ePaths, setSelectedPf2ePaths] = useState<Set<string>>(new Set());
  const [searchPf2eCatalog, setSearchPf2eCatalog] = useState("");
  const [isLoadingPf2eCatalog, setIsLoadingPf2eCatalog] = useState(false);
  const [isImportingPf2e, setIsImportingPf2e] = useState(false);
  const [translateWithLLM, setTranslateWithLLM] = useState(true);

  const handleOpenPf2eCatalogModal = async () => {
    setShowPf2eCatalogModal(true);
    setError(null);
    setIsLoadingPf2eCatalog(true);
    try {
      const res = await fetch("/api/npcs/pf2e-catalog", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.results) {
        setPf2eCatalogList(data.results);
      }
    } catch {
      setError("Erro ao carregar catálogo Pathfinder 2e.");
    } finally {
      setIsLoadingPf2eCatalog(false);
    }
  };

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        openCreate: () => setShowCreateModal(true),
        openCatalog: () => handleOpenDndCatalogModal(),
        openPf2eCatalog: () => handleOpenPf2eCatalogModal(),
      });
    }
  }, [onRegisterActions]);

  const handleToggleSelectDndMonster = (index: string) => {
    setSelectedDndIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleToggleSelectPf2eMonster = (path: string) => {
    setSelectedPf2ePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleImportSelectedPf2eMonsters = async () => {
    if (selectedPf2ePaths.size === 0) return;
    setError(null);
    setIsImportingPf2e(true);
    try {
      const response = await fetch("/api/npcs/import-pf2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monsterPaths: Array.from(selectedPf2ePaths),
          translateWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar monstros selecionados do Pathfinder 2e");
        return;
      }
      await loadNpcs();
      setShowPf2eCatalogModal(false);
      setSelectedPf2ePaths(new Set());
      alert(data.message || "Monstros selecionados importados com sucesso!");
    } catch {
      setError("Erro de conexão ao importar da API Pathfinder 2e.");
    } finally {
      setIsImportingPf2e(false);
    }
  };

  const handleImportAllPf2eMonsters = async () => {
    if (!window.confirm(`Deseja importar TODOS os ${pf2eCatalogList.length} monstros da API Pathfinder 2e para sua biblioteca? Este processo levará alguns segundos.`)) {
      return;
    }
    setError(null);
    setIsImportingPf2e(true);
    try {
      const response = await fetch("/api/npcs/import-pf2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importAll: true,
          translateWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar todos os monstros do Pathfinder 2e");
        return;
      }
      await loadNpcs();
      setShowPf2eCatalogModal(false);
      alert(data.message || "Todos os monstros do Pathfinder 2e foram importados para sua biblioteca!");
    } catch {
      setError("Erro de conexão ao importar da API Pathfinder 2e.");
    } finally {
      setIsImportingPf2e(false);
    }
  };

  const handleImportSelectedDndMonsters = async () => {
    if (selectedDndIndexes.size === 0) return;
    setError(null);
    setIsImportingDnd(true);
    try {
      const response = await fetch("/api/npcs/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monsterIndexes: Array.from(selectedDndIndexes),
          translateWithLLM: translateDndWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar monstros selecionados do D&D 5e");
        return;
      }
      await loadNpcs();
      setShowDndCatalogModal(false);
      setSelectedDndIndexes(new Set());
      alert(data.message || "Monstros selecionados importados com sucesso!");
    } catch {
      setError("Erro de conexão ao importar da API D&D 5e.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  const handleImportAllDndMonsters = async () => {
    if (!window.confirm("Deseja importar TODOS os 334 monstros da API D&D 5e para sua biblioteca? Este processo levará alguns segundos.")) {
      return;
    }
    setError(null);
    setIsImportingDnd(true);
    try {
      const response = await fetch("/api/npcs/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importAll: true,
          translateWithLLM: translateDndWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erro ao importar todos os monstros do D&D 5e");
        return;
      }
      await loadNpcs();
      setShowDndCatalogModal(false);
      alert(data.message || "Todos os 334 monstros do D&D 5e foram importados para sua biblioteca!");
    } catch {
      setError("Erro de conexão ao importar da API D&D 5e.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  const loadNpcs = async () => {
    try {
      const response = await fetch("/api/npcs", { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar NPCs");
        return;
      }

      setNpcs(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/npcs", { credentials: "include" });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar NPCs");
          return;
        }

        setNpcs(data.data);
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

    const loadOptionsData = async () => {
      try {
        const [campaignsResponse, classesResponse] = await Promise.all([
          fetch("/api/campaigns", { credentials: "include" }),
          fetch("/api/classes", { credentials: "include" }),
        ]);
        const campaignsData = await campaignsResponse.json();
        const classesData = await classesResponse.json();

        if (cancelled) return;

        if (campaignsResponse.ok) {
          setCampaigns(
            campaignsData.data.map((campaign: CampaignOption) => ({
              id: campaign.id,
              name: campaign.name,
            }))
          );
        }
        if (classesResponse.ok) {
          setClasses(classesData.data);
        }
      } catch {
        if (!cancelled) {
          setError("Erro ao carregar opções.");
        }
      }
    };

    void load();
    void loadOptionsData();

    return () => {
      cancelled = true;
    };
  }, []);

  const uploadImage = async (npcId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`/api/npcs/${npcId}/image`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao enviar imagem");
    }

    return data.data as Npc;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/npcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar NPC");
        return;
      }

      let created = data.data as Npc;

      if (createImage) {
        try {
          created = await uploadImage(created.id, createImage);
        } catch (uploadError) {
          setError(
            uploadError instanceof Error ? uploadError.message : "Erro ao enviar imagem"
          );
        }
      }

      setNpcs((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setCreateImage(null);
      setShowCreateModal(false);
      if (createFileRef.current) {
        createFileRef.current.value = "";
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = async (npcId: string) => {
    const npc = npcs.find((item) => item.id === npcId);
    if (!npc) return;

    setEditingId(npc.id);
    setEditForm(toForm(npc));
    setEditDetail(null);

    try {
      const response = await fetch(`/api/npcs/${npc.id}`, { credentials: "include" });
      const data = await response.json();

      if (response.ok) {
        setEditDetail(data.data);
      }
    } catch {
      // ignora falha na carga de detalhes; edição continua funcionando
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/npcs/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editForm)),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar NPC");
        return;
      }

      setEditingId(null);
      await loadNpcs();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditImage = async (file: File) => {
    if (!editingId) return;

    setError(null);
    try {
      await uploadImage(editingId, file);
      await loadNpcs();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Erro ao enviar imagem");
    }
  };

  const handleDuplicate = async (npcId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/npcs/${npcId}/duplicate`, { 
        method: "POST",
        credentials: "include"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao duplicar NPC");
        return;
      }

      await loadNpcs();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleDelete = async (npcId: string) => {
    if (!window.confirm("Excluir este NPC da biblioteca?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/npcs/${npcId}`, { 
        method: "DELETE",
        credentials: "include"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir NPC");
        return;
      }

      if (editingId === npcId) {
        setEditingId(null);
      }
      await loadNpcs();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleInclude = async (npcId: string) => {
    if (!includeCampaignId) {
      setError("Selecione uma campanha");
      return;
    }

    setError(null);
    setIsIncluding(true);
    try {
      const response = await fetch(`/api/campaigns/${includeCampaignId}/npcs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao incluir NPC na campanha");
        return;
      }

      setIncludeCampaignId("");
      await startEditing(npcId);
      await loadNpcs();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsIncluding(false);
    }
  };

  const handleRemoveFromCampaign = async (npcId: string, campaignId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/npcs/${npcId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao remover NPC da campanha");
        return;
      }

      await startEditing(npcId);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const renderFormFields = (
    state: NpcFormState,
    onChange: (next: NpcFormState) => void,
    disabled: boolean,
    prefix: string
  ) => (
    <>
      <Input
        label="Nome"
        name={`${prefix}-name`}
        type="text"
        value={state.name}
        onChange={(e) => onChange({ ...state, name: e.target.value })}
        required
        disabled={disabled}
        className="bg-gray-950 text-white"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Tipo</label>
        <select
          value={state.npcType}
          onChange={(e) => onChange({ ...state, npcType: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
        >
          <option value="common">Comum</option>
          <option value="enemy">Inimigo</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Classe (opcional)</label>
        <select
          value={state.classId}
          onChange={(e) => onChange({ ...state, classId: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
        >
          <option value="">Sem classe</option>
          {classes.map((rpgClass) => (
            <option key={rpgClass.id} value={rpgClass.id}>
              {rpgClass.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nível"
          name={`${prefix}-level`}
          type="number"
          min={1}
          value={state.level}
          onChange={(e) => onChange({ ...state, level: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="XP (0-99)"
          name={`${prefix}-xp`}
          type="number"
          min={0}
          max={99}
          value={state.xp}
          onChange={(e) => onChange({ ...state, xp: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="HP"
          name={`${prefix}-hp`}
          type="number"
          min={0}
          value={state.hitPoints}
          onChange={(e) => onChange({ ...state, hitPoints: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="HP Máximo"
          name={`${prefix}-hpMax`}
          type="number"
          min={0}
          value={state.hitPointsMax}
          onChange={(e) => onChange({ ...state, hitPointsMax: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="Mana"
          name={`${prefix}-mana`}
          type="number"
          min={0}
          value={state.manaPoints}
          onChange={(e) => onChange({ ...state, manaPoints: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="Mana Máxima"
          name={`${prefix}-manaMax`}
          type="number"
          min={0}
          value={state.manaPointsMax}
          onChange={(e) => onChange({ ...state, manaPointsMax: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="Bloqueio"
          name={`${prefix}-block`}
          type="number"
          min={0}
          value={state.block}
          onChange={(e) => onChange({ ...state, block: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
        <Input
          label="XP de Recompensa"
          name={`${prefix}-xpReward`}
          type="number"
          min={0}
          value={state.xpReward}
          onChange={(e) => onChange({ ...state, xpReward: e.target.value })}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-gray-300">Atributos</p>
        <div className="grid grid-cols-2 gap-3">
          {ATTRIBUTES.map((attr) => (
            <div key={`${prefix}-${attr}`} className="flex items-center gap-2">
              <Input
                label={attr.charAt(0).toUpperCase() + attr.slice(1)}
                name={`${prefix}-attr-${attr}`}
                type="number"
                min={1}
                max={30}
                value={state.attributes[attr]}
                onChange={(e) =>
                  onChange({
                    ...state,
                    attributes: { ...state.attributes, [attr]: e.target.value },
                  })
                }
                disabled={disabled}
                className="bg-gray-950 text-white"
              />
              <span className="mt-4 text-xs text-gray-400">
                {getModifier(Number(state.attributes[attr]) || 0) >= 0 ? "+" : ""}
                {getModifier(Number(state.attributes[attr]) || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Área Principal de NPCs (Full Width) */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl flex flex-col max-h-[calc(100vh-16rem)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <span>NPCs Cadastrados</span>
          </h3>
          <div className="text-xs text-gray-400 font-semibold whitespace-nowrap">
            Total: <span className="text-xs text-purple-400 font-bold bg-purple-950/60 border border-purple-900/60 px-2.5 py-1 rounded-lg">{filteredNpcs.length}</span>
          </div>
        </div>

        <input
          type="text"
          placeholder="Pesquisar NPC na biblioteca por nome..."
          value={searchNpc}
          onChange={(e) => setSearchNpc(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition mb-4 shrink-0"
        />

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px] flex-1">
            <Spinner size="lg" />
          </div>
        ) : filteredNpcs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 space-y-2 flex-1">
            <p>Nenhum NPC na biblioteca ainda.</p>
            <p className="text-xs text-gray-500">
              Clique em <strong>+ Criar Novo NPC</strong> ou use <strong>Catálogo D&D 5e</strong> para alimentar a biblioteca.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {paginatedNpcs.map((npc) => (
                  <div key={npc.id} className="rounded-xl border border-gray-800 bg-gray-950 p-3.5 hover:border-purple-600/60 hover:shadow-lg transition-all cursor-pointer">
                    <div className="flex items-start gap-3">
                      {npc.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={npc.imageUrl}
                          alt={npc.name}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xl font-bold text-gray-400">
                          {npc.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() =>
                              editingId === npc.id ? setEditingId(null) : startEditing(npc.id)
                            }
                            className="font-semibold text-white hover:text-purple-300"
                          >
                            {npc.name}
                          </button>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              npc.npcType === "enemy"
                                ? "bg-red-900/50 text-red-300"
                                : "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {npc.npcType === "enemy" ? "Inimigo" : "Comum"}
                          </span>
                          <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-xs text-purple-300">
                            Nível {npc.level}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
                          <span>
                            HP {npc.hitPoints}/{npc.hitPointsMax}
                          </span>
                          <span>
                            Mana {npc.manaPoints}/{npc.manaPointsMax}
                          </span>
                          <span>XP {npc.xp}/100</span>
                          <span>Recompensa +{npc.xpReward}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {ATTRIBUTES.map(
                            (attr) =>
                              ` ${attr.charAt(0).toUpperCase()}: ${npc.attributes[attr]} (${getModifier(npc.attributes[attr]) >= 0 ? "+" : ""}${getModifier(npc.attributes[attr])})`
                          ).join(" · ")}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          onClick={() => handleDuplicate(npc.id)}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => handleDelete(npc.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    {editingId === npc.id && (
                      <div className="space-y-3 border-t border-gray-800 p-3">
                        <p className="text-sm font-semibold text-gray-300">Editar ficha</p>
                        {renderFormFields(editForm, setEditForm, isSaving, "edit")}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-300">
                            Trocar imagem
                          </label>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleEditImage(file);
                              }
                            }}
                            disabled={isSaving}
                            className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="master"
                            isLoading={isSaving}
                            onClick={handleSaveEdit}
                          >
                            Salvar
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                            Fechar
                          </Button>
                        </div>

                        <div className="rounded border border-gray-800 p-3">
                          <p className="mb-2 text-sm font-semibold text-gray-300">Campanhas</p>
                          {editDetail?.includedCampaigns?.length ? (
                            <div className="mb-2 space-y-1">
                              {editDetail.includedCampaigns.map((campaign) => (
                                <div
                                  key={campaign.id}
                                  className="flex items-center justify-between rounded bg-gray-900 px-2 py-1 text-sm"
                                >
                                  <span className="text-gray-300">{campaign.name}</span>
                                  <button
                                    onClick={() => handleRemoveFromCampaign(npc.id, campaign.id)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remover
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mb-2 text-xs text-gray-500">
                              Não incluído em nenhuma campanha.
                            </p>
                          )}
                          <div className="flex items-end gap-2">
                            <select
                              value={includeCampaignId}
                              onChange={(e) => setIncludeCampaignId(e.target.value)}
                              disabled={isIncluding}
                              className="flex-1 rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition"
                            >
                              <option value="">Selecione a campanha</option>
                              {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleInclude(npc.id)}
                              disabled={isIncluding}
                              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition disabled:opacity-50"
                            >
                              {isIncluding ? "..." : "Incluir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 mt-3 shrink-0">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-400 font-semibold">
                Página {currentPage} / {totalPages} ({filteredNpcs.length} NPCs)
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
          </>
        )}
      </div>

        {/* Modal do Catálogo Completo Pathfinder 2e */}
        {showPf2eCatalogModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setShowPf2eCatalogModal(false)}
          >
            <div
              className="w-full max-w-2xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚔️</span>
                  <div>
                    <h3 className="text-lg font-bold text-purple-200">Catálogo Pathfinder 2e ({pf2eCatalogList.length} Monstros)</h3>
                    <p className="text-xs text-purple-400">
                      Importe criaturas do Bestiário Pathfinder 2e com atributos, vida, habilidades e magias
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPf2eCatalogModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Pesquisar criaturas Pathfinder 2e (ex: Goblin, Mephit, Golem, Dragon)..."
                  value={searchPf2eCatalog}
                  onChange={(e) => setSearchPf2eCatalog(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
                />

                <label className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={translateWithLLM}
                    onChange={(e) => setTranslateWithLLM(e.target.checked)}
                    className="rounded border-gray-800 bg-gray-900 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Traduzir com IA</span>
                </label>

                <button
                  type="button"
                  onClick={handleImportAllPf2eMonsters}
                  disabled={isImportingPf2e}
                  className="w-full sm:w-auto rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition whitespace-nowrap shadow-lg shadow-purple-950 disabled:opacity-50"
                >
                  {isImportingPf2e ? "Importando..." : `🔥 Importar Todos (${pf2eCatalogList.length})`}
                </button>
              </div>

              {isLoadingPf2eCatalog ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 min-h-[250px]">
                  {pf2eCatalogList
                    .filter((m) => m.name.toLowerCase().includes(searchPf2eCatalog.toLowerCase()))
                    .map((m) => {
                      const isSelected = selectedPf2ePaths.has(m.path);

                      return (
                        <div
                          key={m.path}
                          onClick={() => handleToggleSelectPf2eMonster(m.path)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/60 text-white"
                              : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700"
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="text-xs font-bold truncate">{m.name}</span>
                            <span className="text-[10px] text-gray-400 truncate">{m.pack}</span>
                          </div>
                          <div
                            className={`h-5 w-5 rounded-md border flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected
                                ? "bg-purple-600 border-purple-400 text-white"
                                : "border-gray-700 bg-gray-800 text-transparent"
                            }`}
                          >
                            ✓
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs">
                <span className="text-gray-400">
                  {selectedPf2ePaths.size} monstro(s) selecionado(s)
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPf2eCatalogModal(false)}
                    className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSelectedPf2eMonsters}
                    disabled={selectedPf2ePaths.size === 0 || isImportingPf2e}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    {isImportingPf2e ? "Importando..." : `Importar Selecionados (${selectedPf2ePaths.size})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal do Catálogo Completo D&D 5e (334 Monstros) */}
        {showDndCatalogModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setShowDndCatalogModal(false)}
          >
            <div
              className="w-full max-w-2xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🐉</span>
                  <div>
                    <h3 className="text-lg font-bold text-purple-200">Catálogo D&D 5e (334 Monstros)</h3>
                    <p className="text-xs text-purple-400">
                      Selecione monstros para importar ou alimente todos de uma vez
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDndCatalogModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Pesquisar entre os 334 monstros (ex: Dragon, Goblin, Lich, Beholder)..."
                  value={searchDndCatalog}
                  onChange={(e) => setSearchDndCatalog(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
                />

                <label className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={translateDndWithLLM}
                    onChange={(e) => setTranslateDndWithLLM(e.target.checked)}
                    className="rounded border-gray-800 bg-gray-900 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Traduzir com IA</span>
                </label>

                <button
                  type="button"
                  onClick={handleImportAllDndMonsters}
                  disabled={isImportingDnd}
                  className="w-full sm:w-auto rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition whitespace-nowrap shadow-lg shadow-purple-950 disabled:opacity-50"
                >
                  {isImportingDnd ? "Importando..." : "🔥 Importar Todos (334)"}
                </button>
              </div>

              {isLoadingCatalog ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 min-h-[250px]">
                  {dndCatalogList
                    .filter((m) => m.name.toLowerCase().includes(searchDndCatalog.toLowerCase()))
                    .map((m) => {
                      const isSelected = selectedDndIndexes.has(m.index);

                      return (
                        <div
                          key={m.index}
                          onClick={() => handleToggleSelectDndMonster(m.index)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/60 text-white"
                              : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700"
                          }`}
                        >
                          <div className="text-xs font-bold truncate pr-2">{m.name}</div>
                          <div
                            className={`h-5 w-5 rounded-md border flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? "bg-purple-600 border-purple-400 text-white"
                                : "border-gray-700 bg-gray-800 text-transparent"
                            }`}
                          >
                            ✓
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs">
                <span className="text-gray-400">
                  {selectedDndIndexes.size} monstro(s) selecionado(s)
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDndCatalogModal(false)}
                    className="rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSelectedDndMonsters}
                    disabled={selectedDndIndexes.size === 0 || isImportingDnd}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    {isImportingDnd ? "Importando..." : `Importar Selecionados (${selectedDndIndexes.size})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal / Overlay de Criação de Novo NPC */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="w-full max-w-lg rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                <h3 className="text-base font-bold text-purple-200">Criar Novo NPC / Monstro</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <Form onSubmit={handleCreate} error={undefined}>
                {renderFormFields(form, setForm, isCreating, "create")}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    Imagem (opcional)
                  </label>
                  <input
                    ref={createFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
                    disabled={isCreating}
                    className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-1/2 rounded-xl border border-purple-600 bg-purple-950/80 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition shadow-lg"
                  >
                    Cancelar
                  </button>
                  <Button type="submit" variant="master" isLoading={isCreating} className="w-1/2">
                    Criar NPC
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        )}
      </div>
  );
}
