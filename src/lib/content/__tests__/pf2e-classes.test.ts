import { describe, it, expect } from "vitest";
import { PF2E_CLASSES } from "../pf2e-classes";

describe("Pathfinder 2e Classes Catalog", () => {
  it("should contain all 23 official Pathfinder 2e classes", () => {
    expect(PF2E_CLASSES).toHaveLength(23);

    const expectedKeys = [
      "alchemist", "barbarian", "bard", "champion", "cleric", "druid",
      "fighter", "gunslinger", "inventor", "investigator", "kineticist",
      "magus", "monk", "oracle", "psychic", "ranger", "rogue",
      "sorcerer", "summoner", "swashbuckler", "thaumaturge", "witch", "wizard"
    ];

    const actualKeys = PF2E_CLASSES.map((c) => c.key);
    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  it("should have valid structure, proficiencies, and 20 progression levels for every class", () => {
    for (const cls of PF2E_CLASSES) {
      expect(cls.key).toBeTruthy();
      expect(cls.name).toBeTruthy();
      expect(cls.description).toBeTruthy();
      expect(cls.hpPerLevel).toBeGreaterThanOrEqual(6);
      expect(cls.hpPerLevel).toBeLessThanOrEqual(12);
      expect(cls.keyAttribute).toBeTruthy();

      expect(cls.proficiencies).toBeDefined();
      expect(Array.isArray(cls.proficiencies.weapons)).toBe(true);

      expect(Array.isArray(cls.initialItems)).toBe(true);
      expect(cls.initialItems.length).toBeGreaterThanOrEqual(1);

      expect(cls.levels).toHaveLength(20);

      // Verify level numbering 1 to 20
      for (let i = 0; i < 20; i++) {
        const lvl = cls.levels[i];
        expect(lvl.level).toBe(i + 1);
        expect(lvl.hpBonus).toBe(cls.hpPerLevel);
        expect(typeof lvl.description).toBe("string");
      }
    }
  });

  it("should assign mana progression to spellcasters and 0 mana to pure non-casters", () => {
    const casters = ["bard", "cleric", "druid", "magus", "oracle", "psychic", "sorcerer", "summoner", "witch", "wizard"];
    const pureMartials = ["barbarian", "fighter", "gunslinger", "rogue", "swashbuckler"];

    for (const casterKey of casters) {
      const caster = PF2E_CLASSES.find((c) => c.key === casterKey);
      expect(caster).toBeDefined();
      expect(caster!.levels[0].manaBonus).toBeGreaterThan(0);
    }

    for (const martialKey of pureMartials) {
      const martial = PF2E_CLASSES.find((c) => c.key === martialKey);
      expect(martial).toBeDefined();
      expect(martial!.levels[0].manaBonus).toBe(0);
    }
  });
});
