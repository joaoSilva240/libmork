"use client";

// =============================================================================
// Libmork — Sistema Fallout 2d20: Assistente de Criação (Pip-Boy)
// Fases: Identidade → S.P.E.C.I.A.L. → Perícias → Perks
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_SKILLS,
  FALLOUT_SKILL_CONFIGS,
  type FalloutAttribute,
  type FalloutCharacter,
  type FalloutOrigin,
  type FalloutSkillName,
} from "@/lib/systems/fallout/types";
import {
  FALLOUT_ORIGIN_CONFIGS,
  FALLOUT_ORIGIN_LIST,
} from "@/lib/systems/fallout/origins";

interface FalloutCharacterWizardProps {
  campaignId?: string | null;
  onSuccess?: (character: FalloutCharacter) => void;
  onCancel?: () => void;
}

type WizardData = {
  name: string;
  origin: FalloutOrigin;
  attributes: Record<FalloutAttribute, number>;
  tagSkills: FalloutSkillName[];
  perks: string[];
};

const STORAGE_KEY = "fallout_character_wizard_draft_v1";

const STEPS = [
  { label: "Identidade", shortLabel: "Ident." },
  { label: "S.P.E.C.I.A.L.", shortLabel: "SPECIAL" },
  { label: "Perícias", shortLabel: "Perícias" },
  { label: "Perks", shortLabel: "Perks" },
] as const;

const ATTRIBUTE_BUDGET = 40;
const ATTRIBUTE_MIN = 4;
const ATTRIBUTE_MAX = 10;
const STARTING_CAPS = 50;

const DEFAULT_ATTRIBUTES: Record<FalloutAttribute, number> = {
  str: 5,
  per: 5,
  end: 5,
  cha: 5,
  int: 5,
  agi: 5,
  luc: 5,
};

export function FalloutCharacterWizard({
  campaignId = null,
  onSuccess,
  onCancel,
}: FalloutCharacterWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({
    name: "",
    origin: "vault_dweller",
    attributes: { ...DEFAULT_ATTRIBUTES },
    tagSkills: [],
    perks: [],
  });
  const [appliedBonusOrigin, setAppliedBonusOrigin] = useState<FalloutOrigin | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardData>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWizardData((prev) => ({
          ...prev,
          ...parsed,
          attributes: { ...DEFAULT_ATTRIBUTES, ...parsed.attributes },
        }));
        setAppliedBonusOrigin(parsed.origin ?? null);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    } catch {
      /* ignore */
    }
  }, [wizardData, hydrated]);

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  }, []);

  const originConfig = FALLOUT_ORIGIN_CONFIGS[wizardData.origin];
  const maxTagSkills = 3 + originConfig.bonusTags;

  const handleOriginChange = useCallback(
    (origin: FalloutOrigin) => {
      const next = FALLOUT_ORIGIN_CONFIGS[origin];
      setWizardData((prev) => {
        const attributes = { ...prev.attributes };
        // Remove bônus da origem anterior e aplica a nova
        if (appliedBonusOrigin) {
          const prevCfg = FALLOUT_ORIGIN_CONFIGS[appliedBonusOrigin];
          for (const [attr, bonus] of Object.entries(prevCfg.attributeBonuses)) {
            attributes[attr as FalloutAttribute] -= bonus ?? 0;
          }
        }
        for (const [attr, bonus] of Object.entries(next.attributeBonuses)) {
          attributes[attr as FalloutAttribute] = (attributes[attr as FalloutAttribute] ?? 0) + (bonus ?? 0);
        }
        // Aplica limites da nova origem
        for (const attr of FALLOUT_ATTRIBUTES) {
          const limit = next.attributeLimits[attr] ?? ATTRIBUTE_MAX;
          attributes[attr] = Math.max(ATTRIBUTE_MIN, Math.min(limit, attributes[attr]));
        }
        // Remove tags inválidas para a nova origem (tag extra restrita)
        const tagSkills = prev.tagSkills.filter(
          (sk) => !(next.bonusTagOptions.length > 0 && !next.bonusTagOptions.includes(sk)),
        );
        return { ...prev, origin, attributes, tagSkills };
      });
      setAppliedBonusOrigin(origin);
    },
    [appliedBonusOrigin],
  );

  const attrMax = useCallback(
    (attr: FalloutAttribute) => originConfig.attributeLimits[attr] ?? ATTRIBUTE_MAX,
    [originConfig],
  );

  const validateStep = useCallback(
    (step: number): boolean => {
      setError(null);
      switch (step) {
        case 0: {
          if (!wizardData.name || wizardData.name.trim().length < 2) {
            setError("Nome deve ter no mínimo 2 caracteres.");
            return false;
          }
          if (wizardData.name.length > 100) {
            setError("Nome deve ter no máximo 100 caracteres.");
            return false;
          }
          return true;
        }
        case 1: {
          const bonus = Object.values(originConfig.attributeBonuses).reduce((a, b) => a + b, 0);
          const sum =
            FALLOUT_ATTRIBUTES.reduce((acc, attr) => acc + wizardData.attributes[attr], 0) - bonus;
          if (sum !== ATTRIBUTE_BUDGET) {
            setError(
              `Distribua exatamente ${ATTRIBUTE_BUDGET} pontos. Soma atual: ${sum}.`,
            );
            return false;
          }
          return true;
        }
        case 2: {
          if (wizardData.tagSkills.length === 0) {
            setError("Selecione pelo menos 1 Tag Skill.");
            return false;
          }
          if (originConfig.bonusTagOptions.length > 0) {
            const extra = wizardData.tagSkills[wizardData.tagSkills.length - 1];
            if (wizardData.tagSkills.length > 3 && !originConfig.bonusTagOptions.includes(extra)) {
              setError(
                `A Tag Skill extra da origem deve ser: ${originConfig.bonusTagOptions
                  .map((s) => FALLOUT_SKILL_CONFIGS[s].label)
                  .join(", ")}.`,
              );
              return false;
            }
          }
          return true;
        }
        default:
          return true;
      }
    },
    [wizardData, originConfig],
  );

  const goNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [currentStep, validateStep]);

  const goBack = useCallback(() => {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/systems/fallout/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId,
          name: wizardData.name.trim(),
          origin: wizardData.origin,
          attributes: wizardData.attributes,
          tagSkills: wizardData.tagSkills,
          perks: wizardData.perks,
          caps: STARTING_CAPS,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Falha ao registrar sobrevivente");
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }

      if (onSuccess) {
        onSuccess(data.data);
      } else {
        router.push("/player");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, validateStep, campaignId, wizardData, onSuccess, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <span className="animate-pulse font-mono text-sm text-emerald-400">
          Inicializando Vault-Tec Registration...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-2 sm:px-4 pb-28 font-mono">
      {/* Cabeçalho e Stepper */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md pt-4 pb-3 border-b border-emerald-500/30 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-500">
              Vault-Tec Registration System
            </span>
            <h2 className="text-xl font-bold text-emerald-200">
              Novo Sobrevivente — Fallout 2d20
            </h2>
          </div>
          {onCancel && currentStep === 0 && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded border border-emerald-700 text-xs text-emerald-400 hover:bg-emerald-950 cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
        <WizardStepper
          currentStep={currentStep}
          onStepClick={(s) => {
            if (s <= currentStep || validateStep(currentStep)) {
              setError(null);
              setCurrentStep(s);
            }
          }}
        />
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded bg-red-950/50 border border-red-500 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Conteúdo da Etapa */}
      <div className="space-y-4">
        {currentStep === 0 && (
          <StepIdentity data={wizardData} updateData={updateData} onOriginChange={handleOriginChange} />
        )}
        {currentStep === 1 && (
          <StepSpecial
            data={wizardData}
            originConfig={originConfig}
            attrMax={attrMax}
            updateData={updateData}
          />
        )}
        {currentStep === 2 && (
          <StepSkills
            data={wizardData}
            maxTagSkills={maxTagSkills}
            restrictedOptions={originConfig.bonusTagOptions}
            updateData={updateData}
          />
        )}
        {currentStep === 3 && <StepPerks data={wizardData} updateData={updateData} />}
      </div>

      {/* Barra de Navegação Inferior */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
        style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px))` }}
      >
        <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-emerald-500/40 bg-zinc-950/95 px-4 py-3 sm:px-8 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0 || isSubmitting}
            className="min-w-[100px] px-4 py-2 rounded-full border border-emerald-700 text-xs text-emerald-400 hover:bg-emerald-950 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            ← Voltar
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={isSubmitting}
              className="min-w-[100px] px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="min-w-[160px] px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Registrar no Pip-Boy"}
            </button>
          )}
        </div>
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
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-1 sm:gap-2" aria-label="Progresso da criação">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        return (
          <React.Fragment key={step.label}>
            {idx > 0 && (
              <div
                className={`h-px flex-1 min-w-2 ${isDone || isActive ? "bg-emerald-500/60" : "bg-emerald-900/50"}`}
              />
            )}
            <button
              type="button"
              onClick={() => onStepClick(idx)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:text-xs font-bold transition-colors cursor-pointer ${
                isActive
                  ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                  : isDone
                    ? "border-emerald-700 bg-emerald-950 text-emerald-400 hover:border-emerald-500"
                    : "border-emerald-900/60 bg-black/60 text-emerald-700 hover:border-emerald-700"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                  isDone ? "bg-emerald-500 text-black" : isActive ? "bg-emerald-400 text-black" : "bg-emerald-900/60 text-emerald-500"
                }`}
              >
                {idx + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.shortLabel}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =============================================================================
// Fase 1 — Identidade (nome + origem)
// =============================================================================

function StepIdentity({
  data,
  updateData,
  onOriginChange,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
  onOriginChange: (origin: FalloutOrigin) => void;
}) {
  const selected = FALLOUT_ORIGIN_CONFIGS[data.origin];

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="fallout-wizard-name" className="block text-xs uppercase text-emerald-400 mb-1">
          Nome do Personagem
        </label>
        <input
          id="fallout-wizard-name"
          type="text"
          required
          placeholder="Ex: Lucy MacLean"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          className="w-full bg-black border border-emerald-500/50 rounded px-3 py-2 text-sm text-emerald-200 focus:outline-none focus:border-emerald-400"
        />
      </div>

      <div>
        <span className="block text-xs uppercase text-emerald-400 mb-2">Origem</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" aria-label="Origem do personagem">
          {FALLOUT_ORIGIN_LIST.map((origin) => {
            const isSelected = data.origin === origin.id;
            return (
              <button
                key={origin.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onOriginChange(origin.id)}
                className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    : "border-emerald-900/60 bg-black/60 hover:border-emerald-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${isSelected ? "text-emerald-200" : "text-emerald-300"}`}>
                    {origin.label}
                  </span>
                  {origin.bonusTags > 0 && (
                    <span className="rounded bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 whitespace-nowrap">
                      +{origin.bonusTags} Tag
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-500/90">{origin.description}</p>
                <p className="mt-1 text-[10px] text-emerald-600 italic">{origin.source}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Traço da origem selecionada */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3">
        <div className="text-[10px] uppercase tracking-widest text-emerald-500">Traço de Origem</div>
        <div className="mt-1 text-xs font-bold text-emerald-200">{selected.traitName}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-400">{selected.traitDescription}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Fase 2 — S.P.E.C.I.A.L.
// =============================================================================

function StepSpecial({
  data,
  originConfig,
  attrMax,
  updateData,
}: {
  data: WizardData;
  originConfig: (typeof FALLOUT_ORIGIN_CONFIGS)[FalloutOrigin];
  attrMax: (attr: FalloutAttribute) => number;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const totalBonus = Object.values(originConfig.attributeBonuses).reduce((a, b) => a + b, 0);
  const totalPoints =
    FALLOUT_ATTRIBUTES.reduce((acc, attr) => acc + data.attributes[attr], 0) - totalBonus;
  const remaining = ATTRIBUTE_BUDGET - totalPoints;

  const handleAttrChange = (attr: FalloutAttribute, delta: number) => {
    updateData({
      attributes: {
        ...data.attributes,
        [attr]: Math.max(ATTRIBUTE_MIN, Math.min(attrMax(attr), data.attributes[attr] + delta)),
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold uppercase text-emerald-300">Atributos S.P.E.C.I.A.L.</span>
        <span className={remaining !== 0 ? "text-amber-400" : "text-emerald-400"}>
          Total: {totalPoints} / {ATTRIBUTE_BUDGET} (
          {remaining > 0 ? `${remaining} restantes` : remaining < 0 ? `${Math.abs(remaining)} acima` : "ok"})
        </span>
      </div>

      {Object.keys(originConfig.attributeBonuses).length > 0 && (
        <p className="text-[11px] text-amber-300/90">
          Bônus de origem já aplicados:{" "}
          {Object.entries(originConfig.attributeBonuses)
            .map(([attr, bonus]) => `${FALLOUT_ATTRIBUTE_CONFIGS[attr as FalloutAttribute].label} +${bonus}`)
            .join(", ")}
          .
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {FALLOUT_ATTRIBUTES.map((attr) => {
          const cfg = FALLOUT_ATTRIBUTE_CONFIGS[attr];
          const max = attrMax(attr);
          return (
            <div key={attr} className="bg-black/80 border border-emerald-500/40 rounded p-2 text-center">
              <div className="text-[10px] font-bold text-emerald-500 uppercase" title={cfg.description}>
                {cfg.shortLabel}
              </div>
              <div className="text-xl font-bold text-emerald-200 my-1">{data.attributes[attr]}</div>
              <div className="text-[9px] text-emerald-600 mb-1">máx. {max}</div>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAttrChange(attr, -1)}
                  disabled={data.attributes[attr] <= ATTRIBUTE_MIN}
                  className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-xs text-emerald-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAttrChange(attr, 1)}
                  disabled={data.attributes[attr] >= max}
                  className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-xs text-emerald-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-emerald-600 leading-relaxed">
        Mínimo {ATTRIBUTE_MIN}, máximo {ATTRIBUTE_MAX} em cada atributo. RES determina seus Pontos de
        Vida, AGI a Defesa, PER+AGI a Iniciativa, SOR seus Pontos de Sorte e FOR sua Carga e Dano
        corpo a corpo.
      </p>
    </div>
  );
}

// =============================================================================
// Fase 3 — Perícias (Tag Skills)
// =============================================================================

function StepSkills({
  data,
  maxTagSkills,
  restrictedOptions,
  updateData,
}: {
  data: WizardData;
  maxTagSkills: number;
  restrictedOptions: FalloutSkillName[];
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const isRestricted = restrictedOptions.length > 0;

  const toggleSkill = (skill: FalloutSkillName) => {
    const current = data.tagSkills;
    if (current.includes(skill)) {
      updateData({ tagSkills: current.filter((s) => s !== skill) });
      return;
    }
    if (current.length >= maxTagSkills) return;
    // Tag extra (além das 3 padrão) restrita às opções da origem
    if (isRestricted && current.length >= 3 && !restrictedOptions.includes(skill)) return;
    updateData({ tagSkills: [...current, skill] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold uppercase text-emerald-300">Tag Skills (especialidades ★)</span>
        <span
          className={data.tagSkills.length >= maxTagSkills ? "text-amber-300" : "text-emerald-400"}
        >
          {data.tagSkills.length} / {maxTagSkills} selecionadas
        </span>
      </div>

      {isRestricted && (
        <p className="text-[11px] text-amber-300/90">
          A Tag Skill extra da sua origem deve ser:{" "}
          {restrictedOptions.map((s) => FALLOUT_SKILL_CONFIGS[s].label).join(", ")}.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {FALLOUT_SKILLS.map((sk) => {
          const cfg = FALLOUT_SKILL_CONFIGS[sk];
          const selected = data.tagSkills.includes(sk);
          const disabledExtra = isRestricted && data.tagSkills.length >= 3 && !restrictedOptions.includes(sk);
          return (
            <button
              key={sk}
              type="button"
              onClick={() => toggleSkill(sk)}
              disabled={!selected && (data.tagSkills.length >= maxTagSkills || disabledExtra)}
              className={`px-2.5 py-1.5 rounded border text-left text-xs flex items-center justify-between transition-all ${
                selected
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold"
                  : "bg-black/50 border-emerald-900/50 text-emerald-500 hover:text-emerald-300"
              } ${!selected && (data.tagSkills.length >= maxTagSkills || disabledExtra) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="truncate">
                {cfg.label}
                <span className="text-[9px] text-emerald-600 ml-1">
                  ({FALLOUT_ATTRIBUTE_CONFIGS[cfg.defaultAttribute].shortLabel})
                </span>
              </span>
              <span>{selected ? "★" : ""}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-emerald-600 leading-relaxed">
        Tag Skills dobram os sucessos em rolagens de d20 iguais ou abaixo do rank da perícia. As
        perícias iniciam em rank 0 e sobem com o nível do personagem.
      </p>
    </div>
  );
}

// =============================================================================
// Fase 4 — Perks
// =============================================================================

function StepPerks({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
}) {
  const [draft, setDraft] = useState("");

  const addPerk = () => {
    const name = draft.trim();
    if (!name) return;
    if (data.perks.includes(name)) return;
    updateData({ perks: [...data.perks, name] });
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold uppercase text-emerald-300">Perks Iniciais</span>
        <span className="text-emerald-400">{data.perks.length} selecionada(s)</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ex: Action Boy / Fortune Finder..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPerk();
            }
          }}
          className="flex-1 bg-black border border-emerald-500/50 rounded px-3 py-2 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
        />
        <button
          type="button"
          onClick={addPerk}
          disabled={!draft.trim() || data.perks.includes(draft.trim())}
          className="px-4 py-2 rounded bg-emerald-950 border border-emerald-500 text-xs font-bold text-emerald-300 hover:bg-emerald-900 cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          + Adicionar
        </button>
      </div>

      {data.perks.length === 0 ? (
        <p className="text-[11px] text-emerald-600 italic">
          Nenhum perk selecionado — você pode adicionar perks ao subir de nível no Pip-Boy.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.perks.map((perk) => (
            <li
              key={perk}
              className="flex items-center justify-between rounded border border-emerald-500/30 bg-black/60 px-3 py-2 text-xs text-emerald-200"
            >
              <span>{perk}</span>
              <button
                type="button"
                onClick={() => updateData({ perks: data.perks.filter((p) => p !== perk) })}
                className="text-emerald-600 hover:text-red-400 cursor-pointer"
                aria-label={`Remover ${perk}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-emerald-600 leading-relaxed">
        Personagens de nível 1 começam com 1 perk (além do traço de origem). Os perks oficiais do
        Fallout 2d20 estarão disponíveis para seleção na Biblioteca Global a partir da Fase 3 do
        projeto.
      </p>
    </div>
  );
}
