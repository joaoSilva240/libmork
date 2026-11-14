import { describe, it, expect } from "vitest";
import {
  catalogItemToFalloutItem,
  getFalloutItemCategory,
  getFalloutItemCategoryLabel,
  type CatalogItem,
} from "../itemCatalog";

/** Linha real da tabela `items`: os campos do Foundry ficam espalhados em `sourceData`. */
function catalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "item-1",
    name: "Item",
    description: null,
    qualityDescription: null,
    imageUrl: null,
    sourceKey: "fallout:weapons:item",
    sourceData: { origin: "fallout_2d20_compendium", pack: "weapons" },
    ...overrides,
  };
}

describe("getFalloutItemCategory", () => {
  it("mapeia os packs do compendio para os tipos de item", () => {
    expect(getFalloutItemCategory(catalogItem({ sourceData: { pack: "weapons" } }))).toBe("weapon");
    expect(getFalloutItemCategory(catalogItem({ sourceData: { pack: "apparel" } }))).toBe("apparel");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "consumables" } })),
    ).toBe("consumable");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "ammunition" } })),
    ).toBe("ammo");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "weapon_mods" } })),
    ).toBe("mod");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "apparel_mods" } })),
    ).toBe("mod");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "robot_modules" } })),
    ).toBe("mod");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "miscellany" } })),
    ).toBe("miscellany");
    expect(
      getFalloutItemCategory(catalogItem({ sourceData: { pack: "books_and_magz" } })),
    ).toBe("miscellany");
  });

  it("cai para miscellany quando o pack e desconhecido ou ausente", () => {
    expect(getFalloutItemCategory(catalogItem({ sourceData: { pack: "xpto" } }))).toBe(
      "miscellany",
    );
    expect(getFalloutItemCategory(catalogItem({ sourceData: null }))).toBe("miscellany");
  });

  it("traduz os rotulos de categoria em PT-BR", () => {
    expect(getFalloutItemCategoryLabel("weapon")).toBe("Armas");
    expect(getFalloutItemCategoryLabel("apparel")).toBe("Vestuário");
    expect(getFalloutItemCategoryLabel("consumable")).toBe("Consumíveis");
    expect(getFalloutItemCategoryLabel("ammo")).toBe("Munição");
    expect(getFalloutItemCategoryLabel("mod")).toBe("Mods");
  });
});

describe("catalogItemToFalloutItem — arma", () => {
  /** Reproduz o 10mm Pistol real: rating 4, physical, piercing_x e close_quarters/reliable ativos. */
  const pistol = catalogItem({
    id: "item-10mm",
    name: "10mm Pistol",
    sourceKey: "fallout:weapons:10mm_pistol",
    sourceData: {
      pack: "weapons",
      weight: 4,
      cost: 50,
      ammo: "10mm Round",
      ammoPerShot: 1,
      fireRate: 2,
      range: "close",
      damage: {
        rating: 4,
        damageType: { physical: true, energy: false, radiation: false, poison: false },
        damageEffect: {
          piercing_x: { rank: 1, value: 0 },
          tranquilize_x: { rank: 1, value: 0 },
          burst: { rank: 0, value: 0 },
        },
        weaponQuality: {
          close_quarters: { rank: 0, value: 1 },
          reliable: { rank: 0, value: 1 },
          ammo_hungry_x: { rank: 1, value: 0 },
          accurate: { rank: 0, value: 0 },
        },
      },
    },
  });

  it("converte dados de combate, tipo de dano, efeitos e qualidades", () => {
    const item = catalogItemToFalloutItem(pistol);
    expect(item.type).toBe("weapon");
    if (item.type !== "weapon") throw new Error("esperava arma");
    expect(item.name).toBe("10mm Pistol");
    expect(item.damageDiceRating).toBe(4);
    expect(item.damageType).toBe("physical");
    expect(item.damageEffects).toEqual(["piercing"]);
    expect(item.qualities).toEqual(["close_quarters", "reliable"]);
    expect(item.ammoType).toBe("10mm Round");
    expect(item.ammoPerShot).toBe(1);
    expect(item.fireRate).toBe(2);
    expect(item.range).toBe("close");
    expect(item.weight).toBe(4);
    expect(item.costCaps).toBe(50);
    expect(item.equipped).toBe(false);
    expect(item.id).toBeTruthy();
  });

  it("usa physical como tipo de dano padrao e tolera campos ausentes", () => {
    const item = catalogItemToFalloutItem(
      catalogItem({ name: "Faca", sourceData: { pack: "weapons" } }),
    );
    if (item.type !== "weapon") throw new Error("esperava arma");
    expect(item.damageType).toBe("physical");
    expect(item.damageDiceRating).toBe(0);
    expect(item.damageEffects).toEqual([]);
    expect(item.qualities).toEqual([]);
    expect(item.range).toBe("close");
    expect(item.weight).toBe(0);
    expect(item.costCaps).toBe(0);
  });
});

describe("catalogItemToFalloutItem — vestuario", () => {
  /** Reproduz a Combat Armor real: RD physical/energy 2, cobre os 6 membros. */
  const armor = catalogItem({
    id: "item-armor",
    name: "Combat Armor",
    sourceData: {
      pack: "apparel",
      apparelType: "armor",
      weight: 20,
      cost: 185,
      location: { head: true, torso: true, armL: true, armR: true, legL: true, legR: true },
      resistance: { physical: 2, energy: 2, radiation: 0 },
    },
  });

  it("converte RD, locais cobertos e tipo de vestuario", () => {
    const item = catalogItemToFalloutItem(armor);
    expect(item.type).toBe("apparel");
    if (item.type !== "apparel") throw new Error("esperava vestuario");
    expect(item.apparelType).toBe("armor");
    expect(item.resistances).toEqual({ physical: 2, energy: 2, radiation: 0, poison: 0 });
    expect(item.locationsCovered).toEqual(["head", "torso", "armL", "armR", "legL", "legR"]);
    expect(item.weight).toBe(20);
    expect(item.costCaps).toBe(185);
    expect(item.equipped).toBe(false);
  });

  it("cobre apenas os membros marcados e zera RD ausente", () => {
    const item = catalogItemToFalloutItem(
      catalogItem({
        name: "Capacete",
        sourceData: {
          pack: "apparel",
          apparelType: "headgear",
          location: { head: true, torso: false },
          resistance: { physical: 1 },
        },
      }),
    );
    if (item.type !== "apparel") throw new Error("esperava vestuario");
    expect(item.locationsCovered).toEqual(["head"]);
    expect(item.resistances).toEqual({ physical: 1, energy: 0, radiation: 0, poison: 0 });
  });
});

describe("catalogItemToFalloutItem — consumivel e demais", () => {
  it("converte consumivel com categoria, HP e quantidade", () => {
    const item = catalogItemToFalloutItem(
      catalogItem({
        name: "Nuka-Cola",
        sourceData: {
          pack: "consumables",
          consumableType: "beverage",
          hp: 2,
          quantity: 1,
          addictive: false,
          weight: 1,
          cost: 20,
        },
      }),
    );
    expect(item.type).toBe("consumable");
    if (item.type !== "consumable") throw new Error("esperava consumivel");
    expect(item.category).toBe("beverage");
    expect(item.hpRestored).toBe(2);
    expect(item.quantity).toBe(1);
    expect(item.weight).toBe(1);
    expect(item.costCaps).toBe(20);
  });

  it("converte municao, mod e miscelanea preservando descricao e quantidade", () => {
    for (const [pack, type] of [
      ["ammunition", "ammo"],
      ["weapon_mods", "mod"],
      ["miscellany", "miscellany"],
    ] as const) {
      const item = catalogItemToFalloutItem(
        catalogItem({
          name: "Entrada",
          description: "Texto do compendio.",
          sourceData: { pack, quantity: 3, weight: 0.5, cost: 10 },
        }),
      );
      expect(item.type).toBe(type);
      expect(item.weight).toBe(0.5);
      expect(item.costCaps).toBe(10);
      if (item.type === "ammo" || item.type === "mod" || item.type === "miscellany") {
        expect(item.description).toBe("Texto do compendio.");
        expect(item.quantity).toBe(3);
      }
    }
  });
});
