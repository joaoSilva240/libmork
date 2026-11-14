// =============================================================================
// Libmork — Cenas do Mestre: metadados e matriz declarativa (Issue #86, Fase 1)
// =============================================================================
// Fonte única do que cada cena significa. A matriz é declarada aqui e aplicada
// pelos componentes na Fase 2; nesta fase apenas SceneBar e o header a usam.
// =============================================================================

import { Beer, EyeOff, Footprints, Search, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SCENE_VALUES = ["combat", "interlude", "stealth", "investigation", "escape"] as const;

export type SceneType = (typeof SCENE_VALUES)[number];

/** null = modo Livre (neutro, comportamento anterior do escudo). */
export type ActiveScene = SceneType | null;

export type ModuleVisibility = "neutral" | "visible" | "hidden";

export interface SceneModuleState {
  carousel: ModuleVisibility;
  combatBar: ModuleVisibility;
  establishments: ModuleVisibility;
}

export interface SceneMeta {
  value: SceneType;
  label: string;
  icon: LucideIcon;
  /** Classes do botão quando a cena está ativa. */
  activeClasses: string;
  /** Classes de destaque da cena no header do escudo (Fase 1). */
  accentClasses: string;
}

export const SCENE_ORDER: SceneType[] = [
  "combat",
  "interlude",
  "stealth",
  "investigation",
  "escape",
];

export const SCENES: Record<SceneType, SceneMeta> = {
  combat: {
    value: "combat",
    label: "Combate",
    icon: Swords,
    activeClasses: "border-red-400 bg-red-600 text-white",
    accentClasses: "border-red-500/70 shadow-red-950/40",
  },
  interlude: {
    value: "interlude",
    label: "Interlúdio",
    icon: Beer,
    activeClasses: "border-emerald-400 bg-emerald-600 text-white",
    accentClasses: "border-emerald-500/70 shadow-emerald-950/40",
  },
  stealth: {
    value: "stealth",
    label: "Furtividade",
    icon: EyeOff,
    activeClasses: "border-indigo-400 bg-indigo-600 text-white",
    accentClasses: "border-indigo-500/70 shadow-indigo-950/40",
  },
  investigation: {
    value: "investigation",
    label: "Investigação",
    icon: Search,
    activeClasses: "border-amber-400 bg-amber-600 text-white",
    accentClasses: "border-amber-500/70 shadow-amber-950/40",
  },
  escape: {
    value: "escape",
    label: "Fuga",
    icon: Footprints,
    activeClasses: "border-orange-400 bg-orange-600 text-white",
    accentClasses: "border-orange-500/70 shadow-orange-950/40",
  },
};

/** Neutro = comportamento atual do escudo, módulo por módulo. */
export const NEUTRAL_MODULES: SceneModuleState = {
  carousel: "neutral",
  combatBar: "neutral",
  establishments: "neutral",
};

// "hidden" = oculto sem perder estado (desk/preferências/combate preservados).
export const SCENE_MATRIX: Record<SceneType, SceneModuleState> = {
  combat: { carousel: "visible", combatBar: "visible", establishments: "hidden" },
  interlude: { carousel: "hidden", combatBar: "hidden", establishments: "visible" },
  stealth: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
  investigation: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
  escape: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
};

export function modulesForScene(scene: ActiveScene): SceneModuleState {
  return scene ? SCENE_MATRIX[scene] : NEUTRAL_MODULES;
}

export function isSceneValue(value: unknown): value is SceneType {
  return typeof value === "string" && (SCENE_VALUES as readonly string[]).includes(value);
}

export function sanitizeActiveScene(value: unknown): ActiveScene {
  return isSceneValue(value) ? value : null;
}
