import { describe, it, expect } from "vitest";
import { calculateRest, REST_OPTIONS } from "@/lib/engine/rest";

describe("Rest Engine (calculateRest)", () => {
  it("exporta opções de descanso com rótulos e descrições em português", () => {
    expect(REST_OPTIONS.precarious.label).toBe("Descanso Precário");
    expect(REST_OPTIONS.mediocre.label).toBe("Descanso Medíocre");
    expect(REST_OPTIONS.comfortable.label).toBe("Descanso Confortável");
    expect(REST_OPTIONS.luxurious.label).toBe("Descanso Luxuoso");
  });

  describe("Fração de recuperação e arredondamento (Math.floor)", () => {
    it("calcula descanso Precário (1/8) com arredondamento para baixo", () => {
      // maxHp = 15 -> floor(15 / 8) = 1
      // maxMana = 15 -> floor(15 / 8) = 1
      // Vigor 10 -> mod 0
      const result = calculateRest({
        currentHp: 5,
        maxHp: 15,
        currentMana: 5,
        maxMana: 15,
        vigor: 10,
        restType: "precarious",
      });

      expect(result.hpFractionRecovery).toBe(1);
      expect(result.manaFractionRecovery).toBe(1);
      expect(result.vigorModifier).toBe(0);
      expect(result.hpRecovered).toBe(1);
      expect(result.manaRecovered).toBe(1);
      expect(result.newHp).toBe(6);
      expect(result.newMana).toBe(6);
    });

    it("calcula descanso Medíocre (1/4) com arredondamento para baixo", () => {
      // maxHp = 15 -> floor(15 / 4) = 3
      // maxMana = 15 -> floor(15 / 4) = 3
      // Vigor 10 -> mod 0
      const result = calculateRest({
        currentHp: 5,
        maxHp: 15,
        currentMana: 5,
        maxMana: 15,
        vigor: 10,
        restType: "mediocre",
      });

      expect(result.hpFractionRecovery).toBe(3);
      expect(result.manaFractionRecovery).toBe(3);
      expect(result.hpRecovered).toBe(3);
      expect(result.manaRecovered).toBe(3);
      expect(result.newHp).toBe(8);
      expect(result.newMana).toBe(8);
    });

    it("calcula descanso Confortável (1/2) com arredondamento para baixo", () => {
      // maxHp = 15 -> floor(15 / 2) = 7
      // maxMana = 15 -> floor(15 / 2) = 7
      // Vigor 10 -> mod 0
      const result = calculateRest({
        currentHp: 2,
        maxHp: 15,
        currentMana: 2,
        maxMana: 15,
        vigor: 10,
        restType: "comfortable",
      });

      expect(result.hpFractionRecovery).toBe(7);
      expect(result.manaFractionRecovery).toBe(7);
      expect(result.hpRecovered).toBe(7);
      expect(result.manaRecovered).toBe(7);
      expect(result.newHp).toBe(9);
      expect(result.newMana).toBe(9);
    });

    it("calcula descanso Luxuoso restaurando o total até o máximo", () => {
      const result = calculateRest({
        currentHp: 1,
        maxHp: 20,
        currentMana: 2,
        maxMana: 10,
        vigor: 10,
        restType: "luxurious",
      });

      expect(result.hpFractionRecovery).toBe(20);
      expect(result.manaFractionRecovery).toBe(10);
      expect(result.newHp).toBe(20);
      expect(result.newMana).toBe(10);
      expect(result.hpRecovered).toBe(19);
      expect(result.manaRecovered).toBe(8);
    });
  });

  describe("Modificadores de Vigor", () => {
    it("aplica modificador de Vigor positivo (+1 com Vigor 12, +2 com Vigor 14)", () => {
      // Vigor 12 -> mod +1
      // Medíocre: 20 / 4 = 5. Total = 5 + 1 = 6
      const result1 = calculateRest({
        currentHp: 5,
        maxHp: 20,
        currentMana: 5,
        maxMana: 20,
        vigor: 12,
        restType: "mediocre",
      });

      expect(result1.vigorModifier).toBe(1);
      expect(result1.hpRecovered).toBe(6);
      expect(result1.manaRecovered).toBe(6);
      expect(result1.newHp).toBe(11);
      expect(result1.newMana).toBe(11);

      // Vigor 14 -> mod +2
      const result2 = calculateRest({
        currentHp: 5,
        maxHp: 20,
        currentMana: 5,
        maxMana: 20,
        vigor: 14,
        restType: "mediocre",
      });

      expect(result2.vigorModifier).toBe(2);
      expect(result2.hpRecovered).toBe(7);
      expect(result2.manaRecovered).toBe(7);
      expect(result2.newHp).toBe(12);
      expect(result2.newMana).toBe(12);
    });

    it("aplica modificador de Vigor negativo (-1 com Vigor 8, -2 com Vigor 6)", () => {
      // Vigor 8 -> mod -1
      // Confortável: 20 / 2 = 10. Total = 10 - 1 = 9
      const result1 = calculateRest({
        currentHp: 5,
        maxHp: 20,
        currentMana: 5,
        maxMana: 20,
        vigor: 8,
        restType: "comfortable",
      });

      expect(result1.vigorModifier).toBe(-1);
      expect(result1.hpRecovered).toBe(9);
      expect(result1.manaRecovered).toBe(9);
      expect(result1.newHp).toBe(14);
      expect(result1.newMana).toBe(14);

      // Vigor 6 -> mod -2
      // Confortável: 20 / 2 = 10. Total = 10 - 2 = 8
      const result2 = calculateRest({
        currentHp: 5,
        maxHp: 20,
        currentMana: 5,
        maxMana: 20,
        vigor: 6,
        restType: "comfortable",
      });

      expect(result2.vigorModifier).toBe(-2);
      expect(result2.hpRecovered).toBe(8);
      expect(result2.manaRecovered).toBe(8);
      expect(result2.newHp).toBe(13);
      expect(result2.newMana).toBe(13);
    });
  });

  describe("Clamps e limites", () => {
    it("limita ao máximo quando a recuperação ultrapassaria maxHp e maxMana (clamp superior)", () => {
      const result = calculateRest({
        currentHp: 18,
        maxHp: 20,
        currentMana: 19,
        maxMana: 20,
        vigor: 14, // mod +2
        restType: "comfortable", // 10 + 2 = 12 de ganho teórico
      });

      expect(result.newHp).toBe(20);
      expect(result.newMana).toBe(20);
      expect(result.hpRecovered).toBe(2);
      expect(result.manaRecovered).toBe(1);
    });

    it("limita no máximo em descanso Luxuoso mesmo com modificador de vigor positivo", () => {
      const result = calculateRest({
        currentHp: 10,
        maxHp: 20,
        currentMana: 5,
        maxMana: 10,
        vigor: 16, // mod +3
        restType: "luxurious",
      });

      expect(result.newHp).toBe(20);
      expect(result.newMana).toBe(10);
      expect(result.hpRecovered).toBe(10);
      expect(result.manaRecovered).toBe(5);
    });

    it("nunca resulta em valor final negativo caso modificador negativo supere fração", () => {
      // maxHp = 8 -> Precário = 1. Vigor = 4 -> mod = -3.
      // target = 1 + (1 + -3) = -1.
      // clamp min(0) -> newHp = 0, hpRecovered = 0
      const result = calculateRest({
        currentHp: 1,
        maxHp: 8,
        currentMana: 1,
        maxMana: 8,
        vigor: 4,
        restType: "precarious",
      });

      expect(result.hpFractionRecovery).toBe(1);
      expect(result.vigorModifier).toBe(-3);
      expect(result.newHp).toBe(0);
      expect(result.newMana).toBe(0);
      expect(result.hpRecovered).toBe(0);
      expect(result.manaRecovered).toBe(0);
    });

    it("hpRecovered e manaRecovered informam 0 se já estava no máximo", () => {
      const result = calculateRest({
        currentHp: 20,
        maxHp: 20,
        currentMana: 10,
        maxMana: 10,
        vigor: 10,
        restType: "luxurious",
      });

      expect(result.newHp).toBe(20);
      expect(result.newMana).toBe(10);
      expect(result.hpRecovered).toBe(0);
      expect(result.manaRecovered).toBe(0);
    });
  });
});
