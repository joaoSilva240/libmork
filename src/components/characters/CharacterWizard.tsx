"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ATTRIBUTES,
  ATTRIBUTE_BASE_VALUE,
  ATTRIBUTE_FREE_POINTS,
  ATTRIBUTE_CREATION_TOTAL,
  SPELL_ACTION_COST_BY_CIRCLE,
} from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";
import { getDerivedStats, getModifier } from "@/lib/engine/attributes";
import { Button, Input, Spinner } from "@/components/ui";
import { Toast } from "@/components/ui/Toast";
import { generateUUID } from "@/lib/utils/uuid";

// =============================================================================
// Types
// =============================================================================

type WizardData = {
  name: string;
  description: string;
  imageUrl: string | null;
  raceId: string | null;
  classId: string | null;
  attributes: Record<Attribute, number>;
  skills: string[];
  spells: string[];
  campaignId: string | null;
};

type RaceData = {
  id: string;
  name: string;
  description: string | null;
  speed: number;
  size: string;
  hitPointsBonus: number;
  attributeBonuses: Record<string, number>;
  languages: string[];
  traits: Array<{ name: string; description?: string }>;
  heritages: Array<{ name: string; description?: string }>;
  imageUrl: string | null;
};

type ClassData = {
  id: string;
  name: string;
  description: string | null;
  initialItems: Array<{ item_id: string | null; name: string; quantity: number; description?: string }>;
  proficiencies: { weapons?: string[]; armor?: string[]; languages?: string[]; tools?: string[] };
};

type SkillData = {
  id: string;
  name: string;
  description: string | null;
  keyAttribute: Attribute;
  rollExpression: string | null;
};

type SpellData = {
  id: string;
  name: string;
  circle: number;
  manaCost: number;
  description: string | null;
  useType: string;
};

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "libmork_character_wizard_draft_v2";

const STEPS = [
  { label: "Básico", shortLabel: "Básico" },
  { label: "Raça", shortLabel: "Raça" },
  { label: "Classe", shortLabel: "Classe" },
  { label: "Atributos", shortLabel: "Atrib." },
  { label: "Perícias", shortLabel: "Perícias" },
  { label: "Magias", shortLabel: "Magias" },
  { label: "Revisão", shortLabel: "Revisar" },
] as const;

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  forca: "Força",
  destreza: "Destreza",
  vigor: "Vigor",
  inteligencia: "Inteligência",
  empatia: "Empatia",
};

const DEFAULT_ATTRIBUTES: Record<Attribute, number> = {
  forca: ATTRIBUTE_BASE_VALUE,
  destreza: ATTRIBUTE_BASE_VALUE,
  vigor: ATTRIBUTE_BASE_VALUE,
  inteligencia: ATTRIBUTE_BASE_VALUE,
  empatia: ATTRIBUTE_BASE_VALUE,
};

function getInitialWizardData(campaignId: string | null): WizardData {
  return {
    name: "",
    description: "",
    imageUrl: null,
    raceId: null,
    classId: null,
    attributes: { ...DEFAULT_ATTRIBUTES },
    skills: [],
    spells: [],
    campaignId,
  };
}

// =============================================================================
// Main Wizard Component
// =============================================================================

export function CharacterWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(() => getInitialWizardData(campaignId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: "error" | "success" | "info" | "warning" }>>([]);
  const [hydrated, setHydrated] = useState(false);

  // Clear legacy localStorage draft if present
  useEffect(() => {
    try {
      localStorage.removeItem("libmork_character_wizard_draft");
    } catch {
      // ignore
    }
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<WizardData>;
        setWizardData((prev) => ({
          ...prev,
          ...parsed,
          campaignId: campaignId ?? parsed.campaignId ?? null,
        }));
      }
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
  }, [campaignId]);

  // Persist to localStorage on changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    } catch {
      // Ignore quota errors
    }
  }, [wizardData, hydrated]);

  const addToast = useCallback((message: string, type: "error" | "success" | "info" | "warning" = "error") => {
    const id = generateUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  }, []);

  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0: // Básico
        if (!wizardData.name || wizardData.name.trim().length < 2) {
          addToast("Nome deve ter no mínimo 2 caracteres.", "warning");
          return false;
        }
        if (wizardData.name.length > 100) {
          addToast("Nome deve ter no máximo 100 caracteres.", "warning");
          return false;
        }
        return true;
      case 1: // Raça — opcional
        return true;
      case 2: // Classe — opcional
        return true;
      case 3: { // Atributos
        const sum = ATTRIBUTES.reduce((acc, attr) => acc + wizardData.attributes[attr], 0);
        if (sum !== ATTRIBUTE_CREATION_TOTAL) {
          addToast(`Distribua todos os pontos de atributo. Soma atual: ${sum}, esperado: ${ATTRIBUTE_CREATION_TOTAL}.`, "warning");
          return false;
        }
        return true;
      }
      case 4: // Perícias
        return true;
      case 5: // Magias
        return true;
      case 6: // Revisão
        return true;
      default:
        return true;
    }
  }, [wizardData, addToast]);

  const goNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [currentStep, validateStep]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) return;
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: wizardData.name.trim(),
        attributes: wizardData.attributes,
      };

      if (wizardData.description?.trim()) {
        payload.description = wizardData.description.trim();
      }
      if (wizardData.imageUrl) payload.imageUrl = wizardData.imageUrl;
      if (wizardData.raceId) payload.raceId = wizardData.raceId;
      if (wizardData.classId) payload.classId = wizardData.classId;
      if (wizardData.campaignId) payload.campaignId = wizardData.campaignId;
      if (wizardData.skills.length > 0) payload.skills = wizardData.skills;
      if (wizardData.spells.length > 0) payload.spells = wizardData.spells;

      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        addToast(data.error || "Erro ao criar personagem.", "error");
        return;
      }

      // Limpar draft do localStorage
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

      addToast("Personagem criado com sucesso!", "success");
      router.push(`/player/characters/${data.data.id}`);
    } catch {
      addToast("Erro de conexão. Tente novamente.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [wizardData, currentStep, validateStep, addToast, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8">
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}

      {/* Título */}
      <h2 className="mb-6 text-2xl font-bold text-white">Criar Personagem</h2>

      {/* Stepper (7 Etapas) */}
      <WizardStepper currentStep={currentStep} onStepClick={setCurrentStep} wizardData={wizardData} validateStep={validateStep} />

      {/* Conteúdo da Etapa */}
      <div className="mt-6">
        {currentStep === 0 && (
          <WizardStepBasicInfo data={wizardData} updateData={updateData} />
        )}
        {currentStep === 1 && (
          <WizardStepRace data={wizardData} updateData={updateData} />
        )}
        {currentStep === 2 && (
          <WizardStepClass data={wizardData} updateData={updateData} />
        )}
        {currentStep === 3 && (
          <WizardStepAttributes data={wizardData} updateData={updateData} />
        )}
        {currentStep === 4 && (
          <WizardStepSkills data={wizardData} updateData={updateData} />
        )}
        {currentStep === 5 && (
          <WizardStepSpells data={wizardData} updateData={updateData} />
        )}
        {currentStep === 6 && (
          <WizardStepReview data={wizardData} />
        )}
      </div>

      {/* Navegação */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          onClick={goBack}
          disabled={currentStep === 0 || isSubmitting}
          className="min-w-[100px]"
        >
          Voltar
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={isSubmitting} className="min-w-[100px]">
            Próximo
          </Button>
        ) : (
          <Button onClick={handleSubmit} isLoading={isSubmitting} className="min-w-[160px]">
            Criar Personagem
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Stepper (7 passos)
// =============================================================================

function WizardStepper({
  currentStep,
  onStepClick,
  wizardData,
  validateStep,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
  wizardData: WizardData;
  validateStep: (step: number) => boolean;
}) {
  const completedSteps = useMemo(() => {
    const completed = new Set<number>();
    if (wizardData.name.trim().length >= 2) completed.add(0);
    for (let i = 1; i <= 5; i++) {
      if (currentStep > i) completed.add(i);
    }
    return completed;
  }, [wizardData.name, currentStep]);

  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = completedSteps.has(idx) && !isActive;

        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (idx < currentStep) {
                onStepClick(idx);
              } else if (idx > currentStep) {
                let canAdvance = true;
                for (let s = currentStep; s < idx; s++) {
                  if (!validateStep(s)) {
                    canAdvance = false;
                    break;
                  }
                }
                if (canAdvance) onStepClick(idx);
              }
            }}
            className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all duration-200 ${
              isActive
                ? "scale-105"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                  : isCompleted
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}
            >
              {isCompleted ? "✓" : idx + 1}
            </span>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                isActive ? "text-purple-300 font-bold" : isCompleted ? "text-green-400" : "text-gray-400"
              }`}
            >
              {step.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Step 0: Básico
// =============================================================================

function WizardStepBasicInfo({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <h3 className="text-lg font-semibold text-white">Informações Básicas</h3>
      <p className="text-xs text-gray-400">
        Defina o nome, histórico e imagem do seu herói.
      </p>

      <Input
        label="Nome do Personagem *"
        name="wizard-name"
        type="text"
        value={data.name}
        onChange={(e) => updateData({ name: e.target.value })}
        required
        placeholder="Ex: Gandalf, Thorin, Lyra..."
        autoComplete="off"
        className="bg-gray-900 text-white"
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          Descrição / Background (opcional)
        </label>
        <textarea
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="Um breve histórico, personalidade ou aparência..."
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
        <span className="text-[10px] text-gray-500">{data.description.length}/500 caracteres</span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          URL da Imagem / Avatar (opcional)
        </label>
        <Input
          label=""
          name="wizard-image-url"
          type="url"
          value={data.imageUrl ?? ""}
          onChange={(e) => updateData({ imageUrl: e.target.value || null })}
          placeholder="https://exemplo.com/minha-foto.png"
          className="bg-gray-900 text-white"
        />
        {data.imageUrl && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-gray-400">Preview:</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt="Preview"
              className="h-12 w-12 rounded-full border border-purple-500 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Step 1: Raça
// =============================================================================

function WizardStepRace({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [races, setRaces] = useState<RaceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRaces() {
      try {
        const res = await fetch("/api/races", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) {
          setRaces(json.data);
        }
      } catch {
        // Ignora erro
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadRaces();
    return () => { cancelled = true; };
  }, []);

  const filteredRaces = useMemo(() => {
    if (!search.trim()) return races;
    const q = search.toLowerCase();
    return races.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q))
    );
  }, [races, search]);

  const selectedRace = useMemo(
    () => races.find((r) => r.id === data.raceId),
    [races, data.raceId]
  );

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Escolha a Raça</h3>
          <p className="text-xs text-gray-400">
            A raça define traços, velocidade e bônus de vida inicial.
          </p>
        </div>
        {data.raceId && (
          <button
            type="button"
            onClick={() => updateData({ raceId: null })}
            className="text-xs text-purple-400 hover:underline"
          >
            Limpar seleção
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Buscar raça por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
      />

      {isLoading ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : filteredRaces.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">Nenhuma raça encontrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredRaces.map((race) => {
            const isSelected = data.raceId === race.id;
            return (
              <div
                key={race.id}
                onClick={() => updateData({ raceId: isSelected ? null : race.id })}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/50"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-sm">{race.name}</h4>
                  {isSelected && (
                    <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Selecionada
                    </span>
                  )}
                </div>

                {race.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">{race.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  {race.hitPointsBonus > 0 && (
                    <span className="rounded bg-red-950 border border-red-800/60 px-1.5 py-0.5 text-red-300 font-semibold">
                      +{race.hitPointsBonus} HP
                    </span>
                  )}
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                    Desloc: {race.speed}ft
                  </span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                    Tamanho: {race.size}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRace && (
        <div className="mt-4 rounded-lg border border-purple-800/50 bg-purple-950/30 p-3 text-xs text-purple-200">
          <span className="font-bold text-purple-300">Bônus da Raça selecionada ({selectedRace.name}):</span>{" "}
          +{selectedRace.hitPointsBonus} HP base máximo.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 2: Classe
// =============================================================================

function WizardStepClass({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) {
          setClasses(json.data);
        }
      } catch {
        // Ignora erro
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadClasses();
    return () => { cancelled = true; };
  }, []);

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
    );
  }, [classes, search]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === data.classId),
    [classes, data.classId]
  );

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Escolha a Classe</h3>
          <p className="text-xs text-gray-400">
            A classe determina seu treinamento em combate, magia e equipamentos iniciais.
          </p>
        </div>
        {data.classId && (
          <button
            type="button"
            onClick={() => updateData({ classId: null })}
            className="text-xs text-purple-400 hover:underline"
          >
            Limpar seleção
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Buscar classe por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
      />

      {isLoading ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">Nenhuma classe cadastrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredClasses.map((cls) => {
            const isSelected = data.classId === cls.id;
            return (
              <div
                key={cls.id}
                onClick={() => updateData({ classId: isSelected ? null : cls.id })}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/50"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-sm">{cls.name}</h4>
                  {isSelected && (
                    <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Selecionada
                    </span>
                  )}
                </div>

                {cls.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">{cls.description}</p>
                )}

                {cls.initialItems && cls.initialItems.length > 0 && (
                  <div className="mt-2 text-[10px] text-gray-400">
                    <span className="font-semibold text-purple-300">Equipamentos da classe:</span>{" "}
                    {cls.initialItems.map((i) => i.name).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedClass && (
        <div className="mt-4 rounded-lg border border-purple-800/50 bg-purple-950/30 p-3 text-xs text-purple-200">
          <span className="font-bold text-purple-300">Classe Selecionada: {selectedClass.name}</span>. Os itens iniciais desta classe serão concedidos automaticamente ao inventário!
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 3: Atributos
// =============================================================================

function WizardStepAttributes({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const spentPoints = useMemo(
    () => ATTRIBUTES.reduce((sum, attr) => sum + (data.attributes[attr] - ATTRIBUTE_BASE_VALUE), 0),
    [data.attributes]
  );

  const remainingPoints = ATTRIBUTE_FREE_POINTS - spentPoints;

  const handleIncrement = (attr: Attribute) => {
    if (remainingPoints <= 0) return;
    updateData({
      attributes: {
        ...data.attributes,
        [attr]: data.attributes[attr] + 1,
      },
    });
  };

  const handleDecrement = (attr: Attribute) => {
    if (data.attributes[attr] <= ATTRIBUTE_BASE_VALUE) return;
    updateData({
      attributes: {
        ...data.attributes,
        [attr]: data.attributes[attr] - 1,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Distribuição de Atributos</h3>
          <p className="text-xs text-gray-400">
            Cada atributo começa em 8. Distribua os 8 pontos livres disponíveis.
          </p>
        </div>
        <span
          className={`text-xs font-bold rounded-lg px-2.5 py-1 ${
            remainingPoints === 0
              ? "bg-green-950 border border-green-800 text-green-400"
              : "bg-yellow-950 border border-yellow-800 text-yellow-400"
          }`}
        >
          {remainingPoints} ponto(s) restante(s)
        </span>
      </div>

      <div className="space-y-2.5">
        {ATTRIBUTES.map((attr) => {
          const val = data.attributes[attr];
          const mod = getModifier(val);
          return (
            <div
              key={attr}
              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            >
              <div>
                <span className="text-sm font-semibold text-white">
                  {ATTRIBUTE_LABELS[attr]}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  mod {mod >= 0 ? `+${mod}` : mod}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDecrement(attr)}
                  disabled={val <= ATTRIBUTE_BASE_VALUE}
                  className="h-8 w-8 rounded-lg bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-base text-white">{val}</span>
                <button
                  type="button"
                  onClick={() => handleIncrement(attr)}
                  disabled={remainingPoints <= 0}
                  className="h-8 w-8 rounded-lg bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Step 4: Perícias Treinadas (NOVO)
// =============================================================================

function WizardStepSkills({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Buscar lista de perícias da biblioteca
  useEffect(() => {
    let cancelled = false;
    async function loadSkills() {
      try {
        const res = await fetch("/api/content/skills", { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && Array.isArray(json.data)) {
            setSkills(json.data);
          }
        }
      } catch {
        // Ignora erro
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadSkills();
    return () => { cancelled = true; };
  }, []);

  // Vagas de Perícia Treinada (Inteligência ÷ 2, arredondado para baixo)
  const baseSlots = Math.max(0, Math.floor(data.attributes.inteligencia / 2));
  // Mínimo de 1 slot garantido para o herói
  const maxSlots = Math.max(1, baseSlots);
  const selectedCount = data.skills.length;

  const toggleSkill = (skillId: string) => {
    if (data.skills.includes(skillId)) {
      updateData({ skills: data.skills.filter((id) => id !== skillId) });
    } else {
      if (selectedCount >= maxSlots) return;
      updateData({ skills: [...data.skills, skillId] });
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Perícias Treinadas</h3>
          <p className="text-xs text-gray-400">
            Sua Inteligência ({data.attributes.inteligencia}) concede vagas de Perícias Treinadas.
          </p>
        </div>

        <span
          className={`text-xs font-bold rounded-lg px-2.5 py-1 ${
            selectedCount === maxSlots
              ? "bg-green-950 border border-green-800 text-green-400"
              : "bg-purple-950 border border-purple-800 text-purple-300"
          }`}
        >
          {selectedCount} / {maxSlots} selecionada(s)
        </span>
      </div>

      {isLoading ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : skills.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">Nenhuma perícia cadastrada na biblioteca.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill) => {
            const isSelected = data.skills.includes(skill.id);
            const isDisabled = !isSelected && selectedCount >= maxSlots;

            return (
              <div
                key={skill.id}
                onClick={() => !isDisabled && toggleSkill(skill.id)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                  isDisabled ? "opacity-40 cursor-not-allowed border-gray-800 bg-gray-950" : "cursor-pointer"
                } ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-md shadow-purple-950/40"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  disabled={isDisabled}
                  className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs truncate">{skill.name}</h4>
                    <span className="rounded bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.5 text-[9px] text-purple-300 font-bold uppercase">
                      {ATTRIBUTE_LABELS[skill.keyAttribute]}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">{skill.description}</p>
                  )}
                  {skill.rollExpression && (
                    <span className="mt-1 inline-block text-[10px] text-purple-400 font-mono">
                      {skill.rollExpression}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 5: Magias & Habilidades
// =============================================================================

function WizardStepSpells({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [spells, setSpells] = useState<SpellData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSpells() {
      try {
        const res = await fetch("/api/content/spells", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) {
          setSpells(json.data);
        }
      } catch {
        // Ignora erro
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadSpells();
    return () => { cancelled = true; };
  }, []);

  // No nível 1, apenas magias de Círculo 1
  const level1Spells = useMemo(() => spells.filter((s) => s.circle === 1), [spells]);
  const maxSpells = 3;
  const selectedCount = data.spells.length;

  const toggleSpell = (spellId: string) => {
    if (data.spells.includes(spellId)) {
      updateData({ spells: data.spells.filter((id) => id !== spellId) });
    } else {
      if (selectedCount >= maxSpells) return;
      updateData({ spells: [...data.spells, spellId] });
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Magias & Habilidades (1º Círculo)</h3>
          <p className="text-xs text-gray-400">
            No Nível 1, escolha até {maxSpells} magias do 1º Círculo.
          </p>
        </div>

        <span
          className={`text-xs font-bold rounded-lg px-2.5 py-1 ${
            selectedCount === maxSpells
              ? "bg-green-950 border border-green-800 text-green-400"
              : "bg-purple-950 border border-purple-800 text-purple-300"
          }`}
        >
          {selectedCount} / {maxSpells} selecionada(s)
        </span>
      </div>

      {isLoading ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : level1Spells.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">Nenhuma magia de 1º Círculo encontrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {level1Spells.map((spell) => {
            const isSelected = data.spells.includes(spell.id);
            const isDisabled = !isSelected && selectedCount >= maxSpells;
            const actionCost = SPELL_ACTION_COST_BY_CIRCLE[spell.circle] ?? 1;

            return (
              <div
                key={spell.id}
                onClick={() => !isDisabled && toggleSpell(spell.id)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                  isDisabled ? "opacity-40 cursor-not-allowed border-gray-800 bg-gray-950" : "cursor-pointer"
                } ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-md shadow-purple-950/40"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  disabled={isDisabled}
                  className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs truncate">{spell.name}</h4>
                    <span className="rounded bg-blue-950 border border-blue-800/60 px-1.5 py-0.5 text-[9px] text-blue-300 font-bold">
                      {spell.manaCost} MP
                    </span>
                  </div>

                  {spell.description && (
                    <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">{spell.description}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                    <span>⚡ {actionCost} ação(ões)</span>
                    {spell.useType && <span className="capitalize">• {spell.useType}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 6: Revisão & Confirmação
// =============================================================================

function WizardStepReview({ data }: { data: WizardData }) {
  const [raceName, setRaceName] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [initialItemsList, setInitialItemsList] = useState<Array<{ name: string; quantity: number }>>([]);
  const [raceHpBonus, setRaceHpBonus] = useState(0);

  useEffect(() => {
    async function loadInfo() {
      if (data.raceId) {
        try {
          const res = await fetch("/api/races", { credentials: "include" });
          if (res.ok) {
            const json = await res.json();
            const found = (json.data || []).find((r: RaceData) => r.id === data.raceId);
            if (found) {
              setRaceName(found.name);
              setRaceHpBonus(found.hitPointsBonus || 0);
            }
          }
        } catch { /* ignore */ }
      }
      if (data.classId) {
        try {
          const res = await fetch("/api/classes", { credentials: "include" });
          if (res.ok) {
            const json = await res.json();
            const found = (json.data || []).find((c: ClassData) => c.id === data.classId);
            if (found) {
              setClassName(found.name);
              if (found.initialItems) {
                setInitialItemsList(found.initialItems);
              }
            }
          }
        } catch { /* ignore */ }
      }
    }
    void loadInfo();
  }, [data.raceId, data.classId]);

  const derived = useMemo(
    () => getDerivedStats(data.attributes, 1),
    [data.attributes]
  );

  const totalHpMax = derived.hitPointsMax + raceHpBonus;

  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <h3 className="text-lg font-semibold text-white">Revisão do Personagem</h3>
      <p className="text-xs text-gray-400">
        Confira todas as estatísticas e seleções antes de criar o herói.
      </p>

      {/* Resumo do Personagem */}
      <div className="flex items-center gap-4 rounded-xl border border-purple-900/60 bg-purple-950/30 p-4">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUrl}
            alt={data.name}
            className="h-16 w-16 rounded-full border-2 border-purple-500 object-cover shrink-0"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-500 bg-purple-900 text-xl font-bold text-white shrink-0">
            {data.name.slice(0, 2).toUpperCase() || "??"}
          </div>
        )}
        <div>
          <h4 className="text-xl font-bold text-white">{data.name || "Sem Nome"}</h4>
          <p className="text-xs text-purple-300">
            {raceName || "Sem Raça"} • {className || "Sem Classe"} • Nível 1
          </p>
          {data.description && (
            <p className="mt-1 text-xs text-gray-400 line-clamp-2">{data.description}</p>
          )}
        </div>
      </div>

      {/* Atributos e Estatísticas Derivadas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h5 className="mb-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
            Atributos Principais
          </h5>
          <div className="space-y-1 text-xs">
            {ATTRIBUTES.map((attr) => {
              const val = data.attributes[attr];
              const mod = derived.modifiers[attr];
              return (
                <div key={attr} className="flex justify-between border-b border-gray-800/50 py-1">
                  <span className="text-gray-300">{ATTRIBUTE_LABELS[attr]}:</span>
                  <span className="font-bold text-white">
                    {val} (mod {mod >= 0 ? `+${mod}` : mod})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h5 className="mb-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
            Estatísticas Derivadas (Nível 1)
          </h5>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between border-b border-gray-800/50 py-1">
              <span className="text-gray-300">Vida Máxima (HP):</span>
              <span className="font-bold text-red-400">{totalHpMax} HP</span>
            </div>
            <div className="flex justify-between border-b border-gray-800/50 py-1">
              <span className="text-gray-300">Mana Máxima (MP):</span>
              <span className="font-bold text-blue-400">{derived.manaPointsMax} MP</span>
            </div>
            <div className="flex justify-between border-b border-gray-800/50 py-1">
              <span className="text-gray-300">Bloqueio Tático:</span>
              <span className="font-bold text-white">{derived.block}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-300">Perícias Treinadas Selecionadas:</span>
              <span className="font-bold text-purple-300">{data.skills.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Itens Iniciais Concedidos pela Classe */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h5 className="mb-2 text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <span>🎒 Itens Iniciais da Classe (Concedidos Automáticos)</span>
        </h5>
        {initialItemsList.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Nenhum item inicial padrão para a classe selecionada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {initialItemsList.map((item, idx) => (
              <span
                key={idx}
                className="rounded-lg bg-purple-950/80 border border-purple-800/60 px-2.5 py-1 text-xs font-semibold text-purple-200"
              >
                {item.quantity}x {item.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
