"use client";

import { useId, useState, type ReactNode } from "react";
import { useMotionPreferences, useSystemReducedMotion } from "@/hooks/useMotionPreferences";
import {
  MOTION_SPEED_MAX,
  MOTION_SPEED_MIN,
  resetMotionPreferences,
  resolveMotion,
  updateMotionPreferences,
  type MotionCategory,
  type MotionEasing,
  type MotionIntensity,
  type MotionPreset,
} from "@/lib/motion";

const PRESET_OPTIONS: Array<{
  id: MotionPreset;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: "fade", label: "Esmaecer", icon: "◐", description: "Apenas surge suavemente" },
  { id: "slide-up", label: "Deslizar ↑", icon: "⇡", description: "Sobe enquanto aparece" },
  { id: "slide-side", label: "Deslizar →", icon: "⇢", description: "Entra pela lateral" },
  { id: "zoom", label: "Zoom", icon: "⤢", description: "Cresce até o tamanho final" },
  { id: "blur", label: "Desfoque", icon: "◌", description: "Entra em foco aos poucos" },
  { id: "flip", label: "Virar 3D", icon: "⟲", description: "Gira como uma carta" },
];

const EASING_OPTIONS: Array<{ id: MotionEasing; label: string }> = [
  { id: "standard", label: "Padrão" },
  { id: "smooth", label: "Suave" },
  { id: "spring", label: "Elástica" },
  { id: "sharp", label: "Precisa" },
  { id: "linear", label: "Linear" },
];

const INTENSITY_OPTIONS: Array<{ id: MotionIntensity; label: string }> = [
  { id: "subtle", label: "Sutil" },
  { id: "normal", label: "Normal" },
  { id: "strong", label: "Intensa" },
];

const SPEED_PRESETS = [
  { value: 0.5, label: "Lenta" },
  { value: 1, label: "Normal" },
  { value: 1.5, label: "Rápida" },
  { value: 2, label: "Muito rápida" },
];

const CATEGORY_OPTIONS: Array<{ id: MotionCategory; label: string; description: string }> = [
  {
    id: "pages",
    label: "Páginas e abas",
    description: "Transição ao navegar entre telas e ao trocar de aba.",
  },
  {
    id: "overlays",
    label: "Modais, painéis e menus",
    description: "Entrada e saída de janelas, fichas, rolagens e menus.",
  },
  {
    id: "lists",
    label: "Listas e cartões",
    description: "Personagens, campanhas e itens aparecem em cascata.",
  },
  {
    id: "interactions",
    label: "Micro-interações",
    description: "Hover, clique, elevação de cartões e destaque do item ativo.",
  },
  {
    id: "feedback",
    label: "Notificações e alertas",
    description: "Avisos e mensagens deslizam ao aparecer.",
  },
  {
    id: "ambient",
    label: "Efeitos contínuos",
    description: "Pulsos, brilhos e animações em loop (indicadores, carregamentos decorativos).",
  },
];

function formatSpeed(speed: number): string {
  return `${speed.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`;
}

function Switch({
  checked,
  onChange,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-secondary-border transition disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-dominant-deep"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-secondary-pure shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-secondary-offwhite">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
              value === option.id
                ? "border-accent bg-accent/20 text-secondary-pure"
                : "border-secondary-border text-secondary-muted hover:border-accent hover:text-secondary-pure"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-secondary-border/60 pt-4">
      <h3 className="text-sm font-bold text-secondary-pure">{title}</h3>
      {children}
    </div>
  );
}

export function MotionSettingsPanel() {
  const prefs = useMotionPreferences();
  const systemReduced = useSystemReducedMotion();
  const resolved = resolveMotion(prefs, systemReduced);
  const [replay, setReplay] = useState(0);
  const id = useId();
  const off = !prefs.enabled;

  const statusLabel =
    resolved.mode === "off"
      ? "Desligadas"
      : resolved.mode === "reduced"
        ? "Movimento reduzido (sistema)"
        : "Ativas";

  return (
    <section
      className="rounded-lg border border-secondary-border bg-secondary-card p-5 space-y-4"
      data-testid="motion-settings"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="text-xl" aria-hidden="true">
            ✨
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-base font-bold text-secondary-pure">
              Animações e Efeitos
            </h2>
            <p className="text-xs text-secondary-muted">
              Transições, animações e efeitos visuais em toda a aplicação. As preferências ficam
              salvas neste dispositivo. Os dados 3D têm uma opção própria.
            </p>
            <span
              data-testid="motion-status"
              className={`mt-2 inline-block rounded border px-2 py-0.5 text-[10px] font-mono ${
                resolved.mode === "full"
                  ? "border-accent/60 bg-accent/15 text-accent-hover"
                  : "border-secondary-border bg-dominant-deep text-secondary-muted"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <Switch
          checked={prefs.enabled}
          labelledBy={`${id}-title`}
          onChange={(enabled) => updateMotionPreferences({ enabled })}
        />
      </div>

      <fieldset disabled={off} className={`space-y-4 ${off ? "opacity-50" : ""}`}>
        <Section title="Velocidade">
          <div className="flex items-center gap-3">
            <label htmlFor={`${id}-speed`} className="sr-only">
              Velocidade das animações
            </label>
            <input
              id={`${id}-speed`}
              type="range"
              min={MOTION_SPEED_MIN}
              max={MOTION_SPEED_MAX}
              step={0.25}
              value={prefs.speed}
              onChange={(event) => updateMotionPreferences({ speed: Number(event.target.value) })}
              className="flex-1 accent-[var(--accent-primary)]"
            />
            <span
              className="w-14 text-right font-mono text-sm text-secondary-pure"
              data-testid="motion-speed"
            >
              {formatSpeed(prefs.speed)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={prefs.speed === preset.value}
                onClick={() => updateMotionPreferences({ speed: preset.value })}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  prefs.speed === preset.value
                    ? "border-accent bg-accent/20 text-secondary-pure"
                    : "border-secondary-border text-secondary-muted hover:border-accent hover:text-secondary-pure"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Estilo de transição">
          <div
            role="radiogroup"
            aria-label="Estilo de transição"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={prefs.preset === option.id}
                onClick={() => {
                  updateMotionPreferences({ preset: option.id });
                  setReplay((value) => value + 1);
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                  prefs.preset === option.id
                    ? "border-accent bg-accent/15"
                    : "border-secondary-border hover:border-accent"
                }`}
              >
                <span className="text-xl text-accent-hover" aria-hidden="true">
                  {option.icon}
                </span>
                <span>
                  <span className="block text-xs font-bold text-secondary-pure">
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-secondary-muted">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionGroup
              label="Curva de animação"
              options={EASING_OPTIONS}
              value={prefs.easing}
              onChange={(easing) => {
                updateMotionPreferences({ easing });
                setReplay((value) => value + 1);
              }}
            />
            <OptionGroup
              label="Intensidade"
              options={INTENSITY_OPTIONS}
              value={prefs.intensity}
              onChange={(intensity) => {
                updateMotionPreferences({ intensity });
                setReplay((value) => value + 1);
              }}
            />
          </div>
        </Section>

        <Section title="Prévia">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div
              key={replay}
              data-testid="motion-preview"
              className="flex-1 rounded-lg border border-dashed border-secondary-border bg-dominant-deep p-4"
            >
              <div className="motion-dialog rounded-lg border border-accent/50 bg-secondary-card p-3 shadow-lg">
                <p className="text-xs font-bold text-secondary-pure">Janela de exemplo</p>
                <div className="motion-stagger mt-2 grid grid-cols-3 gap-2">
                  {["d20", "d12", "d8", "d6", "d4", "d10"].map((die) => (
                    <span
                      key={die}
                      className="motion-lift rounded-md border border-secondary-border bg-dominant-container py-2 text-center text-xs font-semibold text-secondary-pure"
                    >
                      {die}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplay((value) => value + 1)}
              className="rounded-md border border-secondary-border px-3 py-1.5 text-xs font-semibold text-secondary-pure transition hover:border-accent"
            >
              ▶ Reproduzir prévia
            </button>
          </div>
        </Section>

        <Section title="O que animar">
          <ul className="space-y-3">
            {CATEGORY_OPTIONS.map((category) => (
              <li key={category.id} className="flex items-start justify-between gap-4">
                <div>
                  <p
                    id={`${id}-${category.id}`}
                    className="text-xs font-semibold text-secondary-pure"
                  >
                    {category.label}
                  </p>
                  <p className="text-[11px] text-secondary-muted">{category.description}</p>
                </div>
                <Switch
                  checked={prefs.categories[category.id]}
                  labelledBy={`${id}-${category.id}`}
                  onChange={(checked) =>
                    updateMotionPreferences({ categories: { [category.id]: checked } })
                  }
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Acessibilidade">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id={`${id}-system`} className="text-xs font-semibold text-secondary-pure">
                Respeitar &quot;reduzir movimento&quot; do sistema
              </p>
              <p className="text-[11px] text-secondary-muted">
                Quando o sistema operacional pede menos movimento, as animações viram apenas
                esmaecimentos e os efeitos contínuos são pausados.
                {systemReduced ? " Seu sistema está pedindo movimento reduzido." : ""}
              </p>
            </div>
            <Switch
              checked={prefs.respectSystem}
              labelledBy={`${id}-system`}
              onChange={(respectSystem) => updateMotionPreferences({ respectSystem })}
            />
          </div>
        </Section>
      </fieldset>

      <div className="flex justify-end border-t border-secondary-border/60 pt-4">
        <button
          type="button"
          onClick={() => {
            resetMotionPreferences();
            setReplay((value) => value + 1);
          }}
          className="rounded-md border border-secondary-border px-3 py-1.5 text-xs font-semibold text-secondary-muted transition hover:border-accent hover:text-secondary-pure"
        >
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}
