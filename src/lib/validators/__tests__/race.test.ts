import { describe, it, expect } from "vitest";
import { createRaceSchema, updateRaceSchema, raceTraitSchema, raceHeritageSchema } from "../race";

describe("Race Validator Schemas", () => {
  it("should validate a simple race creation payload with defaults", () => {
    const payload = {
      name: "Humano",
      description: "Adaptáveis e ambiciosos",
    };

    const result = createRaceSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Humano");
      expect(result.data.speed).toBe(30);
      expect(result.data.size).toBe("Médio");
      expect(result.data.hitPointsBonus).toBe(0);
      expect(result.data.languages).toEqual([]);
      expect(result.data.traits).toEqual([]);
      expect(result.data.heritages).toEqual([]);
      expect(result.data.sourceSystem).toBe("custom");
    }
  });

  it("should validate full race creation with attributes, traits, heritages, and languages", () => {
    const payload = {
      name: "Elfo Nobre",
      description: "Graciosos e conectados com a natureza e magia.",
      speed: 30,
      size: "Médio",
      hitPointsBonus: 6,
      attributeBonuses: {
        destreza: 2,
        inteligencia: 1,
      },
      languages: ["Comum", "Élfico", "Silvestre"],
      traits: [
        { name: "Visão no Escuro", description: "Enxerga na escuridão até 18 metros." },
        { name: "Ancestralidade Feérica", description: "Vantagem contra ser encantado." },
      ],
      heritages: [
        { name: "Elfo da Floresta", description: "Velocidade base aumentada para 35 pés." },
        { name: "Alto Elfo", description: "Conhece um truque de magia arcana." },
      ],
      imageUrl: "https://example.com/elf.png",
      sourceSystem: "pf2e",
    };

    const result = createRaceSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Elfo Nobre");
      expect(result.data.speed).toBe(30);
      expect(result.data.hitPointsBonus).toBe(6);
      expect(result.data.attributeBonuses.destreza).toBe(2);
      expect(result.data.attributeBonuses.inteligencia).toBe(1);
      expect(result.data.languages).toHaveLength(3);
      expect(result.data.traits).toHaveLength(2);
      expect(result.data.heritages).toHaveLength(2);
      expect(result.data.sourceSystem).toBe("pf2e");
    }
  });

  it("should reject race names with less than 2 characters", () => {
    const result = createRaceSchema.safeParse({
      name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid trait or heritage without a name", () => {
    const invalidTrait = { name: "" };
    expect(raceTraitSchema.safeParse(invalidTrait).success).toBe(false);

    const invalidHeritage = { description: "Sem nome" };
    expect(raceHeritageSchema.safeParse(invalidHeritage).success).toBe(false);
  });

  it("should validate partial updates with updateRaceSchema", () => {
    const updatePayload = {
      speed: 35,
      description: "Nova descrição atualizada",
      attributeBonuses: {
        forca: 2,
      },
    };

    const result = updateRaceSchema.safeParse(updatePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.speed).toBe(35);
      expect(result.data.attributeBonuses?.forca).toBe(2);
    }
  });
});
