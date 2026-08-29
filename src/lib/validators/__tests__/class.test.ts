import { describe, it, expect } from "vitest";
import { createClassSchema, createClassBenefitSchema, updateClassSchema } from "../class";

describe("Class Validator Schemas", () => {
  it("should validate a simple class creation payload", () => {
    const payload = {
      name: "Guerreiro",
      description: "Mestre das armas",
      initialItems: [
        { name: "Espada Longa", quantity: 1, description: "Arma marcial" },
      ],
      proficiencies: {
        weapons: ["Espadas", "Machados"],
        armor: ["Pesada"],
      },
    };

    const result = createClassSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Guerreiro");
      expect(result.data.initialItems).toHaveLength(1);
    }
  });

  it("should validate class creation with rich 20-level benefits", () => {
    const levelBenefits = Array.from({ length: 20 }, (_, idx) => {
      const level = idx + 1;
      const isKeyLevel = [4, 8, 12, 16, 19].includes(level);
      return {
        level,
        benefits: {
          hp_bonus: 10,
          mana_bonus: 0,
          attribute_bonuses: isKeyLevel ? { forca: 1 } : undefined,
          extra_trained_skills: level === 1 ? 2 : undefined,
          advantages: level === 1 ? ["Ataque Poderoso"] : undefined,
          description: `Nível ${level} de progressão do guerreiro`,
        },
      };
    });

    const payload = {
      name: "Paladino Sagrado",
      description: "Guerreiro devoto com magia divina",
      initialItems: [
        { name: "Martelo de Guerra", quantity: 1 },
        { name: "Símbolo Sagrado", quantity: 1 },
      ],
      proficiencies: {
        weapons: ["Armas marciais"],
        armor: ["Todas"],
        languages: ["Comum", "Celestial"],
        tools: ["Kit de Primeiros Socorros"],
      },
      levelBenefits,
    };

    const result = createClassSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.levelBenefits).toHaveLength(20);
      expect(result.data.levelBenefits?.[0].level).toBe(1);
      expect(result.data.levelBenefits?.[0].benefits.hp_bonus).toBe(10);
      expect(result.data.levelBenefits?.[3].benefits.attribute_bonuses?.forca).toBe(1);
    }
  });

  it("should reject invalid level numbers in benefits", () => {
    const invalidBenefit = {
      level: 25, // Above max 20
      benefits: { hp_bonus: 8 },
    };

    const result = createClassBenefitSchema.safeParse(invalidBenefit);
    expect(result.success).toBe(false);
  });

  it("should reject class names with less than 2 characters", () => {
    const result = createClassSchema.safeParse({
      name: "A",
    });
    expect(result.success).toBe(false);
  });
});
