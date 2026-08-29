import { describe, it, expect } from "vitest";
import { PF2E_RACES } from "../pf2e-races";

describe("Pathfinder 2e Ancestries / Races Catalog", () => {
  it("should contain all 14 official Pathfinder 2e ancestries", () => {
    expect(PF2E_RACES).toHaveLength(14);

    const expectedKeys = [
      "dwarf",
      "elf",
      "gnome",
      "goblin",
      "halfling",
      "human",
      "leshy",
      "orc",
      "catfolk",
      "kobold",
      "ratfolk",
      "tengu",
      "automaton",
      "fetchling",
    ];

    const actualKeys = PF2E_RACES.map((r) => r.key);
    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  it("should have valid attributes, HP bonus, speed, size, traits, and heritages for every ancestry", () => {
    for (const race of PF2E_RACES) {
      expect(race.key).toBeTruthy();
      expect(race.name).toBeTruthy();
      expect(race.description).toBeTruthy();
      expect(race.hitPointsBonus).toBeGreaterThanOrEqual(6);
      expect(race.hitPointsBonus).toBeLessThanOrEqual(12);
      expect(race.speed).toBeGreaterThanOrEqual(20);
      expect(race.speed).toBeLessThanOrEqual(35);
      expect(["Médio", "Pequeno"]).toContain(race.size);

      expect(race.attributeBonuses).toBeDefined();
      expect(typeof race.attributeBonuses).toBe("object");

      expect(Array.isArray(race.languages)).toBe(true);
      expect(race.languages.length).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(race.traits)).toBe(true);
      expect(race.traits.length).toBeGreaterThanOrEqual(2);
      for (const trait of race.traits) {
        expect(trait.name).toBeTruthy();
      }

      expect(Array.isArray(race.heritages)).toBe(true);
      expect(race.heritages.length).toBeGreaterThanOrEqual(2);
      for (const heritage of race.heritages) {
        expect(heritage.name).toBeTruthy();
      }
    }
  });
});
