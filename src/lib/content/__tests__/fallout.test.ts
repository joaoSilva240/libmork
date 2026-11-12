import { describe, it, expect } from "vitest";
import {
  FALLOUT_ITEM_PACKS,
  falloutSlugFromFilename,
  falloutSourceKey,
  falloutLocalIcon,
  falloutStripHtml,
  assignUniqueFalloutSourceKeys,
  parseFalloutPerk,
  parseFalloutItem,
} from "../fallout";

describe("falloutSlugFromFilename", () => {
  it("extrai o slug antes do separador __", () => {
    expect(falloutSlugFromFilename("fortune_finder__zQpZJuiwAC8Zk9a0.json")).toBe(
      "fortune_finder",
    );
    expect(falloutSlugFromFilename("10mm_round__1Mku27VQTcwBCwOF.json")).toBe("10mm_round");
  });

  it("remove o id do Foundry que vem sempre no final do nome", () => {
    expect(
      falloutSlugFromFilename("tempered__torso___uLZD28tMAPybOcdn.json"),
    ).toBe("tempered__torso");
    expect(falloutSlugFromFilename("barbed__SBiPJoDN1jWmENgs.json")).toBe("barbed");
  });

  it("retorna null para nomes sem separador", () => {
    expect(falloutSlugFromFilename("semseparador.json")).toBeNull();
    expect(falloutSlugFromFilename("__soid.json")).toBeNull();
  });
});

describe("assignUniqueFalloutSourceKeys", () => {
  it("mantém o slug puro na primeira ocorrência e adiciona sufixo nas colisões", () => {
    const rows = assignUniqueFalloutSourceKeys([
      { row: { sourceKey: "fallout:weapon_mods:barbed" }, foundryId: "SBiPJoDN1jWmENgs" },
      { row: { sourceKey: "fallout:weapon_mods:barbed" }, foundryId: "Sem0JhmbNdppKdJW" },
      { row: { sourceKey: "fallout:weapon_mods:barbed" }, foundryId: "bIxeUpjoKTniv7P7" },
    ]);
    expect(rows.map((r) => r.sourceKey)).toEqual([
      "fallout:weapon_mods:barbed",
      "fallout:weapon_mods:barbed-SBiPJoDN1jWmENgs",
      "fallout:weapon_mods:barbed-Sem0JhmbNdppKdJW",
    ]);
  });

  it("não altera chaves já únicas", () => {
    const rows = assignUniqueFalloutSourceKeys([
      { row: { sourceKey: "fallout:weapons:10mm_auto_pistol" }, foundryId: "bKHsUZI6Z6xrAEHg" },
    ]);
    expect(rows[0].sourceKey).toBe("fallout:weapons:10mm_auto_pistol");
  });
});

describe("falloutSourceKey", () => {
  it("monta chave estável por pack e slug", () => {
    expect(falloutSourceKey("weapons", "10mm_auto_pistol")).toBe(
      "fallout:weapons:10mm_auto_pistol",
    );
  });
});

describe("falloutLocalIcon", () => {
  it("mapeia caminho do Foundry para ícone local existente", () => {
    expect(falloutLocalIcon("systems/fallout/assets/icons/items/perk.svg")).toBe(
      "/systems/fallout/items/perk.svg",
    );
    expect(falloutLocalIcon("systems/fallout/assets/icons/items/weapon.svg")).toBe(
      "/systems/fallout/items/weapon.svg",
    );
  });

  it("retorna null para ícone não copiado ou entrada inválida", () => {
    expect(falloutLocalIcon("systems/fallout/assets/icons/unknown.svg")).toBeNull();
    expect(falloutLocalIcon("")).toBeNull();
    expect(falloutLocalIcon(null)).toBeNull();
  });
});

describe("falloutStripHtml", () => {
  it("remove tags e converte parágrafos/listas em texto legível", () => {
    const html = "<p>Linha um</p>\n<p>Linha <strong>dois</strong></p>\n<ul>\n<li>item A</li>\n<li>item B</li>\n</ul>";
    const text = falloutStripHtml(html);
    expect(text).toContain("Linha um");
    expect(text).toContain("Linha dois");
    expect(text).toContain("• item A");
    expect(text).toContain("• item B");
    expect(text).not.toContain("<");
  });

  it("decodifica entidades comuns", () => {
    expect(falloutStripHtml("<p>caf&eacute; &amp; ch&aacute;&nbsp;!</p>")).toBe("café & chá !");
  });

  it("retorna string vazia para entrada não-string", () => {
    expect(falloutStripHtml(undefined)).toBe("");
    expect(falloutStripHtml(42)).toBe("");
  });
});

describe("parseFalloutPerk", () => {
  it("mapeia perk para linha de spell (useType='perk', manaCost=0)", () => {
    const row = parseFalloutPerk({
      _id: "zQpZJuiwAC8Zk9a0",
      name: "Fortune Finder",
      img: "systems/fallout/assets/icons/items/perk.svg",
      type: "perk",
      system: {
        description: "<p>Whenever you roll to determine how much money you find...</p>\n<p><strong>Requirements</strong>: LCK 5, Level 2+</p>",
        rank: { max: 3, value: 0 },
        requirements: "",
        source: "core_rulebook",
      },
    });

    expect(row).not.toBeNull();
    expect(row!.name).toBe("Fortune Finder");
    expect(row!.useType).toBe("perk");
    expect(row!.manaCost).toBe(0);
    expect(row!.circle).toBe(3);
    expect(row!.description).toContain("Requirements");
    expect(row!.imageUrl).toBe("/systems/fallout/items/perk.svg");
    expect(row!.structuredEffects).toMatchObject({
      origin: "fallout_2d20_compendium",
      foundryId: "zQpZJuiwAC8Zk9a0",
      source: "core_rulebook",
    });
  });

  it("retorna null sem nome", () => {
    expect(parseFalloutPerk({ system: {} })).toBeNull();
  });
});

describe("parseFalloutItem", () => {
  it("mapeia arma com custo/raridade/peso e junta efeito à descrição", () => {
    const row = parseFalloutItem(
      {
        _id: "bKHsUZI6Z6xrAEHg",
        name: "10mm Auto Pistol",
        img: "systems/fallout/assets/icons/items/weapon.svg",
        type: "weapon",
        system: {
          description: "<p>Uma pistola.</p>",
          effect: "<p>Dispara rápido.</p>",
          cost: 80,
          rarity: 2,
          weight: 3,
        },
      },
      "weapons",
      "10mm_auto_pistol",
    );

    expect(row).not.toBeNull();
    expect(row!.sourceKey).toBe("fallout:weapons:10mm_auto_pistol");
    expect(row!.description).toBe("Uma pistola.\n\nDispara rápido.");
    expect(row!.qualityDescription).toBe("Cost: 80 caps • Rarity: 2 • Weight: 3");
    expect(row!.imageUrl).toBe("/systems/fallout/items/weapon.svg");
    expect(row!.sourceData).toMatchObject({ pack: "weapons", slug: "10mm_auto_pistol", cost: 80 });
  });

  it("sem efeito, descrição fica só com o texto principal", () => {
    const row = parseFalloutItem(
      { name: "Jet", system: { description: "<p>Chem perigoso.</p>" } },
      "consumables",
      "jet",
    );
    expect(row!.description).toBe("Chem perigoso.");
    expect(row!.qualityDescription).toBeNull();
  });
});

describe("FALLOUT_ITEM_PACKS", () => {
  it("inclui os packs de equipamento aprovados", () => {
    expect(FALLOUT_ITEM_PACKS).toContain("weapons");
    expect(FALLOUT_ITEM_PACKS).toContain("apparel");
    expect(FALLOUT_ITEM_PACKS).toHaveLength(9);
  });
});
