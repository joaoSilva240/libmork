import { describe, it, expect } from "vitest";
import { filterTracksForScene } from "../sceneJukebox";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

describe("filterTracksForScene", () => {
  const tracks: AudioTrack[] = [
    {
      id: "track-general",
      title: "Geral",
      addedBy: "user-1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: null,
    },
    {
      id: "track-combat",
      title: "Combate",
      addedBy: "user-1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: "combat",
    },
    {
      id: "track-stealth",
      title: "Furtividade",
      addedBy: "user-1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: "stealth",
    },
    {
      id: "track-investigation",
      title: "Investigação",
      addedBy: "user-1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: "investigation",
    },
  ];

  it("deve retornar todas as faixas quando activeScene é null (modo Livre)", () => {
    const result = filterTracksForScene(tracks, null, new Set());
    expect(result).toHaveLength(4);
  });

  it("deve filtrar apenas faixas da cena e faixas gerais quando há uma cena ativa", () => {
    const result = filterTracksForScene(tracks, "combat", new Set());
    expect(result.map((t) => t.id)).toEqual(["track-general", "track-combat"]);
  });

  it("deve manter visível faixa de outra cena se estiver em playingIds (pino de reprodução)", () => {
    const playingIds = new Set(["track-stealth"]);
    const result = filterTracksForScene(tracks, "combat", playingIds);
    expect(result.map((t) => t.id)).toEqual(["track-general", "track-combat", "track-stealth"]);
  });

  it("deve funcionar corretamente com playingIds vazio", () => {
    const result = filterTracksForScene(tracks, "stealth", new Set());
    expect(result.map((t) => t.id)).toEqual(["track-general", "track-stealth"]);
  });

  it("deve tratar faixas com scene undefined como faixas gerais", () => {
    const trackUndefinedScene: AudioTrack = {
      id: "track-undefined",
      title: "Sem cena",
      addedBy: "user-1",
      addedAt: "2026-11-08T00:00:00Z",
    };
    const result = filterTracksForScene([trackUndefinedScene], "combat", new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("track-undefined");
  });
});
