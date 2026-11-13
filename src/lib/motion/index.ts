export const MOTION_STORAGE_KEY = "libmork:motion-preferences";

export const MOTION_PRESETS = ["fade", "slide-up", "slide-side", "zoom", "blur", "flip"] as const;
export const MOTION_EASINGS = ["standard", "smooth", "spring", "sharp", "linear"] as const;
export const MOTION_INTENSITIES = ["subtle", "normal", "strong"] as const;
export const MOTION_CATEGORIES = [
  "pages",
  "overlays",
  "lists",
  "interactions",
  "feedback",
  "ambient",
] as const;

export const MOTION_SPEED_MIN = 0.5;
export const MOTION_SPEED_MAX = 2;

export type MotionPreset = (typeof MOTION_PRESETS)[number];
export type MotionEasing = (typeof MOTION_EASINGS)[number];
export type MotionIntensity = (typeof MOTION_INTENSITIES)[number];
export type MotionCategory = (typeof MOTION_CATEGORIES)[number];
export type MotionMode = "full" | "reduced" | "off";

export interface MotionPreferences {
  enabled: boolean;
  respectSystem: boolean;
  /** Multiplicador de velocidade: 2 = duas vezes mais rápido. */
  speed: number;
  preset: MotionPreset;
  easing: MotionEasing;
  intensity: MotionIntensity;
  categories: Record<MotionCategory, boolean>;
}

export const DEFAULT_MOTION_PREFERENCES: MotionPreferences = Object.freeze({
  enabled: true,
  respectSystem: true,
  speed: 1,
  preset: "slide-up",
  easing: "standard",
  intensity: "normal",
  categories: Object.freeze({
    pages: true,
    overlays: true,
    lists: true,
    interactions: true,
    feedback: true,
    ambient: true,
  }),
}) as MotionPreferences;

export const MOTION_EASING_CURVES: Record<MotionEasing, string> = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  smooth: "cubic-bezier(0.45, 0, 0.55, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  sharp: "cubic-bezier(0.4, 0, 0.2, 1)",
  linear: "linear",
};

const INTENSITY_VALUES: Record<
  MotionIntensity,
  { distance: number; scale: number; blur: number; rotate: number; press: number; lift: number }
> = {
  subtle: { distance: 6, scale: 0.98, blur: 3, rotate: 10, press: 0.985, lift: 1 },
  normal: { distance: 14, scale: 0.95, blur: 6, rotate: 20, press: 0.97, lift: 2 },
  strong: { distance: 32, scale: 0.88, blur: 12, rotate: 40, press: 0.94, lift: 4 },
};

/** Durações base (ms) antes de aplicar a velocidade. */
export const MOTION_BASE_DURATIONS = { fast: 150, base: 260, slow: 420 } as const;

export interface MotionEnterOffsets {
  x: number;
  y: number;
  scale: number;
  blur: number;
  rotate: number;
}

export interface ResolvedMotion {
  mode: MotionMode;
  /** Multiplicador aplicado às durações (0 quando desligado). */
  factor: number;
  easing: string;
  enter: MotionEnterOffsets;
  press: number;
  lift: number;
  disabled: MotionCategory[];
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function clampSpeed(value: unknown): number {
  const speed = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(MOTION_SPEED_MAX, Math.max(MOTION_SPEED_MIN, Math.round(speed * 100) / 100));
}

export function sanitizeMotionPreferences(input: unknown): MotionPreferences {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<
    Record<keyof MotionPreferences, unknown>
  >;
  const rawCategories = (
    raw.categories && typeof raw.categories === "object" ? raw.categories : {}
  ) as Partial<Record<MotionCategory, unknown>>;
  const defaults = DEFAULT_MOTION_PREFERENCES;
  const categories = Object.fromEntries(
    MOTION_CATEGORIES.map((key) => [
      key,
      typeof rawCategories[key] === "boolean" ? rawCategories[key] : defaults.categories[key],
    ]),
  ) as Record<MotionCategory, boolean>;

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    respectSystem:
      typeof raw.respectSystem === "boolean" ? raw.respectSystem : defaults.respectSystem,
    speed: clampSpeed(raw.speed),
    preset: pick(raw.preset, MOTION_PRESETS, defaults.preset),
    easing: pick(raw.easing, MOTION_EASINGS, defaults.easing),
    intensity: pick(raw.intensity, MOTION_INTENSITIES, defaults.intensity),
    categories,
  };
}

export function getEnterOffsets(
  preset: MotionPreset,
  intensity: MotionIntensity,
): MotionEnterOffsets {
  const v = INTENSITY_VALUES[intensity];
  const none: MotionEnterOffsets = { x: 0, y: 0, scale: 1, blur: 0, rotate: 0 };
  switch (preset) {
    case "slide-up":
      return { ...none, y: v.distance };
    case "slide-side":
      return { ...none, x: v.distance * 1.5 };
    case "zoom":
      return { ...none, scale: v.scale };
    case "blur":
      return { ...none, blur: v.blur, scale: 1 - (1 - v.scale) / 3 };
    case "flip":
      return { ...none, rotate: v.rotate, y: v.distance / 2 };
    default:
      return none;
  }
}

export function resolveMotion(
  prefs: MotionPreferences,
  systemReducedMotion: boolean,
): ResolvedMotion {
  const mode: MotionMode = !prefs.enabled
    ? "off"
    : prefs.respectSystem && systemReducedMotion
      ? "reduced"
      : "full";
  const reduced = mode === "reduced";
  const intensity = INTENSITY_VALUES[prefs.intensity];
  const disabled =
    mode === "off"
      ? [...MOTION_CATEGORIES]
      : MOTION_CATEGORIES.filter(
          (category) => !prefs.categories[category] || (reduced && category === "ambient"),
        );

  return {
    mode,
    factor: mode === "off" ? 0 : Math.round((1 / prefs.speed) * 1000) / 1000,
    easing: MOTION_EASING_CURVES[reduced && prefs.easing === "spring" ? "standard" : prefs.easing],
    enter: reduced
      ? getEnterOffsets("fade", prefs.intensity)
      : getEnterOffsets(prefs.preset, prefs.intensity),
    press: reduced ? 1 : intensity.press,
    lift: reduced ? 0 : intensity.lift,
    disabled,
  };
}

export function isMotionCategoryActive(
  resolved: ResolvedMotion,
  category: MotionCategory,
): boolean {
  return resolved.mode !== "off" && !resolved.disabled.includes(category);
}

export function motionDuration(
  resolved: ResolvedMotion,
  kind: keyof typeof MOTION_BASE_DURATIONS,
): number {
  return Math.round(MOTION_BASE_DURATIONS[kind] * resolved.factor);
}

export function enterTransform(enter: MotionEnterOffsets): string {
  return `perspective(900px) translate3d(${enter.x}px, ${enter.y}px, 0) scale(${enter.scale}) rotateX(${enter.rotate}deg)`;
}

/** Aplica o resultado como atributos e variáveis CSS (normalmente no <html>). */
export function applyMotion(root: HTMLElement, resolved: ResolvedMotion): void {
  root.dataset.motion = resolved.mode;
  root.dataset.motionOff = resolved.disabled.join(" ");
  const vars: Record<string, string> = {
    "--motion-factor": String(resolved.factor),
    "--motion-ease": resolved.easing,
    "--motion-enter-x": `${resolved.enter.x}px`,
    "--motion-enter-y": `${resolved.enter.y}px`,
    "--motion-enter-scale": String(resolved.enter.scale),
    "--motion-enter-blur": `${resolved.enter.blur}px`,
    "--motion-enter-rotate": `${resolved.enter.rotate}deg`,
    "--motion-press-scale": String(resolved.press),
    "--motion-lift": `${resolved.lift}px`,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

// ---------------------------------------------------------------------------
// Persistência (por dispositivo) e assinatura para useSyncExternalStore
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedPrefs: MotionPreferences = DEFAULT_MOTION_PREFERENCES;

export function getMotionPreferences(): MotionPreferences {
  if (typeof window === "undefined") return DEFAULT_MOTION_PREFERENCES;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(MOTION_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedPrefs;
  cachedRaw = raw;
  try {
    cachedPrefs = raw ? sanitizeMotionPreferences(JSON.parse(raw)) : DEFAULT_MOTION_PREFERENCES;
  } catch {
    cachedPrefs = DEFAULT_MOTION_PREFERENCES;
  }
  return cachedPrefs;
}

export function setMotionPreferences(next: MotionPreferences): void {
  if (typeof window === "undefined") return;
  const prefs = sanitizeMotionPreferences(next);
  const raw = JSON.stringify(prefs);
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, raw);
    cachedRaw = raw;
  } catch {
    cachedRaw = undefined;
  }
  cachedPrefs = prefs;
  listeners.forEach((listener) => listener());
}

export function updateMotionPreferences(
  patch: Partial<Omit<MotionPreferences, "categories">> & {
    categories?: Partial<Record<MotionCategory, boolean>>;
  },
): void {
  const current = getMotionPreferences();
  setMotionPreferences({
    ...current,
    ...patch,
    categories: { ...current.categories, ...patch.categories },
  });
}

export function resetMotionPreferences(): void {
  setMotionPreferences(DEFAULT_MOTION_PREFERENCES);
}

export function subscribeMotionPreferences(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === MOTION_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function getSystemReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function subscribeSystemReducedMotion(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener?.("change", listener);
  return () => query.removeEventListener?.("change", listener);
}

/** Lê o estado atual direto do <html> (útil fora do React). */
export function isMotionCategoryEnabledInDocument(category: MotionCategory): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.dataset.motion === "off") return false;
  return !(root.dataset.motionOff ?? "").split(" ").includes(category);
}
