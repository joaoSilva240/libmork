import { describe, it, expect } from "vitest";
import {
  createCampaignAssetSchema,
  updateCampaignAssetSchema,
  initialAssetInputSchema,
  CAMPAIGN_ASSET_CATEGORIES,
} from "../campaign-asset";
import { createCampaignSchema } from "../campaign";

describe("Campaign Asset Validators", () => {
  it("should validate a valid asset creation payload with defaults", () => {
    const payload = {
      name: "Mapa da Masmorra",
      imageUrl: "https://example.com/dungeon.png",
    };

    const result = createCampaignAssetSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Mapa da Masmorra");
      expect(result.data.imageUrl).toBe("https://example.com/dungeon.png");
      expect(result.data.category).toBe("handout");
      expect(result.data.position).toBe(0);
      expect(result.data.description).toBeUndefined();
    }
  });

  it("should accept valid categories", () => {
    for (const cat of CAMPAIGN_ASSET_CATEGORIES) {
      const result = createCampaignAssetSchema.safeParse({
        name: `Asset ${cat}`,
        imageUrl: `/images/${cat}.png`,
        category: cat,
        position: 1,
        description: `Descrição de ${cat}`,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe(cat);
      }
    }
  });

  it("should reject invalid category", () => {
    const result = createCampaignAssetSchema.safeParse({
      name: "Inválido",
      imageUrl: "/images/test.png",
      category: "unsupported_category",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty name or empty imageUrl", () => {
    expect(
      createCampaignAssetSchema.safeParse({
        name: "",
        imageUrl: "https://example.com/test.png",
      }).success,
    ).toBe(false);

    expect(
      createCampaignAssetSchema.safeParse({
        name: "Test",
        imageUrl: "",
      }).success,
    ).toBe(false);
  });

  it("should validate update payload with partial fields", () => {
    const updateResult = updateCampaignAssetSchema.safeParse({
      name: "Novo Nome",
    });
    expect(updateResult.success).toBe(true);
    if (updateResult.success) {
      expect(updateResult.data.name).toBe("Novo Nome");
      expect(updateResult.data.category).toBeUndefined();
      expect(updateResult.data.position).toBeUndefined();
    }
  });

  it("should validate initialAssetInputSchema directly", () => {
    const asset = initialAssetInputSchema.parse({
      name: "Item Inicial",
      imageUrl: "/images/item.png",
    });
    expect(asset.category).toBe("handout");
    expect(asset.position).toBe(0);
  });

  it("should integrate with createCampaignSchema via initialAssets", () => {
    const campaignPayload = {
      name: "Campanha dos Bravos",
      initialAssets: [
        {
          name: "Carta do Rei",
          imageUrl: "https://example.com/letter.png",
          category: "handout" as const,
        },
        {
          name: "Mapa de Baróvia",
          imageUrl: "/maps/barovia.jpg",
          category: "map" as const,
          position: 1,
        },
      ],
    };

    const result = createCampaignSchema.safeParse(campaignPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initialAssets).toHaveLength(2);
      expect(result.data.initialAssets?.[0].category).toBe("handout");
      expect(result.data.initialAssets?.[1].position).toBe(1);
    }
  });
});
