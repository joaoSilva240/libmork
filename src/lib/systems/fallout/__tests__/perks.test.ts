import { describe, it, expect } from "vitest";
import { getFalloutPerkRequirementText, normalizeFalloutPerk } from "../rules";
import type { FalloutCharacterPerk } from "../types";
import {
  createFalloutCharacterSchema,
  updateFalloutCharacterSchema,
} from "../validators";

describe("Fallout Perks Normalization", () => {
  it("converte string legada em FalloutCharacterPerk com rank 1", () => {
    const perk = normalizeFalloutPerk("Action Boy");
    expect(perk).toEqual({
      name: "Action Boy",
      rank: 1,
    });
  });

  it("mantém objeto FalloutCharacterPerk intacto garantindo rank mínimo de 1", () => {
    const input: FalloutCharacterPerk = {
      name: "Gun Nut",
      rank: 2,
      maxRank: 4,
      description: "Permite criar mods de armas.",
      requirements: "INT 6",
    };
    const perk = normalizeFalloutPerk(input);
    expect(perk).toEqual(input);
  });

  it("não limita o rank ao maxRank (validação é informativa)", () => {
    const perk = normalizeFalloutPerk({ name: "Gun Nut", rank: 5, maxRank: 4 });
    expect(perk.rank).toBe(5);
  });

  it("assume rank 1 quando o objeto não informa rank", () => {
    const perk = normalizeFalloutPerk({ name: "Lady Killer" } as FalloutCharacterPerk);
    expect(perk).toEqual({ name: "Lady Killer", rank: 1 });
  });
});

describe("Fallout Perks Validators", () => {
  const baseInput = {
    name: "Sobrevivente",
    attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
  };

  it("aceita perks legados como string[] na criação", () => {
    const parsed = createFalloutCharacterSchema.parse({
      ...baseInput,
      perks: ["Action Boy", "Fortune Finder"],
    });
    expect(parsed.perks).toEqual(["Action Boy", "Fortune Finder"]);
  });

  it("aceita perks estruturados na criação", () => {
    const parsed = createFalloutCharacterSchema.parse({
      ...baseInput,
      perks: [{ name: "Gun Nut", rank: 2, maxRank: 4, requirements: "INT 6" }],
    });
    expect(parsed.perks).toEqual([
      { name: "Gun Nut", rank: 2, maxRank: 4, requirements: "INT 6" },
    ]);
  });

  it("aceita lista mista de strings e objetos na criação", () => {
    const parsed = createFalloutCharacterSchema.parse({
      ...baseInput,
      perks: ["Action Boy", { name: "Gun Nut", rank: 1 }],
    });
    expect(parsed.perks).toHaveLength(2);
  });

  it("rejeita perk sem nome ou com tipo inválido", () => {
    expect(
      createFalloutCharacterSchema.safeParse({ ...baseInput, perks: [42] }).success,
    ).toBe(false);
    expect(
      createFalloutCharacterSchema.safeParse({ ...baseInput, perks: [{ rank: 1 }] }).success,
    ).toBe(false);
    expect(
      createFalloutCharacterSchema.safeParse({ ...baseInput, perks: [{ name: "  ", rank: 1 }] })
        .success,
    ).toBe(false);
  });

  it("aceita perks legados e estruturados na atualização", () => {
    expect(
      updateFalloutCharacterSchema.safeParse({ perks: ["Action Boy"] }).success,
    ).toBe(true);
    expect(
      updateFalloutCharacterSchema.safeParse({
        perks: [{ name: "Gun Nut", rank: 3, maxRank: 4 }],
      }).success,
    ).toBe(true);
    expect(updateFalloutCharacterSchema.safeParse({ perks: [null] }).success).toBe(false);
  });

  it("mantém perks ausente como undefined na atualização", () => {
    expect(updateFalloutCharacterSchema.parse({}).perks).toBeUndefined();
  });

  it("preserva strings legadas fora dos limites atuais sem reescrevê-las", () => {
    const longName = "A".repeat(140);
    const parsed = updateFalloutCharacterSchema.parse({
      perks: ["", "  ", longName],
    });
    expect(parsed.perks).toEqual(["", "  ", longName]);
  });
});

describe("getFalloutPerkRequirementText", () => {
  /** Reproduz o payload real do compendio: os 7 atributos presentes, 0 = sem exigencia. */
  function requirementsEx(attributes: Record<string, number>, level = 1) {
    return {
      attributes: Object.fromEntries(
        ["str", "per", "end", "cha", "int", "agi", "luc"].map((key) => [
          key,
          { value: attributes[key] ?? 0 },
        ]),
      ),
      level,
    };
  }

  it("traduz requirementsEx do compendio para os rotulos PT-BR (Awareness: PER 7)", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: requirementsEx({ per: 7 }),
      }),
    ).toBe("PER 7");
  });

  it("inclui o nivel minimo quando maior que 1 (Fortune Finder: SOR 5, Nivel 2)", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: requirementsEx({ luc: 5 }, 2),
      }),
    ).toBe("SOR 5, Nível 2");
  });

  it("lista varios atributos na ordem S.P.E.C.I.A.L. (Gun Nut: INT 6, Nivel 2)", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: requirementsEx({ str: 5, int: 6 }, 2),
      }),
    ).toBe("FOR 5, INT 6, Nível 2");
  });

  it("retorna null quando o perk nao tem exigencias (Action Boy)", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: requirementsEx({}, 1),
      }),
    ).toBeNull();
  });

  it("cobre perks exigindo apenas nivel (Life Giver: Nivel 5)", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: requirementsEx({}, 5),
      }),
    ).toBe("Nível 5");
  });

  it("usa o texto legado quando requirementsEx esta ausente", () => {
    expect(getFalloutPerkRequirementText({ requirements: "LCK 5, Level 2+" })).toBe(
      "LCK 5, Level 2+",
    );
  });

  it("usa o texto legado quando requirementsEx nao traz exigencias", () => {
    expect(
      getFalloutPerkRequirementText({
        requirements: "  INT 6  ",
        requirementsEx: requirementsEx({}, 1),
      }),
    ).toBe("INT 6");
  });

  it("retorna null sem fonte de requisitos", () => {
    expect(getFalloutPerkRequirementText(null)).toBeNull();
    expect(getFalloutPerkRequirementText(undefined)).toBeNull();
    expect(getFalloutPerkRequirementText({})).toBeNull();
    expect(getFalloutPerkRequirementText({ requirements: "   " })).toBeNull();
  });

  it("ignora requirementsEx malformado sem lancar erro", () => {
    expect(
      getFalloutPerkRequirementText({ requirements: null, requirementsEx: "corrompido" }),
    ).toBeNull();
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: { attributes: null, level: "2" },
      }),
    ).toBeNull();
    expect(
      getFalloutPerkRequirementText({
        requirements: null,
        requirementsEx: { attributes: { int: { value: "6" }, per: 7 } },
      }),
    ).toBeNull();
  });
});
