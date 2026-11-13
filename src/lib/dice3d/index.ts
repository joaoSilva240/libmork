import { ensureAaaTextColor, type ThemeConfig } from "@/lib/theme";
import type { RolledDie } from "@/lib/engine/dice";

export type Dice3DDie = RolledDie;

export const DICE3D_SUPPORTED_SIDES = [4, 6, 8, 10, 12, 20] as const;
export const DICE3D_MAX_DICE = 20;
export const DICE3D_HIDE_DELAY_MS = 3000;
export const DICE3D_STORAGE_KEY = "libmork:dice3d-enabled";

type RollListener = (dice: Dice3DDie[]) => void;
const rollListeners = new Set<RollListener>();
const preferenceListeners = new Set<() => void>();

export function sanitizeDice3D(dice: readonly Dice3DDie[]): Dice3DDie[] {
  return dice
    .filter(
      (die) =>
        (DICE3D_SUPPORTED_SIDES as readonly number[]).includes(die.sides) &&
        Number.isInteger(die.value) &&
        die.value >= 1 &&
        die.value <= die.sides,
    )
    .slice(0, DICE3D_MAX_DICE);
}

/**
 * Monta a notação predeterminada do dice-box (ex.: "1d20+2d6@15,3,4").
 * Dados do mesmo tipo são agrupados porque a biblioteca funde conjuntos iguais.
 */
export function buildDice3DNotation(dice: readonly Dice3DDie[]): string | null {
  const valid = sanitizeDice3D(dice);
  if (!valid.length) return null;
  const groups = new Map<number, number[]>();
  for (const die of valid) {
    const values = groups.get(die.sides) ?? [];
    values.push(die.value);
    groups.set(die.sides, values);
  }
  const sets = [...groups].map(([sides, values]) => `${values.length}d${sides}`);
  const results = [...groups.values()].flat();
  return `${sets.join("+")}@${results.join(",")}`;
}

export function isDice3DEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DICE3D_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setDice3DEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DICE3D_STORAGE_KEY, String(enabled));
  } catch {
    // armazenamento indisponível: mantém apenas a notificação em memória
  }
  preferenceListeners.forEach((listener) => listener());
}

export function subscribeDice3DPreference(listener: () => void): () => void {
  preferenceListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === DICE3D_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Exibe os dados 3D localmente (apenas na tela de quem rolou). */
export function showDice3D(dice: readonly Dice3DDie[]): void {
  const valid = sanitizeDice3D(dice);
  if (!valid.length || !isDice3DEnabled()) return;
  rollListeners.forEach((listener) => listener(valid));
}

export function subscribeDice3DRolls(listener: RollListener): () => void {
  rollListeners.add(listener);
  return () => {
    rollListeners.delete(listener);
  };
}

export function d20s(...values: Array<number | null | undefined>): Dice3DDie[] {
  return values
    .filter((value): value is number => typeof value === "number")
    .map((value) => ({ sides: 20, value }));
}

export function d6s(values: readonly number[]): Dice3DDie[] {
  return values.map((value) => ({ sides: 6, value }));
}

export function buildDice3DColorset(theme: ThemeConfig) {
  const background = theme.colors.accent.primary;
  const foreground = ensureAaaTextColor(background).textPure;
  const outline = theme.colors.accent.dark;
  return {
    name: `libmork-${theme.name}-${background}-${foreground}-${outline}`.replace(
      /[^a-zA-Z0-9-]/g,
      "",
    ),
    foreground,
    background,
    outline,
    texture: "none",
    material: "plastic" as const,
  };
}
