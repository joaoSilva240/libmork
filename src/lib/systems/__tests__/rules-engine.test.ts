import { describe, it, expect } from "vitest";
import {
  getRulesEngineLabel,
  getCreationSystem,
  getCharacterNoun,
  getCharacterCreationHref,
} from "../rules-engine";

describe("rules-engine helpers", () => {
  it("mapeia rótulos legíveis para todos os motores", () => {
    expect(getRulesEngineLabel("d20_mod")).toBe("d20 + modificador");
    expect(getRulesEngineLabel("dual_d20_sum")).toBe("2d20 somado");
    expect(getRulesEngineLabel("missing_zero")).toBe("MISSING — Edição ZERO");
    expect(getRulesEngineLabel("fallout_2d20")).toBe("Fallout 2d20");
  });

  it("direciona a criação para o sistema correto da campanha", () => {
    expect(getCreationSystem("d20_mod")).toBe("libmork");
    expect(getCreationSystem("dual_d20_sum")).toBe("libmork");
    expect(getCreationSystem("missing_zero")).toBe("missing_zero");
    expect(getCreationSystem("fallout_2d20")).toBe("fallout_2d20");
  });

  it("usa o termo certo de ficha por sistema", () => {
    expect(getCharacterNoun("d20_mod").singular).toBe("personagem");
    expect(getCharacterNoun("missing_zero").singular).toBe("habitante");
    expect(getCharacterNoun("fallout_2d20").singular).toBe("sobrevivente");
    expect(getCharacterNoun("fallout_2d20").plural).toBe("sobreviventes");
  });

  it("monta a URL de criação já com sistema e campanha", () => {
    expect(getCharacterCreationHref("fallout_2d20", "camp-1")).toBe(
      "/player/characters/new?system=fallout_2d20&campaignId=camp-1",
    );
    expect(getCharacterCreationHref("missing_zero", "camp-2")).toBe(
      "/player/characters/new?system=missing_zero&campaignId=camp-2",
    );
    expect(getCharacterCreationHref("d20_mod")).toBe("/player/characters/new?system=libmork");
  });
});