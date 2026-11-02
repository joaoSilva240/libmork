import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MOTION_PREFERENCES,
  MOTION_STORAGE_KEY,
  applyMotion,
  getEnterOffsets,
  getMotionPreferences,
  isMotionCategoryActive,
  isMotionCategoryEnabledInDocument,
  motionDuration,
  resetMotionPreferences,
  resolveMotion,
  sanitizeMotionPreferences,
  subscribeMotionPreferences,
  updateMotionPreferences,
} from "@/lib/motion";

describe("sanitizeMotionPreferences", () => {
  it("usa os padrões para entradas inválidas", () => {
    expect(sanitizeMotionPreferences(null)).toEqual(DEFAULT_MOTION_PREFERENCES);
    expect(
      sanitizeMotionPreferences({ preset: "explode", easing: 3, intensity: "max", enabled: "sim" }),
    ).toEqual(DEFAULT_MOTION_PREFERENCES);
  });

  it("limita a velocidade e mescla categorias parciais", () => {
    const prefs = sanitizeMotionPreferences({ speed: 9, categories: { ambient: false } });
    expect(prefs.speed).toBe(2);
    expect(prefs.categories.ambient).toBe(false);
    expect(prefs.categories.pages).toBe(true);
    expect(sanitizeMotionPreferences({ speed: 0.1 }).speed).toBe(0.5);
    expect(sanitizeMotionPreferences({ speed: Number.NaN }).speed).toBe(1);
  });
});

describe("resolveMotion", () => {
  it("desliga tudo quando desativado", () => {
    const resolved = resolveMotion({ ...DEFAULT_MOTION_PREFERENCES, enabled: false }, false);
    expect(resolved.mode).toBe("off");
    expect(resolved.factor).toBe(0);
    expect(isMotionCategoryActive(resolved, "pages")).toBe(false);
  });

  it("converte velocidade em multiplicador de duração", () => {
    const resolved = resolveMotion({ ...DEFAULT_MOTION_PREFERENCES, speed: 2 }, false);
    expect(resolved.factor).toBe(0.5);
    expect(motionDuration(resolved, "base")).toBe(130);
  });

  it("reduz movimento quando o sistema pede e a opção está ativa", () => {
    const prefs = { ...DEFAULT_MOTION_PREFERENCES, preset: "flip" as const, easing: "spring" as const };
    const reduced = resolveMotion(prefs, true);
    expect(reduced.mode).toBe("reduced");
    expect(reduced.enter).toEqual(getEnterOffsets("fade", "normal"));
    expect(reduced.press).toBe(1);
    expect(reduced.disabled).toContain("ambient");
    expect(reduced.easing).not.toContain("1.56");

    expect(resolveMotion({ ...prefs, respectSystem: false }, true).mode).toBe("full");
  });

  it("lista categorias desligadas", () => {
    const resolved = resolveMotion(
      { ...DEFAULT_MOTION_PREFERENCES, categories: { ...DEFAULT_MOTION_PREFERENCES.categories, lists: false } },
      false,
    );
    expect(resolved.disabled).toEqual(["lists"]);
  });
});

describe("applyMotion", () => {
  it("define atributos e variáveis no elemento", () => {
    const root = document.createElement("html");
    applyMotion(root, resolveMotion({ ...DEFAULT_MOTION_PREFERENCES, preset: "zoom", speed: 0.5 }, false));
    expect(root.dataset.motion).toBe("full");
    expect(root.dataset.motionOff).toBe("");
    expect(root.style.getPropertyValue("--motion-factor")).toBe("2");
    expect(root.style.getPropertyValue("--motion-enter-scale")).toBe("0.95");
  });

  it("é refletido no documento", () => {
    applyMotion(
      document.documentElement,
      resolveMotion({ ...DEFAULT_MOTION_PREFERENCES, categories: { ...DEFAULT_MOTION_PREFERENCES.categories, overlays: false } }, false),
    );
    expect(isMotionCategoryEnabledInDocument("overlays")).toBe(false);
    expect(isMotionCategoryEnabledInDocument("pages")).toBe(true);
    applyMotion(document.documentElement, resolveMotion({ ...DEFAULT_MOTION_PREFERENCES, enabled: false }, false));
    expect(isMotionCategoryEnabledInDocument("pages")).toBe(false);
  });
});

describe("persistência", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMotionPreferences();
  });

  it("salva, notifica e mantém a mesma referência entre leituras", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMotionPreferences(listener);
    updateMotionPreferences({ speed: 1.5, categories: { ambient: false } });
    expect(listener).toHaveBeenCalledTimes(1);
    const prefs = getMotionPreferences();
    expect(prefs.speed).toBe(1.5);
    expect(prefs.categories.ambient).toBe(false);
    expect(prefs.categories.pages).toBe(true);
    expect(getMotionPreferences()).toBe(prefs);
    expect(JSON.parse(window.localStorage.getItem(MOTION_STORAGE_KEY) ?? "{}").speed).toBe(1.5);
    unsubscribe();
  });

  it("ignora JSON corrompido", () => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, "{oops");
    expect(getMotionPreferences()).toEqual(DEFAULT_MOTION_PREFERENCES);
  });
});
