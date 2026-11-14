import { describe, it, expect } from "vitest";
import { recalculateFalloutDerived } from "../derived";
import type { FalloutCharacter, FalloutBodyPart, FalloutItem } from "../types";
import { FALLOUT_BODY_LOCATIONS } from "../types";

function buildCharacter(overrides: Partial<FalloutCharacter> = {}): FalloutCharacter {
  const bodyParts = {} as Record<string, FalloutBodyPart>;
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    bodyParts[loc] = {
      location: loc,
      label: loc,
      minRoll: 1,
      maxRoll: 20,
      injuries: [0, 0, 0],
      status: "healthy",
      resistances: { physical: 0, energy: 0, radiation: 0, poison: 0 },
    };
  }
  return {
    id: "test-char",
    campaignId: null,
    ownerId: "owner",
    name: "Test",
    origin: "vault_dweller",
    level: 1,
    xp: 0,
    attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
    skills: {} as any,
    tagSkills: [],
    hpCurrent: 10,
    hpMax: 10,
    radiation: 0,
    luckPointsCurrent: 5,
    defense: 1,
    initiative: 10,
    meleeDamageBonus: 0,
    carryWeightMax: 200,
    carryWeightCurrent: 0,
    encumbranceLevel: 0,
    caps: 0,
    bodyParts: bodyParts as any,
    items: [],
    perks: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("recalculateFalloutDerived — migracao legada", () => {
  it("converte injuries number para array de slots abertos", () => {
    const char = buildCharacter();
    (char.bodyParts.torso as any).injuries = 2;
    delete (char.bodyParts.torso as any).status;
    (char.bodyParts.torso as any).isCrippled = true;
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.injuries).toEqual([2, 2, 0]);
    expect(result.bodyParts.torso.status).toBe("crippled");
  });

  it("converte injuries 0 para array saudavel", () => {
    const char = buildCharacter();
    (char.bodyParts.head as any).injuries = 0;
    delete (char.bodyParts.head as any).status;
    (char.bodyParts.head as any).isCrippled = false;
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.head.injuries).toEqual([0, 0, 0]);
    expect(result.bodyParts.head.status).toBe("healthy");
  });

  it("preenche stashed/powered ausentes em apparel legado", () => {
    const legacyApparel = {
      id: "a1", name: "Combat Armor", type: "apparel",
      apparelType: "armor", locationsCovered: ["torso"],
      resistances: { physical: 2, energy: 1, radiation: 0, poison: 0 },
      weight: 10, costCaps: 50, equipped: true,
    } as any;
    const char = buildCharacter({ items: [legacyApparel] });
    const result = recalculateFalloutDerived(char);
    const item = result.items[0] as any;
    expect(item.stashed).toBe(false);
    expect(item.powered).toBe(false);
  });

  it("preenche shots ausentes em ammo legado", () => {
    const legacyAmmo = {
      id: "am1", name: "10mm Round", type: "ammo",
      quantity: 20, weight: 0.1, costCaps: 1,
    } as any;
    const char = buildCharacter({ items: [legacyAmmo] });
    const result = recalculateFalloutDerived(char);
    const item = result.items[0] as any;
    expect(item.shotsMax).toBe(1);
    expect(item.shotsCurrent).toBe(1);
    expect(item.stashed).toBe(false);
  });

  it("e idempotente — segunda chamada nao altera o resultado", () => {
    const char = buildCharacter();
    (char.bodyParts.torso as any).injuries = 1;
    delete (char.bodyParts.torso as any).status;
    const first = recalculateFalloutDerived(char);
    const second = recalculateFalloutDerived(first);
    expect(second).toEqual(first);
  });
});

describe("recalculateFalloutDerived — resistencias de apparel", () => {
  function apparel(overrides: Partial<any> = {}): any {
    return {
      id: `app-${Math.random().toString(36).slice(2)}`,
      name: "Test Armor",
      type: "apparel",
      apparelType: "armor",
      locationsCovered: ["torso", "armL", "armR", "legL", "legR"],
      resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 },
      weight: 10, costCaps: 50, equipped: true, stashed: false, powered: false,
      ...overrides,
    };
  }

  it("armor equipado aplica resistencias nas localizacoes cobertas", () => {
    const char = buildCharacter({ items: [apparel()] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(3);
    expect(result.bodyParts.torso.resistances.energy).toBe(2);
    expect(result.bodyParts.head.resistances.physical).toBe(0);
  });

  it("powerArmor energizada substitui armor normal", () => {
    const pa = apparel({
      apparelType: "powerArmor", powered: true,
      resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 },
      locationsCovered: ["head", "torso", "armL", "armR", "legL", "legR"],
    });
    const normal = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 } });
    const char = buildCharacter({ items: [normal, pa] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(8);
  });

  it("powerArmor NAO energizada nao aplica resistencias", () => {
    const pa = apparel({
      apparelType: "powerArmor", powered: false,
      resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 },
    });
    const char = buildCharacter({ items: [pa] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("outfit so aplica se nenhum armor/powerArmor cobriu a localizacao", () => {
    const outfit = apparel({
      apparelType: "outfit",
      resistances: { physical: 1, energy: 1, radiation: 0, poison: 0 },
    });
    const armor = apparel();
    const char = buildCharacter({ items: [outfit, armor] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(3);
  });

  it("outfit aplica quando nao ha armor", () => {
    const outfit = apparel({
      apparelType: "outfit",
      resistances: { physical: 1, energy: 1, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [outfit] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(1);
  });

  it("headgear so aplica em head", () => {
    const hat = apparel({
      apparelType: "headgear",
      locationsCovered: ["head"],
      resistances: { physical: 2, energy: 0, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [hat] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.head.resistances.physical).toBe(2);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("clothing faz Math.max com resistencia existente", () => {
    const armor = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 } });
    const cloth = apparel({
      apparelType: "clothing",
      resistances: { physical: 5, energy: 0, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [armor, cloth] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(5);
    expect(result.bodyParts.torso.resistances.energy).toBe(2);
  });

  it("poison sempre fica 0 (armadura nunca contribui poison)", () => {
    const armor = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 9 } });
    const char = buildCharacter({ items: [armor] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.poison).toBe(0);
  });

  it("apparel stashed nao aplica resistencias", () => {
    const char = buildCharacter({ items: [apparel({ stashed: true })] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("apparel nao equipado nao aplica resistencias", () => {
    const char = buildCharacter({ items: [apparel({ equipped: false })] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });
});

describe("recalculateFalloutDerived — encumbrance", () => {
  it("calcula peso total de itens nao-stashed", () => {
    const items: FalloutItem[] = [
      { id: "w1", name: "Pistol", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 3, costCaps: 50, equipped: false },
      { id: "c1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 5, quantity: 3, weight: 0.5, costCaps: 25 },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(4.5);
    expect(result.encumbranceLevel).toBe(0);
  });

  it("exclui itens stashed do peso", () => {
    const items: any[] = [
      { id: "w1", name: "Heavy", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 100, costCaps: 50, equipped: false, stashed: true },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(0);
  });

  it("exclui powerArmor energizada do peso", () => {
    const items: any[] = [
      { id: "pa1", name: "T-60", type: "apparel", apparelType: "powerArmor", locationsCovered: ["torso"], resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 }, weight: 80, costCaps: 500, equipped: true, stashed: false, powered: true },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(0);
  });

  it("calcula encumbranceLevel quando excede capacidade", () => {
    const items: any[] = [
      { id: "w1", name: "Heavy", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 300, costCaps: 50, equipped: false },
    ];
    const char = buildCharacter({ items, carryWeightMax: 200 });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(300);
    expect(result.encumbranceLevel).toBe(2);
  });
});

describe("recalculateFalloutDerived — stats derivadas", () => {
  it("recalcula hpMax e cap hpCurrent", () => {
    const char = buildCharacter({
      attributes: { str: 5, per: 5, end: 7, cha: 5, int: 5, agi: 5, luc: 6 },
      level: 3, radiation: 2, hpCurrent: 99,
    });
    const result = recalculateFalloutDerived(char);
    expect(result.hpMax).toBe(15);
    expect(result.hpCurrent).toBe(13);
  });

  it("recalcula defense, initiative, meleeDamageBonus, carryWeightMax", () => {
    const char = buildCharacter({
      attributes: { str: 9, per: 7, end: 5, cha: 5, int: 5, agi: 10, luc: 5 },
    });
    const result = recalculateFalloutDerived(char);
    expect(result.defense).toBe(2);
    expect(result.initiative).toBe(17);
    expect(result.meleeDamageBonus).toBe(2);
    expect(result.carryWeightMax).toBe(240);
  });

  it("deriva bodyParts.status a partir do array de injuries", () => {
    const char = buildCharacter();
    char.bodyParts.torso.injuries = [0, 1, 0];
    char.bodyParts.head.injuries = [2, 0, 0];
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.status).toBe("wounded");
    expect(result.bodyParts.head.status).toBe("crippled");
    expect(result.bodyParts.armL.status).toBe("healthy");
  });
});
