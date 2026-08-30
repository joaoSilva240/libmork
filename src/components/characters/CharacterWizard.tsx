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
import type { AttributeMap } from "@/lib/engine/attributes";
import { Button, Input, Spinner } from "@/components/ui";
import { Toast } from "@/components/ui/Toast";
import { generateUUID } from "@/lib/utils/uuid";
import type { ClassLevelBenefit } from "@/types";

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
  items: Array<{ itemId: string; quantity: number }>;
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

type ItemData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
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

const STORAGE_KEY = "libmork_character_wizard_draft";

const STEPS = [
  { label: "Básico", shortLabel: "Básico" },
  { label: "Raça", shortLabel: "Raça" },
  { label: "Classe", shortLabel: "Classe" },
  { label: "Atributos & Itens", shortLabel: "Atrib." },
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
    items: [],
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
      case 0: // Basic Info
        if (!wizardData.name || wizardData.name.trim().length < 2) {
          addToast("Nome deve ter no mínimo 2 caracteres.", "warning");
          return false;
        }
        if (wizardData.name.length > 100) {
          addToast("Nome deve ter no máximo 100 caracteres.", "warning");
          return false;
        }
        return true;
      case 1: // Race — optional
        return true;
      case 2: // Class — optional
        return true;
      case 3: { // Attributes + Items
        const sum = ATTRIBUTES.reduce((acc, attr) => acc + wizardData.attributes[attr], 0);
        if (sum !== ATTRIBUTE_CREATION_TOTAL) {
          addToast(`Distribua todos os pontos de atributo. Soma atual: ${sum}, esperado: ${ATTRIBUTE_CREATION_TOTAL}.`, "warning");
          return false;
        }
        return true;
      }
      case 4: // Spells — optional
        return true;
      case 5: // Review
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
      if (wizardData.items.length > 0) payload.items = wizardData.items;
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

      // Clear draft
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
      {/* Toast container */}
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

      {/* Header */}
      <h2 className="mb-6 text-2xl font-bold text-white">Criar Personagem</h2>

      {/* Stepper */}
      <WizardStepper currentStep={currentStep} onStepClick={setCurrentStep} wizardData={wizardData} validateStep={validateStep} />

      {/* Step content */}
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
          <WizardStepItems data={wizardData} updateData={updateData} />
        )}
        {currentStep === 4 && (
          <WizardStepSpells data={wizardData} updateData={updateData} />
        )}
        {currentStep === 5 && (
          <WizardStepReview data={wizardData} />
        )}
      </div>

      {/* Navigation */}
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
// Stepper
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
    for (let i = 1; i <= 4; i++) {
      if (currentStep > i) completed.add(i);
    }
    return completed;
  }, [wizardData.name, currentStep]);

  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto">
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
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
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
                isActive ? "text-purple-400" : isCompleted ? "text-green-400" : "text-gray-500"
              }`}
            >
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.shortLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Step 1: Basic Info
// =============================================================================

function WizardStepBasicInfo({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Informações Básicas</h3>
      <p className="text-sm text-gray-400">Dê um nome ao seu personagem e adicione detalhes opcionais.</p>

      <Input
        label="Nome *"
        name="name"
        type="text"
        value={data.name}
        onChange={(e) => updateData({ name: e.target.value })}
        placeholder="Ex: Aragorn, Gandalf..."
        autoComplete="off"
        maxLength={100}
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Descrição (opcional)
        </label>
        <textarea
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="Backstory, aparência, personalidade..."
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
        />
        <p className="mt-1 text-xs text-gray-500">
          {data.description.length}/500 caracteres
        </p>
      </div>

      <Input
        label="URL da Imagem (opcional)"
        name="imageUrl"
        type="url"
        value={data.imageUrl || ""}
        onChange={(e) => updateData({ imageUrl: e.target.value || null })}
        placeholder="https://exemplo.com/imagem.png"
      />

      {data.imageUrl && (
        <div className="flex justify-center">
          <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt="Preview"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 2: Race Selection
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
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setRaces(json.data);
        }
      } catch {
        // Ignore errors
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
    return races.filter((r) => r.name.toLowerCase().includes(q));
  }, [races, search]);

  const selectedRace = useMemo(() => races.find((r) => r.id === data.raceId), [races, data.raceId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Escolha uma Raça</h3>
      <p className="text-sm text-gray-400">Selecione a raça do seu personagem. Este passo é opcional.</p>

      {races.length > 0 && (
        <Input
          placeholder="Buscar raça..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {data.raceId && (
        <button
          type="button"
          onClick={() => updateData({ raceId: null })}
          className="text-xs text-purple-400 hover:text-purple-300 underline"
        >
          Limpar seleção
        </button>
      )}

      {races.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma raça cadastrada na biblioteca.</p>
      ) : filteredRaces.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma raça encontrada para &quot;{search}&quot;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredRaces.map((race) => {
            const isSelected = data.raceId === race.id;
            return (
              <button
                key={race.id}
                type="button"
                onClick={() => updateData({ raceId: isSelected ? null : race.id })}
                className={`rounded-lg border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-[0_0_12px_rgba(147,51,234,0.15)]"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  {race.imageUrl && (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={race.imageUrl} alt={race.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white text-sm">{race.name}</h4>
                    {race.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{race.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {race.hitPointsBonus !== 0 && (
                        <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                          HP {race.hitPointsBonus > 0 ? "+" : ""}{race.hitPointsBonus}
                        </span>
                      )}
                      <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                        Vel. {race.speed}
                      </span>
                      {Object.entries(race.attributeBonuses || {}).map(([attr, val]) => (
                        <span
                          key={attr}
                          className="rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] font-medium text-purple-300"
                        >
                          {ATTRIBUTE_LABELS[attr as Attribute] || attr} {val > 0 ? "+" : ""}{val}
                        </span>
                      ))}
                    </div>
                    {race.traits && race.traits.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {race.traits.map((trait, i) => (
                          <span key={i} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">
                            {trait.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Impact preview */}
      {selectedRace && (
        <div className="rounded-lg border border-purple-800/60 bg-purple-950/30 p-3">
          <h4 className="text-xs font-semibold text-purple-300 mb-2">Impacto da raça selecionada</h4>
          <div className="flex flex-wrap gap-2 text-xs text-gray-300">
            {selectedRace.hitPointsBonus !== 0 && (
              <span>HP: {selectedRace.hitPointsBonus > 0 ? "+" : ""}{selectedRace.hitPointsBonus}</span>
            )}
            {Object.entries(selectedRace.attributeBonuses || {}).map(([attr, val]) => (
              <span key={attr}>
                {ATTRIBUTE_LABELS[attr as Attribute] || attr}: {val > 0 ? "+" : ""}{val}
              </span>
            ))}
            {selectedRace.languages && selectedRace.languages.length > 0 && (
              <span>Idiomas: {(selectedRace.languages as string[]).join(", ")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 3: Class Selection
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

  useEffect(() => {
    let cancelled = false;
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setClasses(json.data);
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadClasses();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Escolha uma Classe</h3>
      <p className="text-sm text-gray-400">Selecione a classe do seu personagem. Este passo é opcional.</p>

      {data.classId && (
        <button
          type="button"
          onClick={() => updateData({ classId: null })}
          className="text-xs text-purple-400 hover:text-purple-300 underline"
        >
          Limpar seleção
        </button>
      )}

      {classes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma classe cadastrada na biblioteca.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {classes.map((cls) => {
            const isSelected = data.classId === cls.id;
            const profs = cls.proficiencies || {};
            const allProfs = [
              ...(profs.weapons || []),
              ...(profs.armor || []),
              ...(profs.tools || []),
            ];

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => updateData({ classId: isSelected ? null : cls.id })}
                className={`rounded-lg border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/40 shadow-[0_0_12px_rgba(147,51,234,0.15)]"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <h4 className="font-semibold text-white text-sm">{cls.name}</h4>
                {cls.description && (
                  <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{cls.description}</p>
                )}

                {allProfs.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">Proficiências</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {allProfs.slice(0, 6).map((p, i) => (
                        <span key={i} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">
                          {p}
                        </span>
                      ))}
                      {allProfs.length > 6 && (
                        <span className="text-[10px] text-gray-500">+{allProfs.length - 6}</span>
                      )}
                    </div>
                  </div>
                )}

                {cls.initialItems && cls.initialItems.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">Itens Iniciais</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {cls.initialItems.slice(0, 4).map((item, i) => (
                        <span key={i} className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                          {item.name} ×{item.quantity}
                        </span>
                      ))}
                      {cls.initialItems.length > 4 && (
                        <span className="text-[10px] text-gray-500">+{cls.initialItems.length - 4}</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 4: Attributes + Items
// =============================================================================

function WizardStepItems({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [selectedRace, setSelectedRace] = useState<RaceData | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);

  // Load race info for attribute bonuses display
  useEffect(() => {
    if (!data.raceId) {
      setSelectedRace(null);
      return;
    }
    let cancelled = false;
    async function loadRace() {
      try {
        const res = await fetch("/api/races", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const found = json.data.find((r: RaceData) => r.id === data.raceId);
          if (found) setSelectedRace(found);
        }
      } catch {
        // Ignore
      }
    }
    void loadRace();
    return () => { cancelled = true; };
  }, [data.raceId]);

  // Load class info for initial items auto-selection
  useEffect(() => {
    if (!data.classId) {
      setSelectedClass(null);
      return;
    }
    let cancelled = false;
    async function loadClass() {
      try {
        const res = await fetch("/api/classes", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const found = json.data.find((c: ClassData) => c.id === data.classId);
          if (found) setSelectedClass(found);
        }
      } catch {
        // Ignore
      }
    }
    void loadClass();
    return () => { cancelled = true; };
  }, [data.classId]);

  // Load items
  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      try {
        const res = await fetch("/api/content/items", { credentials: "include" });
        if (!res.ok) {
          setIsLoadingItems(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setItems(json.data);
        }
      } catch {
        // Endpoint may not exist — use empty
      } finally {
        if (!cancelled) setIsLoadingItems(false);
      }
    }
    void loadItems();
    return () => { cancelled = true; };
  }, []);

  // Auto pre-select initial items when items and selectedClass are available
  useEffect(() => {
    if (!selectedClass || !selectedClass.initialItems || selectedClass.initialItems.length === 0) {
      return;
    }

    const itemsToAdd: Array<{ itemId: string; quantity: number }> = [];

    for (const initItem of selectedClass.initialItems) {
      let matchedGlobalItem: ItemData | undefined;

      if (initItem.item_id) {
        matchedGlobalItem = items.find((i) => i.id === initItem.item_id);
      }
      if (!matchedGlobalItem && initItem.name) {
        const normName = initItem.name.toLowerCase().trim();
        matchedGlobalItem = items.find((i) => i.name.toLowerCase().trim() === normName);
      }

      if (matchedGlobalItem) {
        const itemId = matchedGlobalItem.id;
        const alreadyInWizard = data.items.some((i) => i.itemId === itemId);
        if (!alreadyInWizard) {
          itemsToAdd.push({ itemId, quantity: initItem.quantity || 1 });
        }
      }
    }

    if (itemsToAdd.length > 0) {
      updateData({ items: [...data.items, ...itemsToAdd] });
    }
  }, [selectedClass, items, data.items, updateData]);

  const spentPoints = useMemo(
    () => ATTRIBUTES.reduce((sum, attr) => sum + (data.attributes[attr] - ATTRIBUTE_BASE_VALUE), 0),
    [data.attributes],
  );
  const remainingPoints = ATTRIBUTE_FREE_POINTS - spentPoints;

  const handleIncrement = (attr: Attribute) => {
    if (remainingPoints <= 0) return;
    updateData({
      attributes: { ...data.attributes, [attr]: data.attributes[attr] + 1 },
    });
  };

  const handleDecrement = (attr: Attribute) => {
    if (data.attributes[attr] <= ATTRIBUTE_BASE_VALUE) return;
    updateData({
      attributes: { ...data.attributes, [attr]: data.attributes[attr] - 1 },
    });
  };

  const toggleItem = (itemId: string) => {
    const existing = data.items.find((i) => i.itemId === itemId);
    if (existing) {
      updateData({ items: data.items.filter((i) => i.itemId !== itemId) });
    } else {
      updateData({ items: [...data.items, { itemId, quantity: 1 }] });
    }
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    updateData({
      items: data.items.map((i) => (i.itemId === itemId ? { ...i, quantity } : i)),
    });
  };

  const raceBonuses = selectedRace?.attributeBonuses || {};

  return (
    <div className="space-y-6">
      {/* Attributes section */}
      <div>
        <h3 className="text-lg font-semibold text-white">Distribuição de Atributos</h3>
        <p className="text-sm text-gray-400 mt-1">
          Base {ATTRIBUTE_BASE_VALUE} por atributo + {ATTRIBUTE_FREE_POINTS} pontos livres para distribuir.
        </p>

        <div className="mt-3 mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-300">Pontos livres</span>
          <span
            className={`text-sm font-bold ${
              remainingPoints === 0 ? "text-green-400" : "text-yellow-400"
            }`}
          >
            {remainingPoints} restante(s)
          </span>
        </div>

        <div className="space-y-2">
          {ATTRIBUTES.map((attr) => {
            const raceBonus = (raceBonuses[attr] as number) || 0;
            const effectiveValue = data.attributes[attr] + raceBonus;
            const mod = getModifier(effectiveValue);

            return (
              <div
                key={attr}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {ATTRIBUTE_LABELS[attr]}
                  </span>
                  {raceBonus !== 0 && (
                    <span className="text-[10px] text-purple-400">
                      (+{raceBonus} racial)
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    mod {mod >= 0 ? "+" : ""}{mod}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecrement(attr)}
                    disabled={data.attributes[attr] <= ATTRIBUTE_BASE_VALUE}
                    className="h-8 w-8 rounded bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold text-white">
                    {data.attributes[attr]}
                    {raceBonus !== 0 && (
                      <span className="text-[10px] text-purple-400 ml-0.5">({effectiveValue})</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleIncrement(attr)}
                    disabled={remainingPoints <= 0}
                    className="h-8 w-8 rounded bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items section */}
      <div>
        <h3 className="text-lg font-semibold text-white">Seleção de Itens</h3>
        <p className="text-sm text-gray-400 mt-1">Escolha itens iniciais para o seu personagem (opcional).</p>

        {selectedClass && selectedClass.initialItems && selectedClass.initialItems.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3">
            <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 mb-1.5">
              <span>🎒</span>
              <span>Itens Iniciais da sua Classe (Pré-selecionados)</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedClass.initialItems.map((initItem, idx) => (
                <span
                  key={idx}
                  className="rounded bg-amber-900/50 border border-amber-700/50 px-2 py-0.5 text-xs text-amber-200 font-medium"
                >
                  {initItem.name} ×{initItem.quantity}
                </span>
              ))}
            </div>
          </div>
        )}

        {isLoadingItems ? (
          <div className="flex min-h-[100px] items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nenhum item disponível na biblioteca global.</p>
        ) : (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
            {items.map((item) => {
              const selected = data.items.find((i) => i.itemId === item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all duration-200 ${
                    selected
                      ? "border-purple-600 bg-purple-950/30"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 rounded border-gray-600 accent-purple-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                    )}
                  </div>
                  {selected && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Qtd:</span>
                      <input
                        type="number"
                        min={1}
                        value={selected.quantity}
                        onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-14 rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-center text-sm text-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Step 5: Spells
// =============================================================================

function WizardStepSpells({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [spells, setSpells] = useState<SpellData[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classBenefits, setClassBenefits] = useState<Array<{ level: number; benefits: ClassLevelBenefit }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [circleFilter, setCircleFilter] = useState<number | null>(1); // Padrão: 1º Círculo no Nível 1

  // Load class info and level 1 benefits if classId is present
  useEffect(() => {
    if (!data.classId) {
      setSelectedClass(null);
      setClassBenefits([]);
      return;
    }
    let cancelled = false;
    async function loadClassData() {
      try {
        const [clsRes, benRes] = await Promise.allSettled([
          fetch("/api/classes", { credentials: "include" }),
          fetch(`/api/classes/${data.classId}/benefits`, { credentials: "include" }),
        ]);

        if (cancelled) return;

        if (clsRes.status === "fulfilled" && clsRes.value.ok) {
          const json = await clsRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            const found = json.data.find((c: ClassData) => c.id === data.classId);
            if (found) setSelectedClass(found);
          }
        }

        if (benRes.status === "fulfilled" && benRes.value.ok) {
          const json = await benRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            setClassBenefits(json.data);
          }
        }
      } catch {
        // Ignore
      }
    }
    void loadClassData();
    return () => { cancelled = true; };
  }, [data.classId]);

  // Determine if class is spellcaster (conjuradora)
  const isCaster = useMemo(() => {
    if (!data.classId) return false;
    // Check level 1 benefit for mana_bonus / manaBonus
    const lvl1Benefit = classBenefits.find((b) => b.level === 1);
    if (lvl1Benefit && lvl1Benefit.benefits) {
      const b = lvl1Benefit.benefits as Record<string, unknown>;
      if ((b.mana_bonus && Number(b.mana_bonus) > 0) || (b.manaBonus && Number(b.manaBonus) > 0)) {
        return true;
      }
    }
    // Also check derived mana points from attributes
    const derived = getDerivedStats(data.attributes, 1);
    return derived.manaPointsMax > 0;
  }, [data.classId, classBenefits, data.attributes]);

  const maxAllowedSpells = isCaster ? 3 : 1;

  useEffect(() => {
    let cancelled = false;
    async function loadSpells() {
      try {
        const res = await fetch("/api/content/spells", { credentials: "include" });
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setSpells(json.data);
        }
      } catch {
        // Endpoint may not exist — use empty
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadSpells();
    return () => { cancelled = true; };
  }, []);

  const availableCircles = useMemo(() => {
    const circles = new Set(spells.map((s) => s.circle));
    return Array.from(circles).sort((a, b) => a - b);
  }, [spells]);

  const filteredSpells = useMemo(() => {
    if (circleFilter === null) return spells;
    return spells.filter((s) => s.circle === circleFilter);
  }, [spells, circleFilter]);

  const toggleSpell = (spellId: string) => {
    const spell = spells.find((s) => s.id === spellId);
    if (!spell) return;

    // Apenas magias do 1º Círculo podem ser marcadas no Nível 1
    if (spell.circle > 1) return;

    if (data.spells.includes(spellId)) {
      updateData({ spells: data.spells.filter((id) => id !== spellId) });
    } else {
      if (data.spells.length >= maxAllowedSpells) {
        return;
      }
      updateData({ spells: [...data.spells, spellId] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Seleção de Magias</h3>
          <p className="text-sm text-gray-400">Escolha magias para o seu personagem (opcional).</p>
        </div>
        <div className="rounded-lg border border-purple-800/60 bg-purple-950/40 px-3 py-1.5 text-xs text-purple-300 font-medium">
          Magias selecionadas: <span className="font-bold text-white">{data.spells.length}</span> / {maxAllowedSpells} (Apenas 1º Círculo no Nível 1)
        </div>
      </div>

      {!isCaster && data.classId && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-300">
          ⚠️ Esta classe não é conjuradora no Nível 1. Você pode selecionar no máximo 1 magia/truque opcional.
        </div>
      )}

      {spells.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma magia disponível na biblioteca global.</p>
      ) : (
        <>
          {/* Circle filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCircleFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                circleFilter === null
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Todos
            </button>
            {availableCircles.map((c) => {
              const isLocked = c > 1;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCircleFilter(c === circleFilter ? null : c)}
                  className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    circleFilter === c
                      ? "bg-purple-600 text-white"
                      : isLocked
                        ? "bg-gray-900 text-gray-500 border border-gray-800"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {c}° Círculo
                  {isLocked && (
                    <span className="ml-1 text-[9px] text-amber-400 font-normal">
                      (Requer Nível superior)
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredSpells.map((spell) => {
              const isSelected = data.spells.includes(spell.id);
              const isLocked = spell.circle > 1;
              const actionCost = spell.circle ? (SPELL_ACTION_COST_BY_CIRCLE[spell.circle] ?? 1) : 1;
              const isMaxReached = !isSelected && data.spells.length >= maxAllowedSpells;

              return (
                <div
                  key={spell.id}
                  className={`flex items-start gap-3 rounded-lg border p-2.5 transition-all duration-200 ${
                    isSelected
                      ? "border-purple-600 bg-purple-950/30"
                      : isLocked
                        ? "border-gray-800/60 bg-gray-950/50 opacity-60"
                        : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isLocked || isMaxReached}
                    onChange={() => toggleSpell(spell.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-600 accent-purple-600 disabled:opacity-40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{spell.name}</span>
                      <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                        {spell.circle}° Círculo
                      </span>
                      {isLocked && (
                        <span className="rounded bg-amber-950 border border-amber-800/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          Disponível em Níveis Superiores
                        </span>
                      )}
                      <span className="rounded bg-indigo-900/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                        Mana: {spell.manaCost}
                      </span>
                      <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                        {actionCost} ação(ões)
                      </span>
                      {spell.useType && (
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">
                          {spell.useType}
                        </span>
                      )}
                    </div>
                    {spell.description && (
                      <p className="mt-1 text-xs text-gray-400 line-clamp-2">{spell.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Step 6: Review & Confirm
// =============================================================================

function WizardStepReview({ data }: { data: WizardData }) {
  const [races, setRaces] = useState<RaceData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [spellsList, setSpellsList] = useState<SpellData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [racesRes, classesRes, itemsRes, spellsRes] = await Promise.allSettled([
          fetch("/api/races", { credentials: "include" }),
          fetch("/api/classes", { credentials: "include" }),
          fetch("/api/content/items", { credentials: "include" }),
          fetch("/api/content/spells", { credentials: "include" }),
        ]);

        if (cancelled) return;

        if (racesRes.status === "fulfilled" && racesRes.value.ok) {
          const json = await racesRes.value.json();
          if (json.success) setRaces(json.data);
        }
        if (classesRes.status === "fulfilled" && classesRes.value.ok) {
          const json = await classesRes.value.json();
          if (json.success) setClasses(json.data);
        }
        if (itemsRes.status === "fulfilled" && itemsRes.value.ok) {
          const json = await itemsRes.value.json();
          if (json.success) setItems(json.data);
        }
        if (spellsRes.status === "fulfilled" && spellsRes.value.ok) {
          const json = await spellsRes.value.json();
          if (json.success) setSpellsList(json.data);
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, []);

  const selectedRace = useMemo(() => races.find((r) => r.id === data.raceId), [races, data.raceId]);
  const selectedClass = useMemo(() => classes.find((c) => c.id === data.classId), [classes, data.classId]);

  const raceBonuses = selectedRace?.attributeBonuses || {};
  const derived = useMemo(() => {
    const effectiveAttrs: Record<Attribute, number> = { ...data.attributes };
    for (const attr of ATTRIBUTES) {
      effectiveAttrs[attr] += (raceBonuses[attr] as number) || 0;
    }
    return getDerivedStats(effectiveAttrs, 1);
  }, [data.attributes, raceBonuses]);

  const selectedItemDetails = useMemo(() => {
    return data.items
      .map((i) => {
        const found = items.find((item) => item.id === i.itemId);
        return found ? { ...found, quantity: i.quantity } : null;
      })
      .filter((i): i is ItemData & { quantity: number } => i !== null);
  }, [data.items, items]);

  const selectedSpellDetails = useMemo(() => {
    return data.spells
      .map((id) => spellsList.find((s) => s.id === id))
      .filter((s): s is SpellData => s !== undefined);
  }, [data.spells, spellsList]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Revisão do Personagem</h3>

      {/* Basic summary */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
        <div className="flex items-center gap-4">
          {data.imageUrl ? (
            <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-700 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-bold text-xl shrink-0">
              {data.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h4 className="text-xl font-bold text-white">{data.name}</h4>
            <p className="text-sm text-gray-400">
              {selectedRace?.name || "Sem Raça"} · {selectedClass?.name || "Sem Classe"} · Nível 1
            </p>
          </div>
        </div>

        {data.description && (
          <p className="text-xs text-gray-300 border-t border-gray-800 pt-2">{data.description}</p>
        )}
      </div>

      {/* Derived stats */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h4 className="text-sm font-semibold text-purple-400 mb-3">Status Calculados (Nível 1)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBadge label="HP Máx" value={derived.hitPointsMax} color="red" />
          <StatBadge label="MP Máx" value={derived.manaPointsMax} color="blue" />
          <StatBadge label="Bloqueio" value={derived.block} color="purple" />
          <StatBadge label="Perícias Treinadas" value={derived.trainedSkillSlots} color="yellow" />
        </div>
      </div>

      {/* Attributes */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h4 className="text-sm font-semibold text-purple-400 mb-3">Atributos Finalizados</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ATTRIBUTES.map((attr) => {
            const baseVal = data.attributes[attr];
            const raceBonus = (raceBonuses[attr] as number) || 0;
            const finalVal = baseVal + raceBonus;
            const mod = getModifier(finalVal);

            return (
              <div key={attr} className="rounded border border-gray-800 bg-gray-950 p-2 text-center">
                <span className="block text-[10px] text-gray-400 uppercase font-semibold">
                  {ATTRIBUTE_LABELS[attr]}
                </span>
                <span className="block text-lg font-bold text-white mt-0.5">{finalVal}</span>
                <span className="block text-[10px] text-purple-400">
                  mod {mod >= 0 ? "+" : ""}{mod}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Items */}
      {selectedItemDetails.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h4 className="text-sm font-semibold text-purple-400 mb-2">
            Itens ({selectedItemDetails.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedItemDetails.map((item) => (
              <span key={item.id} className="rounded bg-amber-900/40 border border-amber-800/40 px-2 py-1 text-xs text-amber-300 font-medium">
                {item.name} ×{item.quantity}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Selected Spells */}
      {selectedSpellDetails.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h4 className="text-sm font-semibold text-purple-400 mb-2">
            Magias ({selectedSpellDetails.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedSpellDetails.map((spell) => (
              <span key={spell.id} className="rounded bg-blue-900/40 border border-blue-800/40 px-2 py-1 text-xs text-blue-300 font-medium">
                {spell.name} ({spell.circle}° Círculo)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: "red" | "blue" | "purple" | "yellow" }) {
  const colorClasses = {
    red: "border-red-900/60 bg-red-950/40 text-red-300",
    blue: "border-blue-900/60 bg-blue-950/40 text-blue-300",
    purple: "border-purple-900/60 bg-purple-950/40 text-purple-300",
    yellow: "border-yellow-900/60 bg-yellow-950/40 text-yellow-300",
  };

  return (
    <div className={`rounded-lg border p-2.5 text-center ${colorClasses[color]}`}>
      <span className="block text-[10px] font-semibold uppercase opacity-80">{label}</span>
      <span className="block text-xl font-bold mt-0.5">{value}</span>
    </div>
  );
}
