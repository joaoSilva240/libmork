import { describe, it, expect } from "vitest";
import {
  roll2d20,
  evaluateCombatDieFace,
  rollCombatDice,
  calculateHitLocation,
  calculateMaxHp,
  calculateEffectiveMaxHp,
  calculateDefense,
  calculateInitiative,
  calculateMeleeDamageBonus,
  calculateCarryWeightMax,
  calculateEncumbranceLevel,
  calculateNextLevelXp,
  createInitialFalloutCharacter,
  applyFalloutConsumable,
  getMaxFalloutPerks,
  applyModToWeapon,
  removeModFromWeapon,
  resolveStartingItems,
} from "../rules";

describe("Fallout 2d20 — Motor de Regras (Rules Engine)", () => {
  describe("roll2d20 (Teste de Atributo + Perícia)", () => {
    it("resolve rolagens simples de 2d20 com Target Number = Atributo + Perícia", () => {
      // TN = 7 (AGI) + 3 (Small Guns) = 10
      // Dados: [8, 14] -> 8 <= 10 (1 sucesso), 14 > 10 (0 sucesso)
      const result = roll2d20(
        {
          attributeValue: 7,
          skillRank: 3,
          isTagSkill: false,
          difficulty: 1,
        },
        [8, 14],
      );

      expect(result.targetNumber).toBe(10);
      expect(result.criticalThreshold).toBe(1);
      expect(result.totalSuccesses).toBe(1);
      expect(result.totalComplications).toBe(0);
      expect(result.isSuccess).toBe(true);
      expect(result.apGenerated).toBe(0); // 1 sucesso - dificuldade 1 = 0 AP
    });

    it("gera 2 sucessos em dados <= skillRank quando for Tag Skill", () => {
      // TN = 8 (INT) + 3 (Science) = 11. Tag Skill ativa!
      // Critical threshold = 3.
      // Dados: [3, 7] -> 3 <= 3 (crítico = 2 sucessos), 7 <= 11 (1 sucesso). Total = 3 sucessos!
      const result = roll2d20(
        {
          attributeValue: 8,
          skillRank: 3,
          isTagSkill: true,
          difficulty: 1,
        },
        [3, 7],
      );

      expect(result.criticalThreshold).toBe(3);
      expect(result.totalSuccesses).toBe(3);
      expect(result.isSuccess).toBe(true);
      expect(result.apGenerated).toBe(2); // 3 sucessos - 1 dificuldade = +2 AP!
    });

    it("gera complicações quando o dado for >= complicationThreshold (padrão 20)", () => {
      const result = roll2d20(
        {
          attributeValue: 6,
          skillRank: 2,
          isTagSkill: false,
          difficulty: 1,
          complicationThreshold: 19, // ambiente perigoso (19-20)
        },
        [19, 20],
      );

      expect(result.totalSuccesses).toBe(0);
      expect(result.totalComplications).toBe(2);
      expect(result.isSuccess).toBe(false);
      expect(result.apGenerated).toBe(0);
    });

    it("suporta dados extras comprados com AP/Sorte até o teto de 5d20", () => {
      const result = roll2d20(
        {
          attributeValue: 9,
          skillRank: 2,
          extraDiceCount: 3, // 2 base + 3 extras = 5 dados!
          difficulty: 2,
        },
        [4, 8, 10, 15, 20],
      );

      expect(result.dice).toHaveLength(5);
      // TN = 11. Dados [4, 8, 10] são <= 11 (3 sucessos). [15] falha. [20] complicação.
      expect(result.totalSuccesses).toBe(3);
      expect(result.totalComplications).toBe(1);
      expect(result.isSuccess).toBe(true);
      expect(result.apGenerated).toBe(1); // 3 sucessos - dificuldade 2 = 1 AP
    });
  });

  describe("rollCombatDice (Dados de Combate — DC)", () => {
    it("mapeia as faces oficiais do dado de combate do Fallout", () => {
      expect(evaluateCombatDieFace(1)).toEqual({ dieValue: 1, damage: 1, effect: false });
      expect(evaluateCombatDieFace(2)).toEqual({ dieValue: 2, damage: 2, effect: false });
      expect(evaluateCombatDieFace(3)).toEqual({ dieValue: 3, damage: 0, effect: false });
      expect(evaluateCombatDieFace(4)).toEqual({ dieValue: 4, damage: 0, effect: false });
      expect(evaluateCombatDieFace(5)).toEqual({ dieValue: 5, damage: 1, effect: true });
      expect(evaluateCombatDieFace(6)).toEqual({ dieValue: 6, damage: 1, effect: true });
    });

    it("calcula dano total e total de efeitos acumulados em uma rolagem", () => {
      // Dados: [1, 2, 3, 5, 6] -> Danos: 1 + 2 + 0 + 1 + 1 = 5 danos. Efeitos: 5 e 6 = 2 efeitos!
      const result = rollCombatDice(5, [1, 2, 3, 5, 6]);

      expect(result.totalDamage).toBe(5);
      expect(result.totalEffects).toBe(2);
      expect(result.diceCount).toBe(5);
    });
  });

  describe("calculateHitLocation (Localização de Dano)", () => {
    it("resolve partes do corpo conforme tabela d20 oficial", () => {
      expect(calculateHitLocation(1).location).toBe("head");
      expect(calculateHitLocation(2).location).toBe("head");
      expect(calculateHitLocation(5).location).toBe("torso");
      expect(calculateHitLocation(10).location).toBe("armL");
      expect(calculateHitLocation(13).location).toBe("armR");
      expect(calculateHitLocation(16).location).toBe("legL");
      expect(calculateHitLocation(20).location).toBe("legR");
    });
  });

  describe("Estatísticas Derivadas Oficiais", () => {
    it("calcula Max HP = END + LUC + (Nível - 1)", () => {
      expect(calculateMaxHp(7, 5, 1)).toBe(12);
      expect(calculateMaxHp(8, 6, 3)).toBe(16); // 8 + 6 + 2 = 16
    });

    it("calcula HP Máximo Efetivo subtraindo a radiação acumulada", () => {
      const maxHp = 16;
      expect(calculateEffectiveMaxHp(maxHp, 4)).toBe(12);
      expect(calculateEffectiveMaxHp(maxHp, 16)).toBe(0); // Morte por radiação
    });

    it("calcula Defesa baseada em Agilidade (AGI <= 8 ? 1 : 2)", () => {
      expect(calculateDefense(7)).toBe(1);
      expect(calculateDefense(8)).toBe(1);
      expect(calculateDefense(9)).toBe(2);
      expect(calculateDefense(10, 1)).toBe(3); // com bônus de cobertura/perk
    });

    it("calcula Iniciativa = PER + AGI", () => {
      expect(calculateInitiative(6, 7)).toBe(13);
    });

    it("calcula bônus de dados de combate de Força", () => {
      expect(calculateMeleeDamageBonus(5)).toBe(0);
      expect(calculateMeleeDamageBonus(7)).toBe(1);
      expect(calculateMeleeDamageBonus(10)).toBe(2);
      expect(calculateMeleeDamageBonus(12)).toBe(3);
    });

    it("calcula capacidade de carga e níveis de sobrecarga", () => {
      const maxWeight = calculateCarryWeightMax(6); // 6 * 10 + 150 = 210 lbs
      expect(maxWeight).toBe(210);

      expect(calculateEncumbranceLevel(200, 210)).toBe(0);
      expect(calculateEncumbranceLevel(230, 210)).toBe(1); // 20 lbs extras = nível 1
      expect(calculateEncumbranceLevel(320, 210)).toBe(3); // 110 lbs extras = nível 3
    });

    it("calcula XP necessário para o próximo nível", () => {
      expect(calculateNextLevelXp(1)).toBe(100); // Nível 1 -> 2: 100 XP
      expect(calculateNextLevelXp(2)).toBe(300); // Nível 2 -> 3: 300 XP
      expect(calculateNextLevelXp(3)).toBe(600); // Nível 3 -> 4: 600 XP
    });
  });

  describe("createInitialFalloutCharacter", () => {
    it("inicializa personagem com todas as 17 perícias, membros e derivações corretas", () => {
      const char = createInitialFalloutCharacter(
        {
          name: "The Vault Dweller",
          origin: "vault_dweller",
          level: 1,
          xp: 0,
          attributes: {
            str: 6,
            per: 7,
            end: 8,
            cha: 4,
            int: 6,
            agi: 9,
            luc: 5,
          },
          tagSkills: ["small_guns", "science", "lockpick"],
          perks: [],
          caps: 50,
        },
        "user-1",
      );

      expect(char.name).toBe("The Vault Dweller");
      expect(char.hpMax).toBe(13); // 8 + 5 + 0 = 13
      expect(char.hpCurrent).toBe(13);
      expect(char.defense).toBe(2); // AGI 9
      expect(char.initiative).toBe(16); // PER 7 + AGI 9
      expect(char.carryWeightMax).toBe(210); // STR 6 * 10 + 150
      expect(char.caps).toBe(50);
      expect(char.skills.small_guns.isTag).toBe(true);
      expect(char.skills.athletics.isTag).toBe(false);
      expect(char.bodyParts.head.label).toBe("Cabeça");
      expect(char.bodyParts.torso.label).toBe("Tronco");
    });
  });
});

describe("applyFalloutConsumable", () => {
  function charWithConsumable(overrides: any = {}): any {
    return {
      id: "c1", campaignId: null, ownerId: "o", name: "Test", origin: "vault_dweller",
      level: 1, xp: 0,
      attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
      skills: {}, tagSkills: [],
      hpCurrent: 5, hpMax: 10, radiation: 3, luckPointsCurrent: 5,
      defense: 1, initiative: 10, meleeDamageBonus: 0,
      carryWeightMax: 200, carryWeightCurrent: 0, encumbranceLevel: 0, caps: 0,
      bodyParts: {}, items: [
        { id: "item-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, radsCured: 0, quantity: 2, weight: 0.5, costCaps: 25 },
      ],
      perks: [], createdAt: "", updatedAt: "",
      ...overrides,
    };
  }

  it("cura HP capped em hpMax e decrementa quantity", () => {
    const result = applyFalloutConsumable(charWithConsumable(), "item-1");
    expect(result).not.toBeNull();
    expect(result!.hpCurrent).toBe(9);
    expect((result!.items[0] as any).quantity).toBe(1);
  });

  it("cap hpCurrent em hpMax", () => {
    const char = charWithConsumable({ hpCurrent: 9 });
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.hpCurrent).toBe(10);
  });

  it("cura radiacao com floor 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).radsCured = 10;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.radiation).toBe(0);
  });

  it("inflige radiacao", () => {
    const char = charWithConsumable();
    (char.items[0] as any).radsInflicted = 2;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.radiation).toBe(5);
  });

  it("remove item quando quantity chega a 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).quantity = 1;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.items).toHaveLength(0);
  });

  it("retorna null para quantity 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).quantity = 0;
    expect(applyFalloutConsumable(char, "item-1")).toBeNull();
  });

  it("retorna null para item inexistente", () => {
    expect(applyFalloutConsumable(charWithConsumable(), "nope")).toBeNull();
  });

  it("retorna null para item que nao e consumable", () => {
    const char = charWithConsumable();
    char.items = [{ id: "w1", name: "Gun", type: "weapon", weight: 3, costCaps: 50 }];
    expect(applyFalloutConsumable(char, "w1")).toBeNull();
  });
});

describe("getMaxFalloutPerks", () => {
  it("nivel 1 e 2 permitem 1 perk", () => {
    expect(getMaxFalloutPerks(1)).toBe(1);
    expect(getMaxFalloutPerks(2)).toBe(1);
  });

  it("nivel 3 e 4 permitem 2 perks", () => {
    expect(getMaxFalloutPerks(3)).toBe(2);
    expect(getMaxFalloutPerks(4)).toBe(2);
  });

  it("nivel 5 permite 3 perks", () => {
    expect(getMaxFalloutPerks(5)).toBe(3);
  });
});

describe("applyModToWeapon / removeModFromWeapon", () => {
  const weapon: any = {
    id: "w1", name: "10mm", type: "weapon", damageDiceRating: 4,
    damageType: "physical", damageEffects: [], qualities: ["reliable"],
    ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close",
    weight: 4, costCaps: 50, equipped: true, skill: "small_guns",
    stashed: false, installedMods: [], installedModsData: {},
  };
  const mod: any = {
    id: "m1", name: "Long Barrel", type: "mod", quantity: 1,
    weight: 1, costCaps: 20, stashed: false, modTarget: "weapon",
    modEffects: { damageBonus: 1, fireRateBonus: -1, qualitiesAdd: ["accurate"], weightDelta: 1 },
  };

  it("aplica bonus de dano, fire rate, qualities e peso", () => {
    const result = applyModToWeapon(weapon, mod);
    expect(result.damageDiceRating).toBe(5);
    expect(result.fireRate).toBe(1);
    expect(result.qualities).toContain("accurate");
    expect(result.qualities).toContain("reliable");
    expect(result.weight).toBe(5);
    expect(result.installedMods).toEqual(["m1"]);
    expect(result.installedModsData["m1"]).toEqual(mod.modEffects);
  });

  it("remove mod reverte efeitos", () => {
    const modded = applyModToWeapon(weapon, mod);
    const result = removeModFromWeapon(modded, mod);
    expect(result.damageDiceRating).toBe(4);
    expect(result.fireRate).toBe(2);
    expect(result.qualities).toEqual(["reliable"]);
    expect(result.weight).toBe(4);
    expect(result.installedMods).toEqual([]);
  });

  it("qualitiesRemove remove qualidade existente", () => {
    const removeMod: any = { ...mod, id: "m2", modEffects: { qualitiesRemove: ["reliable"] } };
    const result = applyModToWeapon(weapon, removeMod);
    expect(result.qualities).not.toContain("reliable");
  });

  it("fireRate nao fica negativo", () => {
    const bigMod: any = { ...mod, modEffects: { fireRateBonus: -10 } };
    const result = applyModToWeapon(weapon, bigMod);
    expect(result.fireRate).toBe(0);
  });
});

describe("resolveStartingItems", () => {
  it("retorna array vazio para mister_handy", () => {
    const items = resolveStartingItems("mister_handy", () => null);
    expect(items).toEqual([]);
  });

  it("usa fallback quando catalogLookup retorna null", () => {
    const items = resolveStartingItems("vault_dweller", () => null);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].name).toBeTruthy();
  });

  it("usa catalogo quando disponivel", () => {
    const fakeCatalog = {
      id: "cat-1", name: "10mm Pistol", description: null,
      qualityDescription: null, imageUrl: null,
      sourceKey: "fallout:weapons:10mm_pistol",
      sourceData: { pack: "weapons", weight: 4, cost: 50, damage: { rating: 4 } },
    };
    const items = resolveStartingItems("vault_dweller", (key) =>
      key === "fallout:weapons:10mm_pistol" ? fakeCatalog : null,
    );
    const pistol = items.find((i) => i.name === "10mm Pistol");
    expect(pistol).toBeTruthy();
    expect(pistol!.type).toBe("weapon");
  });
});

describe("createInitialFalloutCharacter com items", () => {
  it("inclui items do input no personagem", () => {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
        tagSkills: [], perks: [], caps: 50,
        items: [{ id: "x1", name: "10mm Pistol", type: "weapon", weight: 4, costCaps: 50, damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 2, range: "close", equipped: false, skill: "small_guns", stashed: false, installedMods: [], installedModsData: {} }],
      } as any,
      "user-1",
    );
    expect(char.items).toHaveLength(1);
    expect(char.items[0].name).toBe("10mm Pistol");
  });
});
