import { describe, it, expect } from "vitest";
import { createCampaignSchema, updateCampaignSchema } from "../campaign";

describe("Campaign Dice 3D Validators (Issue #74)", () => {
  it("defaults dice3dPlayersEnabled and dice3dMasterEnabled to true in createCampaignSchema", () => {
    const parsed = createCampaignSchema.parse({
      name: "Campanha dos Dados",
    });

    expect(parsed.dice3dPlayersEnabled).toBe(true);
    expect(parsed.dice3dMasterEnabled).toBe(true);
  });

  it("accepts boolean overrides in createCampaignSchema", () => {
    const parsed = createCampaignSchema.parse({
      name: "Campanha Silenciosa",
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: false,
    });

    expect(parsed.dice3dPlayersEnabled).toBe(false);
    expect(parsed.dice3dMasterEnabled).toBe(false);
  });

  it("allows partial updates of dice 3D toggles in updateCampaignSchema", () => {
    const parsedPlayersOnly = updateCampaignSchema.parse({
      dice3dPlayersEnabled: false,
    });
    expect(parsedPlayersOnly.dice3dPlayersEnabled).toBe(false);
    expect(parsedPlayersOnly.dice3dMasterEnabled).toBeUndefined();

    const parsedMasterOnly = updateCampaignSchema.parse({
      dice3dMasterEnabled: true,
    });
    expect(parsedMasterOnly.dice3dMasterEnabled).toBe(true);
  });

  it("rejects non-boolean values for dice 3D toggles", () => {
    const result = updateCampaignSchema.safeParse({
      dice3dPlayersEnabled: "sim",
    });
    expect(result.success).toBe(false);
  });
});
