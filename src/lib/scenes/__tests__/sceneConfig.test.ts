import { describe, it, expect } from "vitest";
import {
  SCENE_VALUES,
  SCENE_ORDER,
  SCENES,
  SCENE_MATRIX,
  NEUTRAL_MODULES,
  modulesForScene,
  isSceneValue,
  sanitizeActiveScene,
} from "../sceneConfig";

describe("sceneConfig (issue #86, Fase 1)", () => {
  it("SCENE_ORDER cobre exatamente SCENE_VALUES, na ordem do header", () => {
    expect(SCENE_ORDER).toEqual(["combat", "interlude", "stealth", "investigation", "escape"]);
    expect([...SCENE_VALUES].sort()).toEqual([...SCENE_ORDER].sort());
  });

  it("toda cena tem meta completo (label PT-BR, icon, cores) e linha na matriz", () => {
    for (const value of SCENE_ORDER) {
      const meta = SCENES[value];
      expect(meta.value).toBe(value);
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon).toBeTruthy();
      expect(meta.activeClasses).toContain("text-");
      expect(meta.accentClasses).toContain("shadow-");
      expect(SCENE_MATRIX[value]).toBeDefined();
      expect(SCENE_MATRIX[value].carousel).toMatch(/^(neutral|visible|hidden)$/);
      expect(SCENE_MATRIX[value].combatBar).toMatch(/^(neutral|visible|hidden)$/);
      expect(SCENE_MATRIX[value].establishments).toMatch(/^(neutral|visible|hidden)$/);
    }
  });

  it("matriz reflete a spec: carrossel visível só em combate; estabelecimentos visíveis só em interlúdio", () => {
    expect(SCENE_MATRIX.combat.carousel).toBe("visible");
    expect(SCENE_MATRIX.interlude.carousel).toBe("hidden");
    expect(SCENE_MATRIX.stealth.carousel).toBe("hidden");
    expect(SCENE_MATRIX.investigation.carousel).toBe("hidden");
    expect(SCENE_MATRIX.escape.carousel).toBe("hidden");
    expect(SCENE_MATRIX.interlude.establishments).toBe("visible");
    expect(SCENE_MATRIX.combat.establishments).toBe("hidden");
    expect(SCENE_MATRIX.escape.establishments).toBe("hidden");
  });

  it("modulesForScene devolve neutro para Livre e a linha da cena quando ativa", () => {
    expect(modulesForScene(null)).toBe(NEUTRAL_MODULES);
    expect(modulesForScene("combat")).toBe(SCENE_MATRIX.combat);
  });

  it("isSceneValue aceita só os 5 valores e rejeita o resto", () => {
    expect(isSceneValue("combat")).toBe(true);
    expect(isSceneValue("escape")).toBe(true);
    expect(isSceneValue("luta")).toBe(false);
    expect(isSceneValue(null)).toBe(false);
    expect(isSceneValue(undefined)).toBe(false);
    expect(isSceneValue(42)).toBe(false);
  });

  it("sanitizeActiveScene normaliza desconhecidos para null (Livre)", () => {
    expect(sanitizeActiveScene("stealth")).toBe("stealth");
    expect(sanitizeActiveScene(null)).toBeNull();
    expect(sanitizeActiveScene("xyz")).toBeNull();
    expect(sanitizeActiveScene(123)).toBeNull();
  });
});
