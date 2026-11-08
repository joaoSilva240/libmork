import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { campaigns, campaignAudioTracks } from "../schema";

describe("schema — colunas de cena (issue #86, Fase 1)", () => {
  it("campaigns expõe active_scene como varchar nullable", () => {
    const col = getTableConfig(campaigns).columns.find((c) => c.name === "active_scene");
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(false);
    expect(col?.dataType).toBe("string");
  });

  it("campaign_audio_tracks expõe scene como varchar nullable", () => {
    const col = getTableConfig(campaignAudioTracks).columns.find((c) => c.name === "scene");
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(false);
    expect(col?.dataType).toBe("string");
  });
});
