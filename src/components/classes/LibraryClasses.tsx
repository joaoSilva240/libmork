"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RpgClass, InitialItem, Proficiencies, ClassLevelBenefit } from "@/types";
import { ATTRIBUTES } from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { Button, Form, Input, Spinner } from "@/components/ui";

type Benefit = {
  id: string;
  classId: string;
  level: number;
  benefits: ClassLevelBenefit;
};

type DraftItem = { name: string; quantity: string; description: string };

const EMPTY_PROFICIENCIES: Proficiencies = {
  weapons: [],
  armor: [],
  languages: [],
  tools: [],
};

const PROFICIENCY_CATEGORIES: { key: keyof Proficiencies; label: string; placeholder: string }[] = [
  { key: "weapons", label: "Armas", placeholder: "Ex: Espadas, Arcos, Armas Marciais" },
  { key: "armor", label: "Armaduras", placeholder: "Ex: Leve, Média, Pesada, Escudos" },
  { key: "languages", label: "Idiomas", placeholder: "Ex: Comum, Élfico, Dracônico" },
  { key: "tools", label: "Ferramentas", placeholder: "Ex: Kit de Ladrão, Kit de Alquimia, Alaúde" },
];

type LibraryClassesProps = {
  onRegisterActions?: (actions: {
    openCreate: () => void;
    openCatalog: () => void;
    openPf2eCatalog?: () => void;
  }) => void;
};

export function LibraryClasses({ onRegisterActions }: LibraryClassesProps = {}) {
  const [classes, setClasses] = useState<RpgClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchClass, setSearchClass] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDndCatalogModal, setShowDndCatalogModal] = useState(false);
  const [showPf2eCatalogModal, setShowPf2eCatalogModal] = useState(false);
  const [detailClassId, setDetailClassId] = useState<string | null>(null);

  // Form de Criação Manual (Rico)
  const [activeCreateTab, setActiveCreateTab] = useState<"geral" | "itens" | "proficiencias" | "niveis">("geral");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDraftItems, setCreateDraftItems] = useState<DraftItem[]>([]);
  const [createProficiencies, setCreateProficiencies] = useState<Proficiencies>(EMPTY_PROFICIENCIES);
  const [createHpDie, setCreateHpDie] = useState<number>(8);
  const [createManaProgression, setCreateManaProgression] = useState<number>(0);
  const [createKeyAttribute, setCreateKeyAttribute] = useState<Attribute>("forca");
  const [createLevelBenefits, setCreateLevelBenefits] = useState<Array<{ level: number; benefits: ClassLevelBenefit }>>([]);
  const [createEditingLevel, setCreateEditingLevel] = useState<number | null>(null);
  const [createBenefitLevel, setCreateBenefitLevel] = useState("1");
  const [createBenefitAttribute, setCreateBenefitAttribute] = useState<Attribute>("forca");
  const [createBenefitAttributeValue, setCreateBenefitAttributeValue] = useState("0");
  const [createBenefitHpBonus, setCreateBenefitHpBonus] = useState("8");
  const [createBenefitManaBonus, setCreateBenefitManaBonus] = useState("0");
  const [createBenefitExtraSkills, setCreateBenefitExtraSkills] = useState("0");
  const [createBenefitAdvantages, setCreateBenefitAdvantages] = useState("");
  const [createBenefitDescription, setCreateBenefitDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Modal de Detalhes / Edição de Classe
  const [activeDetailTab, setActiveDetailTab] = useState<"geral" | "itens" | "proficiencias" | "niveis">("geral");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editItems, setEditItems] = useState<DraftItem[]>([]);
  const [editProficiencies, setEditProficiencies] = useState<Proficiencies>(EMPTY_PROFICIENCIES);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Benefícios por nível da classe aberta no modal
  const [classBenefits, setClassBenefits] = useState<Benefit[]>([]);
  const [isLoadingBenefits, setIsLoadingBenefits] = useState(false);
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);

  // Form de Benefício de Nível
  const [benefitLevel, setBenefitLevel] = useState("1");
  const [benefitAttribute, setBenefitAttribute] = useState<Attribute>("forca");
  const [benefitAttributeValue, setBenefitAttributeValue] = useState("0");
  const [benefitHpBonus, setBenefitHpBonus] = useState("0");
  const [benefitManaBonus, setBenefitManaBonus] = useState("0");
  const [benefitExtraSkills, setBenefitExtraSkills] = useState("0");
  const [benefitAdvantages, setBenefitAdvantages] = useState("");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [isSavingBenefit, setIsSavingBenefit] = useState(false);

  // Ações assíncronas (Tradução e Duplicação)
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

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
      keyAttribute: string;
      hpPerLevel: number;
      description: string;
      proficiencies: Proficiencies;
    }>
  >([]);
  const [selectedPf2eKeys, setSelectedPf2eKeys] = useState<Set<string>>(new Set());
  const [searchPf2eCatalog, setSearchPf2eCatalog] = useState("");
  const [translatePf2eWithLLM, setTranslatePf2eWithLLM] = useState(true);
  const [isLoadingPf2eCatalog, setIsLoadingPf2eCatalog] = useState(false);
  const [isImportingPf2e, setIsImportingPf2e] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes", { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar classes");
        return;
      }

      setClasses(data.data || []);
    } catch {
      setError("Erro de conexão ao carregar classes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadClassBenefits = useCallback(async (classId: string) => {
    setIsLoadingBenefits(true);
    try {
      const response = await fetch(`/api/classes/${classId}/benefits`, { credentials: "include" });
      const data = await response.json();

      if (response.ok && Array.isArray(data.data)) {
        setClassBenefits(data.data);
      } else {
        setClassBenefits([]);
      }
    } catch {
      setClassBenefits([]);
    } finally {
      setIsLoadingBenefits(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  // Registro de Ações no Header do ContentManager
  const handleOpenDndCatalog = async () => {
    setShowDndCatalogModal(true);
    clearMessages();
    setIsLoadingDndCatalog(true);
    try {
      const res = await fetch("/api/classes/dnd-catalog", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.results) {
        setDndCatalogList(data.results);
      } else {
        setError(data.error || "Erro ao carregar catálogo D&D 5e.");
      }
    } catch {
      setError("Erro ao carregar catálogo D&D 5e.");
    } finally {
      setIsLoadingDndCatalog(false);
    }
  };

  const handleOpenPf2eCatalog = async () => {
    setShowPf2eCatalogModal(true);
    clearMessages();
    setIsLoadingPf2eCatalog(true);
    try {
      const res = await fetch("/api/classes/pf2e-catalog", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.results) {
        setPf2eCatalogList(data.results);
      } else {
        setError(data.error || "Erro ao carregar catálogo Pathfinder 2e.");
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
        openCreate: () => {
          handleOpenCreateModal();
        },
        openCatalog: () => void handleOpenDndCatalog(),
        openPf2eCatalog: () => void handleOpenPf2eCatalog(),
      });
    }
  }, [onRegisterActions]);

  // Conversões auxiliares de itens
  const toInitialItems = (draft: DraftItem[]): InitialItem[] =>
    draft
      .filter((item) => item.name.trim())
      .map((item) => ({
        item_id: null,
        name: item.name.trim(),
        quantity: Math.max(Number(item.quantity) || 1, 1),
        description: item.description.trim() || undefined,
      }));

  const fromInitialItems = (items: InitialItem[] | undefined): DraftItem[] =>
    (items ?? []).map((item) => ({
      name: item.name,
      quantity: String(item.quantity),
      description: item.description ?? "",
    }));

  // Abertura do Modal de Detalhes
  const openClassDetails = async (rpgClass: RpgClass) => {
    clearMessages();
    setDetailClassId(rpgClass.id);
    setActiveDetailTab("geral");
    setEditName(rpgClass.name);
    setEditDescription(rpgClass.description ?? "");
    setEditItems(fromInitialItems(rpgClass.initialItems));
    setEditProficiencies(rpgClass.proficiencies ?? EMPTY_PROFICIENCIES);
    setEditingBenefitId(null);
    resetBenefitForm();
    await loadClassBenefits(rpgClass.id);
  };

  const closeClassDetails = () => {
    setDetailClassId(null);
    setClassBenefits([]);
    setEditingBenefitId(null);
  };

  const resetBenefitForm = () => {
    setBenefitLevel("1");
    setBenefitAttribute("forca");
    setBenefitAttributeValue("0");
    setBenefitHpBonus("0");
    setBenefitManaBonus("0");
    setBenefitExtraSkills("0");
    setBenefitAdvantages("");
    setBenefitDescription("");
    setEditingBenefitId(null);
  };

  // Funções de Criação Manual Rica
  const resetCreateBenefitForm = (levelNum = "1") => {
    setCreateEditingLevel(null);
    setCreateBenefitLevel(levelNum);
    setCreateBenefitAttribute(createKeyAttribute || "forca");
    setCreateBenefitAttributeValue("0");
    setCreateBenefitHpBonus(String(createHpDie || 8));
    setCreateBenefitManaBonus(String(createManaProgression || 0));
    setCreateBenefitExtraSkills("0");
    setCreateBenefitAdvantages("");
    setCreateBenefitDescription("");
  };

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateDraftItems([]);
    setCreateProficiencies(EMPTY_PROFICIENCIES);
    setCreateLevelBenefits([]);
    setActiveCreateTab("geral");
    setCreateHpDie(8);
    setCreateManaProgression(0);
    setCreateKeyAttribute("forca");
    resetCreateBenefitForm("1");
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    clearMessages();
    setShowCreateModal(true);
  };

  const handleGenerateDefaultProgression = () => {
    const hp = Number(createHpDie) || 8;
    const mana = Number(createManaProgression) || 0;
    const keyAttr = createKeyAttribute || "forca";
    const classNameClean = createName.trim() || "Classe";

    const keyLevels = [4, 8, 12, 16, 19];
    const newLevels: Array<{ level: number; benefits: ClassLevelBenefit }> = [];

    for (let lvl = 1; lvl <= 20; lvl++) {
      const isKeyLevel = keyLevels.includes(lvl);
      const attrBonus = isKeyLevel ? { [keyAttr]: 1 } : undefined;
      const manaBonus = mana > 0 ? (lvl === 1 ? mana * 2 : mana) : 0;

      const advantages: string[] = [];
      if (lvl === 1) {
        advantages.push(`Fundamentos de ${classNameClean}`, "Talento Inicial");
      } else if (lvl === 3) {
        advantages.push("Especialização de Arquétipo");
      } else if (lvl === 5) {
        advantages.push(mana > 0 ? "Aprimoramento Mágico Superior" : "Ataque Extra / Combate Rápido");
      } else if (lvl === 7) {
        advantages.push("Evasão & Defesa Aprimorada");
      } else if (lvl === 10) {
        advantages.push("Poder de Especialização Maior");
      } else if (lvl === 14) {
        advantages.push("Capacidade Épica de Classe");
      } else if (lvl === 18) {
        advantages.push("Mestria Lendária");
      } else if (lvl === 20) {
        advantages.push(`Ápice de ${classNameClean} (Capacidades Supremas)`);
      }

      if (isKeyLevel) {
        advantages.push(`Aumento de Atributo (+1 ${keyAttr.toUpperCase()})`);
      }

      const descParts: string[] = [];
      descParts.push(`HP +${hp}`);
      if (manaBonus > 0) descParts.push(`Mana +${manaBonus}`);
      if (isKeyLevel) descParts.push(`+1 em ${keyAttr.toUpperCase()}`);
      if (advantages.length > 0) descParts.push(advantages.join(", "));

      newLevels.push({
        level: lvl,
        benefits: {
          hp_bonus: hp,
          mana_bonus: manaBonus > 0 ? manaBonus : undefined,
          attribute_bonuses: attrBonus,
          extra_trained_skills: lvl === 1 ? 2 : (lvl % 4 === 0 ? 1 : undefined),
          advantages: advantages.length > 0 ? advantages : undefined,
          description: descParts.join(" · "),
        },
      });
    }

    setCreateLevelBenefits(newLevels);
    setSuccessMessage("⚡ Progressão padrão de 20 níveis gerada com sucesso!");
  };

  const handleSaveCreateBenefit = () => {
    const lvlNum = Number(createBenefitLevel);
    if (!lvlNum || lvlNum < 1 || lvlNum > 20) return;

    const attributeBonus = Number(createBenefitAttributeValue) || 0;
    const parsedAdvantages = createBenefitAdvantages
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const benefits: ClassLevelBenefit = {
      attribute_bonuses: attributeBonus !== 0 ? { [createBenefitAttribute]: attributeBonus } : undefined,
      hp_bonus: Number(createBenefitHpBonus) || 0,
      mana_bonus: Number(createBenefitManaBonus) || 0,
      extra_trained_skills: Number(createBenefitExtraSkills) || 0,
      advantages: parsedAdvantages.length > 0 ? parsedAdvantages : undefined,
      description: createBenefitDescription || undefined,
    };

    setCreateLevelBenefits((prev) => {
      const existingIndex = prev.findIndex((b) => b.level === lvlNum);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { level: lvlNum, benefits };
        return updated.sort((a, b) => a.level - b.level);
      } else {
        return [...prev, { level: lvlNum, benefits }].sort((a, b) => a.level - b.level);
      }
    });

    resetCreateBenefitForm(String(Math.min(lvlNum + 1, 20)));
  };

  const startEditCreateBenefit = (lvlNum: number) => {
    const levelItem = createLevelBenefits.find((b) => b.level === lvlNum);
    setCreateEditingLevel(lvlNum);
    setCreateBenefitLevel(String(lvlNum));

    if (levelItem) {
      setCreateBenefitHpBonus(String(levelItem.benefits.hp_bonus || 0));
      setCreateBenefitManaBonus(String(levelItem.benefits.mana_bonus || 0));
      setCreateBenefitExtraSkills(String(levelItem.benefits.extra_trained_skills || 0));
      setCreateBenefitAdvantages((levelItem.benefits.advantages || []).join(", "));
      setCreateBenefitDescription(levelItem.benefits.description || "");

      const attrEntries = Object.entries(levelItem.benefits.attribute_bonuses || {});
      if (attrEntries.length > 0) {
        setCreateBenefitAttribute(attrEntries[0][0] as Attribute);
        setCreateBenefitAttributeValue(String(attrEntries[0][1]));
      } else {
        setCreateBenefitAttribute(createKeyAttribute || "forca");
        setCreateBenefitAttributeValue("0");
      }
    } else {
      setCreateBenefitHpBonus(String(createHpDie || 8));
      setCreateBenefitManaBonus(String(createManaProgression || 0));
      setCreateBenefitExtraSkills("0");
      setCreateBenefitAdvantages("");
      setCreateBenefitDescription("");
      setCreateBenefitAttribute(createKeyAttribute || "forca");
      setCreateBenefitAttributeValue("0");
    }
  };

  const handleDeleteCreateBenefit = (lvlNum: number) => {
    setCreateLevelBenefits((prev) => prev.filter((b) => b.level !== lvlNum));
    if (createEditingLevel === lvlNum) {
      resetCreateBenefitForm(String(lvlNum));
    }
  };

  // Criação Manual de Classe
  const handleCreateClass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearMessages();
    if (!createName.trim()) {
      setError("O nome da classe é obrigatório.");
      return;
    }
    setIsCreating(true);

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || null,
          initialItems: toInitialItems(createDraftItems),
          proficiencies: createProficiencies,
          levelBenefits: createLevelBenefits.map((b) => ({
            level: b.level,
            benefits: b.benefits,
          })),
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar classe");
        return;
      }

      resetCreateForm();
      setShowCreateModal(false);
      setSuccessMessage(
        `Classe "${data.data?.name || createName}" criada com sucesso${
          createLevelBenefits.length > 0 ? ` com ${createLevelBenefits.length} níveis de progressão!` : "!"
        }`
      );
      await loadClasses();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  // Salvar Edição da Classe
  const handleSaveEdit = async () => {
    if (!detailClassId) return;
    clearMessages();
    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/classes/${detailClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          initialItems: toInitialItems(editItems),
          proficiencies: editProficiencies,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar classe");
        return;
      }

      setSuccessMessage("Classe atualizada com sucesso!");
      await loadClasses();
    } catch {
      setError("Erro de conexão ao salvar classe.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Traduzir Classe com IA
  const handleTranslateClass = async (classId: string) => {
    clearMessages();
    setTranslatingId(classId);

    try {
      const response = await fetch(`/api/classes/${classId}/translate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao traduzir classe com IA");
        return;
      }

      setSuccessMessage("Classe traduzida com sucesso via IA!");
      await loadClasses();

      if (detailClassId === classId && data.data) {
        setEditName(data.data.name);
        setEditDescription(data.data.description ?? "");
        setEditItems(fromInitialItems(data.data.initialItems));
        setEditProficiencies(data.data.proficiencies ?? EMPTY_PROFICIENCIES);
        if (Array.isArray(data.benefits)) {
          setClassBenefits(data.benefits);
        }
      }
    } catch {
      setError("Erro de conexão ao solicitar tradução com IA.");
    } finally {
      setTranslatingId(null);
    }
  };

  // Duplicar Classe
  const handleDuplicateClass = async (classId: string) => {
    clearMessages();
    setDuplicatingId(classId);

    try {
      const response = await fetch(`/api/classes/${classId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao duplicar classe");
        return;
      }

      setSuccessMessage("Classe duplicada com sucesso!");
      await loadClasses();
    } catch {
      setError("Erro de conexão ao duplicar classe.");
    } finally {
      setDuplicatingId(null);
    }
  };

  // Excluir Classe
  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm("Deseja realmente excluir esta classe e todos os seus benefícios por nível?")) {
      return;
    }

    clearMessages();
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir classe");
        return;
      }

      if (detailClassId === classId) {
        closeClassDetails();
      }
      setSuccessMessage("Classe excluída com sucesso.");
      await loadClasses();
    } catch {
      setError("Erro de conexão ao excluir classe.");
    }
  };

  // Salvar ou Adicionar Benefício de Nível
  const handleSaveBenefit = async () => {
    if (!detailClassId) return;
    clearMessages();
    setIsSavingBenefit(true);

    try {
      const attributeBonus = Number(benefitAttributeValue) || 0;
      const parsedAdvantages = benefitAdvantages
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const benefitPayload = {
        level: Number(benefitLevel),
        benefits: {
          attribute_bonuses: attributeBonus !== 0 ? { [benefitAttribute]: attributeBonus } : undefined,
          hp_bonus: Number(benefitHpBonus) || 0,
          mana_bonus: Number(benefitManaBonus) || 0,
          extra_trained_skills: Number(benefitExtraSkills) || 0,
          advantages: parsedAdvantages.length > 0 ? parsedAdvantages : undefined,
          description: benefitDescription || undefined,
        },
      };

      let response: Response;

      if (editingBenefitId) {
        // Atualizar benefício existente
        response = await fetch(`/api/classes/${detailClassId}/benefits/${editingBenefitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(benefitPayload),
          credentials: "include",
        });
      } else {
        // Criar novo benefício de nível
        response = await fetch(`/api/classes/${detailClassId}/benefits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(benefitPayload),
          credentials: "include",
        });
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar benefício de nível");
        return;
      }

      resetBenefitForm();
      await loadClassBenefits(detailClassId);
      setSuccessMessage(editingBenefitId ? "Benefício de nível atualizado!" : "Benefício de nível adicionado!");
    } catch {
      setError("Erro ao salvar benefício de nível.");
    } finally {
      setIsSavingBenefit(false);
    }
  };

  const startEditBenefit = (benefit: Benefit) => {
    setEditingBenefitId(benefit.id);
    setBenefitLevel(String(benefit.level));
    setBenefitHpBonus(String(benefit.benefits.hp_bonus || 0));
    setBenefitManaBonus(String(benefit.benefits.mana_bonus || 0));
    setBenefitExtraSkills(String(benefit.benefits.extra_trained_skills || 0));
    setBenefitAdvantages((benefit.benefits.advantages || []).join(", "));
    setBenefitDescription(benefit.benefits.description || "");

    const attrEntries = Object.entries(benefit.benefits.attribute_bonuses || {});
    if (attrEntries.length > 0) {
      setBenefitAttribute(attrEntries[0][0] as Attribute);
      setBenefitAttributeValue(String(attrEntries[0][1]));
    } else {
      setBenefitAttribute("forca");
      setBenefitAttributeValue("0");
    }
  };

  const handleDeleteBenefit = async (benefitId: string) => {
    if (!detailClassId || !window.confirm("Deseja remover o benefício deste nível?")) return;
    clearMessages();

    try {
      const response = await fetch(`/api/classes/${detailClassId}/benefits/${benefitId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir benefício");
        return;
      }

      if (editingBenefitId === benefitId) {
        resetBenefitForm();
      }
      await loadClassBenefits(detailClassId);
    } catch {
      setError("Erro ao excluir benefício.");
    }
  };

  // Importação de D&D 5e
  const handleToggleSelectDndClass = (index: string) => {
    setSelectedDndIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleImportSelectedDndClasses = async () => {
    if (selectedDndIndexes.size === 0) return;
    clearMessages();
    setIsImportingDnd(true);

    try {
      const response = await fetch("/api/classes/import-dnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classIndexes: Array.from(selectedDndIndexes),
          translateWithLLM: translateDndWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao importar classes do D&D 5e");
        return;
      }

      await loadClasses();
      setShowDndCatalogModal(false);
      setSelectedDndIndexes(new Set());
      setSuccessMessage(data.message || "Classes do D&D 5e importadas com sucesso!");
    } catch {
      setError("Erro ao conectar com API de importação D&D 5e.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  const handleImportAllDndClasses = async () => {
    if (!window.confirm("Deseja importar TODAS as 12 classes do D&D 5e para sua biblioteca?")) return;
    clearMessages();
    setIsImportingDnd(true);

    try {
      const response = await fetch("/api/classes/import-dnd", {
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
        setError(data.error || "Erro ao importar todas as classes do D&D 5e");
        return;
      }

      await loadClasses();
      setShowDndCatalogModal(false);
      setSuccessMessage(data.message || "Todas as classes do D&D 5e foram importadas!");
    } catch {
      setError("Erro ao importar classes do D&D 5e.");
    } finally {
      setIsImportingDnd(false);
    }
  };

  // Importação de Pathfinder 2e
  const handleToggleSelectPf2eClass = (key: string) => {
    setSelectedPf2eKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImportSelectedPf2eClasses = async () => {
    if (selectedPf2eKeys.size === 0) return;
    clearMessages();
    setIsImportingPf2e(true);

    try {
      const response = await fetch("/api/classes/import-pf2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classKeys: Array.from(selectedPf2eKeys),
          translateWithLLM: translatePf2eWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao importar classes do Pathfinder 2e");
        return;
      }

      await loadClasses();
      setShowPf2eCatalogModal(false);
      setSelectedPf2eKeys(new Set());
      setSuccessMessage(data.message || "Classes selecionadas do Pathfinder 2e importadas com sucesso!");
    } catch {
      setError("Erro ao importar da API Pathfinder 2e.");
    } finally {
      setIsImportingPf2e(false);
    }
  };

  const handleImportAllPf2eClasses = async () => {
    if (!window.confirm(`Deseja importar TODAS as ${pf2eCatalogList.length} classes do Pathfinder 2e com progressão completa de 20 níveis?`)) return;
    clearMessages();
    setIsImportingPf2e(true);

    try {
      const response = await fetch("/api/classes/import-pf2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importAll: true,
          translateWithLLM: translatePf2eWithLLM,
        }),
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao importar todas as classes do Pathfinder 2e");
        return;
      }

      await loadClasses();
      setShowPf2eCatalogModal(false);
      setSuccessMessage(data.message || "Todas as classes do Pathfinder 2e foram importadas!");
    } catch {
      setError("Erro ao importar da API Pathfinder 2e.");
    } finally {
      setIsImportingPf2e(false);
    }
  };

  // Filtragem e Paginação
  useEffect(() => {
    setCurrentPage(1);
  }, [searchClass]);

  const filteredClasses = classes.filter((cls) => {
    const q = searchClass.toLowerCase();
    return (
      cls.name.toLowerCase().includes(q) ||
      (cls.description && cls.description.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredClasses.length / pageSize) || 1;
  const paginatedClasses = filteredClasses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Renderizadores de formulários de itens e proficiências
  const renderItemsEditor = (
    items: DraftItem[],
    onChange: (items: DraftItem[]) => void,
    disabled: boolean,
    prefix: string
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-300">Itens Iniciais da Classe</label>
        <button
          type="button"
          onClick={() => onChange([...items, { name: "", quantity: "1", description: "" }])}
          disabled={disabled}
          className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
        >
          + Adicionar Item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-500 italic bg-gray-950 p-3 rounded-xl border border-gray-800">
          Nenhum item inicial configurado para esta classe.
        </p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div
              key={`${prefix}-item-${index}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-950 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Input
                  label={index === 0 ? "Nome do Item" : undefined}
                  name={`${prefix}-item-name-${index}`}
                  type="text"
                  placeholder="Nome do item (ex: Espada Longa)"
                  value={item.name}
                  onChange={(e) =>
                    onChange(items.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))
                  }
                  disabled={disabled}
                  className="flex-1 bg-gray-900 text-white"
                />
                <Input
                  label={index === 0 ? "Qtd" : undefined}
                  name={`${prefix}-item-qty-${index}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    onChange(items.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)))
                  }
                  disabled={disabled}
                  className="w-20 bg-gray-900 text-white"
                />
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  disabled={disabled}
                  className="mt-4 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 p-1.5"
                  title="Remover Item"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="Descrição opcional do item..."
                value={item.description}
                onChange={(e) =>
                  onChange(items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none transition"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProficienciesEditor = (
    profs: Proficiencies,
    onChange: (value: Proficiencies) => void,
    disabled: boolean,
    prefix: string
  ) => (
    <div className="space-y-3">
      <label className="text-xs font-bold text-gray-300">Proficiências da Classe</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROFICIENCY_CATEGORIES.map((category) => (
          <div key={`${prefix}-prof-${category.key}`} className="space-y-1">
            <Input
              label={category.label}
              name={`${prefix}-prof-${category.key}`}
              type="text"
              placeholder={category.placeholder}
              value={(profs[category.key] ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  ...profs,
                  [category.key]: e.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              disabled={disabled}
              className="bg-gray-950 text-white text-xs"
            />
            <p className="text-[10px] text-gray-500">Separe os itens com vírgulas.</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-xs text-red-300 flex items-center justify-between shadow-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-2">✕</button>
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center justify-between shadow-lg">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* Grade Principal de Classes */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl flex flex-col max-h-[calc(100vh-16rem)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <span>Classes Cadastradas</span>
          </h3>
          <div className="text-xs text-gray-400 font-semibold whitespace-nowrap">
            Total:{" "}
            <span className="text-xs text-purple-400 font-bold bg-purple-950/60 border border-purple-900/60 px-2.5 py-1 rounded-lg">
              {filteredClasses.length} classes
            </span>
          </div>
        </div>

        <input
          type="text"
          placeholder="Pesquisar classe na biblioteca por nome ou descrição..."
          value={searchClass}
          onChange={(e) => setSearchClass(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition mb-4 shrink-0"
        />

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[220px] flex-1">
            <Spinner size="lg" />
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 space-y-2 flex-1">
            <p>Nenhuma classe cadastrada na biblioteca ainda.</p>
            <p className="text-xs text-gray-500">
              Clique em <strong>+ Criar Classe</strong>, <strong>Catálogo Pathfinder 2e</strong> ou <strong>Catálogo D&D 5e</strong> acima para popular.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {paginatedClasses.map((cls) => {
                  const initialItemsCount = (cls.initialItems || []).length;
                  const weapons = cls.proficiencies?.weapons || [];
                  const armor = cls.proficiencies?.armor || [];
                  const isTranslating = translatingId === cls.id;
                  const isDuplicating = duplicatingId === cls.id;

                  return (
                    <div
                      key={cls.id}
                      className="rounded-xl border border-gray-800 bg-gray-950 p-4 hover:border-purple-600/60 hover:shadow-lg transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => openClassDetails(cls)}
                            className="font-bold text-white text-base hover:text-purple-300 cursor-pointer transition flex items-center gap-2"
                          >
                            <span className="text-lg">🛡️</span>
                            <span className="truncate">{cls.name}</span>
                          </div>
                          <span className="shrink-0 rounded-lg bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            Classe RPG
                          </span>
                        </div>

                        {cls.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {cls.description}
                          </p>
                        )}

                        {/* Badges de Destaque */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {initialItemsCount > 0 && (
                            <span className="rounded-md bg-gray-900 border border-gray-800 px-2 py-0.5 text-[10px] text-gray-300">
                              📦 {initialItemsCount} {initialItemsCount === 1 ? "item" : "itens"}
                            </span>
                          )}

                          {weapons.length > 0 && (
                            <span className="rounded-md bg-gray-900 border border-gray-800 px-2 py-0.5 text-[10px] text-gray-300 truncate max-w-[140px]" title={weapons.join(", ")}>
                              ⚔️ {weapons[0]} {weapons.length > 1 ? `+${weapons.length - 1}` : ""}
                            </span>
                          )}

                          {armor.length > 0 && (
                            <span className="rounded-md bg-gray-900 border border-gray-800 px-2 py-0.5 text-[10px] text-gray-300 truncate max-w-[140px]" title={armor.join(", ")}>
                              🛡️ {armor[0]} {armor.length > 1 ? `+${armor.length - 1}` : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação do Card */}
                      <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => openClassDetails(cls)}
                          className="font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                        >
                          <span>Ver / Editar</span>
                          <span>→</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleTranslateClass(cls.id)}
                            disabled={isTranslating}
                            className="text-purple-400 hover:text-purple-300 disabled:opacity-50 transition flex items-center gap-1"
                            title="Traduzir com IA (9Router)"
                          >
                            {isTranslating ? (
                              <span className="text-[10px] text-purple-300">Traduzindo...</span>
                            ) : (
                              <span>🌐 IA</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateClass(cls.id)}
                            disabled={isDuplicating}
                            className="text-gray-400 hover:text-purple-300 disabled:opacity-50 transition"
                            title="Duplicar Classe"
                          >
                            {isDuplicating ? "..." : "Duplicar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-red-400 hover:text-red-300 transition"
                            title="Excluir Classe"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paginação */}
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
                Página {currentPage} / {totalPages} ({filteredClasses.length} Classes)
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

      {/* ========================================================================= */}
      {/* MODAL / OVERLAY: DETALHES E EDIÇÃO COMPLETA DA CLASSE (Tabs 1-20, etc.) */}
      {/* ========================================================================= */}
      {detailClassId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={closeClassDetails}
        >
          <div
            className="w-full max-w-5xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h3 className="text-lg font-bold text-purple-200">{editName || "Detalhes da Classe"}</h3>
                  <p className="text-xs text-purple-400">
                    Gerenciamento completo da classe, equipamentos, proficiências e benefícios por nível
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTranslateClass(detailClassId)}
                  disabled={translatingId === detailClassId}
                  className="rounded-xl border border-purple-600 bg-purple-950/80 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-900 transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Traduzir nome, descrição e níveis com IA"
                >
                  {translatingId === detailClassId ? (
                    <>
                      <Spinner size="sm" />
                      <span>Traduzindo com IA...</span>
                    </>
                  ) : (
                    <>
                      <span>🌐</span>
                      <span>Traduzir com IA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeClassDetails}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Abas de Navegação do Modal */}
            <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2 shrink-0">
              {[
                { id: "geral", label: "Geral & Descrição", icon: "📝" },
                { id: "itens", label: `Itens Iniciais (${editItems.length})`, icon: "🎒" },
                { id: "proficiencias", label: "Proficiências", icon: "⚔️" },
                { id: "niveis", label: `Progressão de Níveis (${classBenefits.length}/20)`, icon: "⭐" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeDetailTab === tab.id
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-950"
                      : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {activeDetailTab === "geral" && (
                <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                  <Input
                    label="Nome da Classe"
                    name="edit-class-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    disabled={isSavingEdit}
                    className="bg-gray-950 text-white"
                  />

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-300">
                      Descrição da Classe
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={isSavingEdit}
                      rows={4}
                      placeholder="Descreva a história, treinamento e papel desta classe no mundo de jogo..."
                      className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {activeDetailTab === "itens" && (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                  {renderItemsEditor(editItems, setEditItems, isSavingEdit, "edit-detail")}
                </div>
              )}

              {activeDetailTab === "proficiencias" && (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                  {renderProficienciesEditor(editProficiencies, setEditProficiencies, isSavingEdit, "edit-detail")}
                </div>
              )}

              {activeDetailTab === "niveis" && (
                <div className="space-y-5">
                  {/* Formulário de Adicionar / Editar Benefício de Nível */}
                  <div className="rounded-2xl border border-purple-900/60 bg-gray-900 p-4 shadow-lg space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <span>{editingBenefitId ? "✏️ Editar Benefício de Nível" : "+ Configurar Benefício de Nível"}</span>
                      </h4>
                      {editingBenefitId && (
                        <button
                          type="button"
                          onClick={resetBenefitForm}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-400">Nível (1-20)</label>
                        <select
                          value={benefitLevel}
                          onChange={(e) => setBenefitLevel(e.target.value)}
                          disabled={isSavingBenefit || !!editingBenefitId}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
                            <option key={lvl} value={lvl}>
                              Nível {lvl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="+HP Bônus"
                        name="benefit-hp"
                        type="number"
                        min={0}
                        value={benefitHpBonus}
                        onChange={(e) => setBenefitHpBonus(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="+Mana Bônus"
                        name="benefit-mana"
                        type="number"
                        min={0}
                        value={benefitManaBonus}
                        onChange={(e) => setBenefitManaBonus(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-400">Atributo</label>
                        <select
                          value={benefitAttribute}
                          onChange={(e) => setBenefitAttribute(e.target.value as Attribute)}
                          disabled={isSavingBenefit}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          {ATTRIBUTES.map((attr) => (
                            <option key={attr} value={attr}>
                              {attr.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="Bônus Atributo"
                        name="benefit-attr-val"
                        type="number"
                        value={benefitAttributeValue}
                        onChange={(e) => setBenefitAttributeValue(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="+Perícias Extras"
                        name="benefit-skills"
                        type="number"
                        min={0}
                        value={benefitExtraSkills}
                        onChange={(e) => setBenefitExtraSkills(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <Input
                        label="Vantagens / Habilidades (separadas por vírgula)"
                        name="benefit-advantages"
                        type="text"
                        placeholder="Ex: Ataque Furtivo, Fúria, Rajada de Golpes"
                        value={benefitAdvantages}
                        onChange={(e) => setBenefitAdvantages(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="Descrição Detalhada do Nível"
                        name="benefit-desc"
                        type="text"
                        placeholder="Ex: Ganha acesso ao 2º círculo de magias e novo talento..."
                        value={benefitDescription}
                        onChange={(e) => setBenefitDescription(e.target.value)}
                        disabled={isSavingBenefit}
                        className="bg-gray-950 text-white text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveBenefit}
                        disabled={isSavingBenefit}
                        className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition disabled:opacity-50"
                      >
                        {isSavingBenefit ? "Salvando..." : editingBenefitId ? "Atualizar Benefício" : "+ Adicionar ao Nível"}
                      </button>
                    </div>
                  </div>

                  {/* Lista de Níveis Configurados */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-300">
                      Tabela de Progressão (1 a 20)
                    </h4>

                    {isLoadingBenefits ? (
                      <div className="flex items-center justify-center p-8">
                        <Spinner size="md" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {Array.from({ length: 20 }, (_, idx) => {
                          const lvlNum = idx + 1;
                          const benefit = classBenefits.find((b) => b.level === lvlNum);

                          return (
                            <div
                              key={lvlNum}
                              className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition ${
                                benefit
                                  ? "border-gray-800 bg-gray-900/90 text-white"
                                  : "border-gray-800/40 bg-gray-950/40 text-gray-500"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-[90px]">
                                <span className={`text-xs font-extrabold rounded-lg px-2.5 py-1 ${
                                  benefit ? "bg-purple-950 border border-purple-800 text-purple-300" : "bg-gray-900 text-gray-600"
                                }`}>
                                  Nv. {lvlNum}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                {benefit ? (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                                      {benefit.benefits.hp_bonus ? (
                                        <span className="rounded bg-red-950/70 border border-red-800/60 px-1.5 py-0.5 text-red-300 font-semibold">
                                          +{benefit.benefits.hp_bonus} HP
                                        </span>
                                      ) : null}

                                      {benefit.benefits.mana_bonus ? (
                                        <span className="rounded bg-blue-950/70 border border-blue-800/60 px-1.5 py-0.5 text-blue-300 font-semibold">
                                          +{benefit.benefits.mana_bonus} Mana
                                        </span>
                                      ) : null}

                                      {benefit.benefits.attribute_bonuses &&
                                        Object.entries(benefit.benefits.attribute_bonuses).map(([attr, val]) => (
                                          <span key={attr} className="rounded bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 text-amber-300 font-semibold">
                                            +{val} {attr.toUpperCase()}
                                          </span>
                                        ))}

                                      {benefit.benefits.extra_trained_skills ? (
                                        <span className="rounded bg-purple-950/70 border border-purple-800/60 px-1.5 py-0.5 text-purple-300 font-semibold">
                                          +{benefit.benefits.extra_trained_skills} Perícia(s)
                                        </span>
                                      ) : null}

                                      {(benefit.benefits.advantages || []).map((adv) => (
                                        <span key={adv} className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                                          ⚡ {adv}
                                        </span>
                                      ))}
                                    </div>

                                    {benefit.benefits.description && (
                                      <p className="text-xs text-gray-400 truncate">
                                        {benefit.benefits.description}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs italic text-gray-600">Nenhum benefício extra configurado para este nível.</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {benefit ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditBenefit(benefit)}
                                      className="text-xs text-purple-400 hover:text-purple-300"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBenefit(benefit.id)}
                                      className="text-xs text-red-400 hover:text-red-300"
                                    >
                                      Remover
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      resetBenefitForm();
                                      setBenefitLevel(String(lvlNum));
                                    }}
                                    className="text-xs text-gray-500 hover:text-purple-300"
                                  >
                                    + Configurar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com Ações */}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3 shrink-0">
              <button
                type="button"
                onClick={closeClassDetails}
                className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 transition"
              >
                Fechar
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="master"
                  isLoading={isSavingEdit}
                  onClick={handleSaveEdit}
                  className="px-5 text-xs"
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVA CLASSE MANUALMENTE (RICO COM ABAS E NÍVEIS 1-20) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-5xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h3 className="text-lg font-bold text-purple-200">
                    {createName.trim() ? `Criar Classe: ${createName}` : "Criar Nova Classe de Personagem"}
                  </h3>
                  <p className="text-xs text-purple-400">
                    Defina conceito, itens iniciais, proficiências e progressão balanceada de níveis 1 a 20
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Abas de Navegação do Modal de Criação */}
            <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2 shrink-0">
              {[
                { id: "geral", label: "Geral & Conceito", icon: "📝" },
                { id: "itens", label: `Itens Iniciais (${createDraftItems.length})`, icon: "🎒" },
                {
                  id: "proficiencias",
                  label: `Proficiências (${Object.values(createProficiencies).reduce((acc, curr) => acc + (curr?.length || 0), 0)})`,
                  icon: "⚔️",
                },
                { id: "niveis", label: `Progressão de Níveis (${createLevelBenefits.length}/20)`, icon: "⭐" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCreateTab(tab.id as typeof activeCreateTab)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCreateTab === tab.id
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-950"
                      : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Conteúdo das Abas de Criação */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {activeCreateTab === "geral" && (
                <div className="space-y-4">
                  <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                    <Input
                      label="Nome da Classe"
                      name="create-class-name"
                      type="text"
                      placeholder="Ex: Guerreiro, Feiticeiro das Sombras, Pistoleiro, Algoz"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                      disabled={isCreating}
                      className="bg-gray-950 text-white"
                    />

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-300">
                        Descrição da Classe
                      </label>
                      <textarea
                        value={createDescription}
                        onChange={(e) => setCreateDescription(e.target.value)}
                        disabled={isCreating}
                        rows={3}
                        placeholder="Descreva a história, treinamento, propósito e capacidades desta classe no mundo de jogo..."
                        className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Gerador de Progressão Rápida (Níveis 1-20) */}
                  <div className="rounded-2xl border border-purple-900/80 bg-purple-950/20 p-4 shadow-lg space-y-3.5">
                    <div className="flex items-center justify-between border-b border-purple-900/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚡</span>
                        <div>
                          <h4 className="text-xs font-bold text-purple-200">
                            Configuração de Progressão Rápida (Níveis 1 a 20)
                          </h4>
                          <p className="text-[11px] text-purple-400">
                            Configure os parâmetros para preencher automaticamente os 20 níveis com HP, Mana, aumentos de atributo e marcos.
                          </p>
                        </div>
                      </div>

                      {createLevelBenefits.length > 0 && (
                        <span className="rounded-lg bg-emerald-950 border border-emerald-800/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          ✓ {createLevelBenefits.length}/20 níveis configurados
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-purple-300">
                          Dado de Vida / HP por Nível
                        </label>
                        <select
                          value={createHpDie}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCreateHpDie(val);
                            setCreateBenefitHpBonus(String(val));
                          }}
                          disabled={isCreating}
                          className="w-full rounded-xl border border-purple-900/60 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value={6}>d6 (6 HP / Conjurador Frágil)</option>
                          <option value={8}>d8 (8 HP / Moderado / Híbrido)</option>
                          <option value={10}>d10 (10 HP / Combatente Marcial)</option>
                          <option value={12}>d12 (12 HP / Alta Resistência / Tanque)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-purple-300">
                          Mana por Nível
                        </label>
                        <select
                          value={createManaProgression}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCreateManaProgression(val);
                            setCreateBenefitManaBonus(String(val));
                          }}
                          disabled={isCreating}
                          className="w-full rounded-xl border border-purple-900/60 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value={0}>Sem Mana (0 / Foco Físico / Marcial Puro)</option>
                          <option value={2}>Meio-Conjurador (2 Mana / Paladino, Ranger)</option>
                          <option value={4}>Conjurador Pleno (4 Mana / Mago, Clérigo, Feiticeiro)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-purple-300">
                          Atributo Chave
                        </label>
                        <select
                          value={createKeyAttribute}
                          onChange={(e) => {
                            const val = e.target.value as Attribute;
                            setCreateKeyAttribute(val);
                            setCreateBenefitAttribute(val);
                          }}
                          disabled={isCreating}
                          className="w-full rounded-xl border border-purple-900/60 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="forca">FORÇA (FOR)</option>
                          <option value="destreza">DESTREZA (DES)</option>
                          <option value="vigor">VIGOR (VIG)</option>
                          <option value="inteligencia">INTELIGÊNCIA (INT)</option>
                          <option value="empatia">EMPATIA (EMP)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-gray-400">
                        Aumentos de atributos serão aplicados nos níveis chave <strong>4, 8, 12, 16 e 19</strong>.
                      </p>

                      <button
                        type="button"
                        onClick={handleGenerateDefaultProgression}
                        disabled={isCreating}
                        className="w-full sm:w-auto rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-950 transition flex items-center justify-center gap-1.5"
                      >
                        <span>⚡ Gerar Progressão Padrão (Níveis 1-20)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeCreateTab === "itens" && (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                  {renderItemsEditor(createDraftItems, setCreateDraftItems, isCreating, "create")}
                </div>
              )}

              {activeCreateTab === "proficiencias" && (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                  {renderProficienciesEditor(createProficiencies, setCreateProficiencies, isCreating, "create")}
                </div>
              )}

              {activeCreateTab === "niveis" && (
                <div className="space-y-5">
                  {/* Formulário de Adicionar / Editar Benefício de Nível na Criação */}
                  <div className="rounded-2xl border border-purple-900/60 bg-gray-900 p-4 shadow-lg space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <span>
                          {createEditingLevel
                            ? `✏️ Editar Benefício do Nível ${createEditingLevel}`
                            : "+ Configurar Benefício de Nível"}
                        </span>
                      </h4>
                      {createEditingLevel && (
                        <button
                          type="button"
                          onClick={() => resetCreateBenefitForm("1")}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-400">Nível (1-20)</label>
                        <select
                          value={createBenefitLevel}
                          onChange={(e) => setCreateBenefitLevel(e.target.value)}
                          disabled={isCreating || !!createEditingLevel}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
                            <option key={lvl} value={lvl}>
                              Nível {lvl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="+HP Bônus"
                        name="create-benefit-hp"
                        type="number"
                        min={0}
                        value={createBenefitHpBonus}
                        onChange={(e) => setCreateBenefitHpBonus(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="+Mana Bônus"
                        name="create-benefit-mana"
                        type="number"
                        min={0}
                        value={createBenefitManaBonus}
                        onChange={(e) => setCreateBenefitManaBonus(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-400">Atributo</label>
                        <select
                          value={createBenefitAttribute}
                          onChange={(e) => setCreateBenefitAttribute(e.target.value as Attribute)}
                          disabled={isCreating}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          {ATTRIBUTES.map((attr) => (
                            <option key={attr} value={attr}>
                              {attr.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="Bônus Atributo"
                        name="create-benefit-attr-val"
                        type="number"
                        value={createBenefitAttributeValue}
                        onChange={(e) => setCreateBenefitAttributeValue(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="+Perícias Extras"
                        name="create-benefit-skills"
                        type="number"
                        min={0}
                        value={createBenefitExtraSkills}
                        onChange={(e) => setCreateBenefitExtraSkills(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <Input
                        label="Vantagens / Habilidades (separadas por vírgula)"
                        name="create-benefit-advantages"
                        type="text"
                        placeholder="Ex: Ataque Furtivo, Fúria, Rajada de Golpes"
                        value={createBenefitAdvantages}
                        onChange={(e) => setCreateBenefitAdvantages(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />

                      <Input
                        label="Descrição Detalhada do Nível"
                        name="create-benefit-desc"
                        type="text"
                        placeholder="Ex: Ganha acesso ao 2º círculo de magias e novo talento..."
                        value={createBenefitDescription}
                        onChange={(e) => setCreateBenefitDescription(e.target.value)}
                        disabled={isCreating}
                        className="bg-gray-950 text-white text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCreateBenefit}
                        disabled={isCreating}
                        className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition disabled:opacity-50"
                      >
                        {createEditingLevel ? "Atualizar Nível" : "+ Adicionar ao Nível"}
                      </button>
                    </div>
                  </div>

                  {/* Lista de Níveis Configurados na Criação */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-300">
                        Tabela de Progressão (1 a 20) — {createLevelBenefits.length} de 20 configurados
                      </h4>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateDefaultProgression}
                          className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
                        >
                          ⚡ Gerar 20 Níveis Padrão
                        </button>
                        {createLevelBenefits.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCreateLevelBenefits([])}
                            className="text-xs font-semibold text-red-400 hover:text-red-300 transition ml-2"
                          >
                            Limpar Níveis
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {Array.from({ length: 20 }, (_, idx) => {
                        const lvlNum = idx + 1;
                        const benefitItem = createLevelBenefits.find((b) => b.level === lvlNum);

                        return (
                          <div
                            key={lvlNum}
                            className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition ${
                              benefitItem
                                ? "border-gray-800 bg-gray-900/90 text-white"
                                : "border-gray-800/40 bg-gray-950/40 text-gray-500"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-[90px]">
                              <span
                                className={`text-xs font-extrabold rounded-lg px-2.5 py-1 ${
                                  benefitItem
                                    ? "bg-purple-950 border border-purple-800 text-purple-300"
                                    : "bg-gray-900 text-gray-600"
                                }`}
                              >
                                Nv. {lvlNum}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              {benefitItem ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    {benefitItem.benefits.hp_bonus ? (
                                      <span className="rounded bg-red-950/70 border border-red-800/60 px-1.5 py-0.5 text-red-300 font-semibold">
                                        +{benefitItem.benefits.hp_bonus} HP
                                      </span>
                                    ) : null}

                                    {benefitItem.benefits.mana_bonus ? (
                                      <span className="rounded bg-blue-950/70 border border-blue-800/60 px-1.5 py-0.5 text-blue-300 font-semibold">
                                        +{benefitItem.benefits.mana_bonus} Mana
                                      </span>
                                    ) : null}

                                    {benefitItem.benefits.attribute_bonuses &&
                                      Object.entries(benefitItem.benefits.attribute_bonuses).map(([attr, val]) => (
                                        <span
                                          key={attr}
                                          className="rounded bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 text-amber-300 font-semibold"
                                        >
                                          +{val} {attr.toUpperCase()}
                                        </span>
                                      ))}

                                    {benefitItem.benefits.extra_trained_skills ? (
                                      <span className="rounded bg-purple-950/70 border border-purple-800/60 px-1.5 py-0.5 text-purple-300 font-semibold">
                                        +{benefitItem.benefits.extra_trained_skills} Perícia(s)
                                      </span>
                                    ) : null}

                                    {(benefitItem.benefits.advantages || []).map((adv) => (
                                      <span key={adv} className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                                        ⚡ {adv}
                                      </span>
                                    ))}
                                  </div>

                                  {benefitItem.benefits.description && (
                                    <p className="text-xs text-gray-400 truncate">
                                      {benefitItem.benefits.description}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs italic text-gray-600">
                                  Nenhum benefício configurado para este nível.
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {benefitItem ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditCreateBenefit(lvlNum)}
                                    className="text-xs text-purple-400 hover:text-purple-300"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCreateBenefit(lvlNum)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remover
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditCreateBenefit(lvlNum)}
                                  className="text-xs text-gray-500 hover:text-purple-300"
                                >
                                  + Configurar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com Ações do Modal de Criação */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 transition"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{createName.trim() || "Nova Classe"}</span>
                  <span>•</span>
                  <span>{createDraftItems.length} itens</span>
                  <span>•</span>
                  <span>{createLevelBenefits.length}/20 níveis</span>
                </div>

                <Button
                  type="button"
                  variant="master"
                  isLoading={isCreating}
                  onClick={() => void handleCreateClass()}
                  className="px-6 text-xs font-bold shadow-lg shadow-purple-950"
                >
                  Criar Classe Completa
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CATÁLOGO D&D 5E */}
      {/* ========================================================================= */}
      {showDndCatalogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowDndCatalogModal(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐉</span>
                <div>
                  <h3 className="text-lg font-bold text-purple-200">Catálogo D&D 5e ({dndCatalogList.length} Classes)</h3>
                  <p className="text-xs text-purple-400">
                    Importe classes oficiais do SRD D&D 5e com equipamentos, proficiências e benefícios por nível
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
                placeholder="Pesquisar classe D&D 5e (ex: Barbarian, Wizard, Paladin)..."
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
                onClick={handleImportAllDndClasses}
                disabled={isImportingDnd}
                className="w-full sm:w-auto rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition whitespace-nowrap shadow-lg shadow-purple-950 disabled:opacity-50"
              >
                {isImportingDnd ? "Importando..." : `🔥 Importar Todas (${dndCatalogList.length})`}
              </button>
            </div>

            {isLoadingDndCatalog ? (
              <div className="flex items-center justify-center min-h-[220px]">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pr-1 min-h-[280px]">
                {dndCatalogList
                  .filter((c) => c.name.toLowerCase().includes(searchDndCatalog.toLowerCase()))
                  .map((c) => {
                    const isSelected = selectedDndIndexes.has(c.index);

                    return (
                      <div
                        key={c.index}
                        onClick={() => handleToggleSelectDndClass(c.index)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/60 text-white shadow-lg"
                            : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <span className="text-base">🛡️</span>
                          <span className="text-xs font-bold truncate">{c.name}</span>
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
              <span className="text-gray-400 font-semibold">
                {selectedDndIndexes.size} classe(s) selecionada(s)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDndCatalogModal(false)}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 transition"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleImportSelectedDndClasses}
                  disabled={selectedDndIndexes.size === 0 || isImportingDnd}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 shadow-lg shadow-purple-950"
                >
                  {isImportingDnd ? "Importando..." : `Importar Selecionadas (${selectedDndIndexes.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CATÁLOGO PATHFINDER 2E */}
      {/* ========================================================================= */}
      {showPf2eCatalogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowPf2eCatalogModal(false)}
        >
          <div
            className="w-full max-w-5xl rounded-3xl border border-purple-800 bg-gray-950 p-6 shadow-2xl space-y-4 text-gray-100 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚔️</span>
                <div>
                  <h3 className="text-lg font-bold text-purple-200">Catálogo Pathfinder 2e ({pf2eCatalogList.length} Classes)</h3>
                  <p className="text-xs text-purple-400">
                    Importe classes completas do Pathfinder 2e com atributos chave, vida, proficiências e benefícios 1-20
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
                placeholder="Pesquisar classes PF2e (ex: Magus, Kineticist, Gunslinger, Thaumaturge, Monk)..."
                value={searchPf2eCatalog}
                onChange={(e) => setSearchPf2eCatalog(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
              />

              <label className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={translatePf2eWithLLM}
                  onChange={(e) => setTranslatePf2eWithLLM(e.target.checked)}
                  className="rounded border-gray-800 bg-gray-900 text-purple-600 focus:ring-purple-500"
                />
                <span>Traduzir com IA</span>
              </label>

              <button
                type="button"
                onClick={handleImportAllPf2eClasses}
                disabled={isImportingPf2e}
                className="w-full sm:w-auto rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition whitespace-nowrap shadow-lg shadow-purple-950 disabled:opacity-50"
              >
                {isImportingPf2e ? "Importando..." : `🔥 Importar Todas (${pf2eCatalogList.length})`}
              </button>
            </div>

            {isLoadingPf2eCatalog ? (
              <div className="flex items-center justify-center min-h-[220px]">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pr-1 min-h-[280px]">
                {pf2eCatalogList
                  .filter((c) => c.name.toLowerCase().includes(searchPf2eCatalog.toLowerCase()))
                  .map((c) => {
                    const isSelected = selectedPf2eKeys.has(c.key);

                    return (
                      <div
                        key={c.key}
                        onClick={() => handleToggleSelectPf2eClass(c.key)}
                        className={`flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/60 text-white shadow-lg"
                            : "border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className="text-xs font-bold truncate">{c.name}</div>
                            <div className="text-[10px] text-purple-400 font-semibold uppercase mt-0.5">
                              {c.keyAttribute} · {c.hpPerLevel} HP/Nv
                            </div>
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
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs">
              <span className="text-gray-400 font-semibold">
                {selectedPf2eKeys.size} classe(s) selecionada(s)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPf2eCatalogModal(false)}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 transition"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleImportSelectedPf2eClasses}
                  disabled={selectedPf2eKeys.size === 0 || isImportingPf2e}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 shadow-lg shadow-purple-950"
                >
                  {isImportingPf2e ? "Importando..." : `Importar Selecionadas (${selectedPf2eKeys.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
