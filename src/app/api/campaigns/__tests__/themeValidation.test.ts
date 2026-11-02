import { describe, it, expect } from "vitest";
import { createCampaignSchema, updateCampaignSchema } from "@/lib/validators/campaign";

describe("Campaign Theme Validators (src/lib/validators/campaign.ts)", () => {
  it("createCampaignSchema defaults theme to 'default-dark' when not provided", () => {
    const input = {
      name: "Campanha Sem Tema Explícito",
    };

    const parsed = createCampaignSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.theme).toBe("default-dark");
    }
  });

  it("createCampaignSchema accepts valid custom theme name", () => {
    const input = {
      name: "Campanha Pergaminho",
      theme: "parchment-light",
    };

    const parsed = createCampaignSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.theme).toBe("parchment-light");
    }
  });

  it("updateCampaignSchema allows updating the theme", () => {
    const input = {
      theme: "crimson-dark",
    };

    const parsed = updateCampaignSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.theme).toBe("crimson-dark");
    }
  });

  it("rejects theme names exceeding 50 characters", () => {
    const input = {
      name: "Campanha Inválida",
      theme: "a".repeat(51),
    };

    const parsed = createCampaignSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
