// =============================================================================
// Libmork — Audio: Testes do contrato de protocolo de jukebox (Issue #60)
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  AUDIO_EVENTS,
  audioTrackSchema,
  audioTrackAddSchema,
  audioTrackPlaySchema,
  audioTrackPauseSchema,
  audioTrackLoopSchema,
  audioTrackRemoveSchema,
} from "../jukebox-protocol";

const VALID_TRACK = {
  id: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  addedBy: "user-1",
  addedAt: "2026-01-01T10:00:00.000Z",
};

describe("AUDIO_EVENTS", () => {
  it("usa os nomes exatos do contrato", () => {
    expect(AUDIO_EVENTS.TRACK_ADD).toBe("audio:track-add");
    expect(AUDIO_EVENTS.TRACK_PLAY).toBe("audio:track-play");
    expect(AUDIO_EVENTS.TRACK_PAUSE).toBe("audio:track-pause");
    expect(AUDIO_EVENTS.TRACK_LOOP).toBe("audio:track-loop");
    expect(AUDIO_EVENTS.TRACK_REMOVE).toBe("audio:track-remove");
    expect(AUDIO_EVENTS.TRACK_STATE).toBe("audio:track-state");
  });
});

describe("audioTrackSchema", () => {
  it("aceita track válida", () => {
    expect(audioTrackSchema.safeParse(VALID_TRACK).success).toBe(true);
  });

  it("rejeita id com tamanho errado (10 e 12 caracteres)", () => {
    expect(audioTrackSchema.safeParse({ ...VALID_TRACK, id: "abcdefghij" }).success).toBe(false);
    expect(audioTrackSchema.safeParse({ ...VALID_TRACK, id: "abcdefghijkl" }).success).toBe(false);
  });
});

describe("audioTrackAddSchema", () => {
  it("aceita payload com actorId", () => {
    const result = audioTrackAddSchema.safeParse({
      campaignId: "camp-1",
      actorId: "user-1",
      actorName: "Mestre",
      track: VALID_TRACK,
    });
    expect(result.success).toBe(true);
  });

  it("aceita payload sem actorId (opcional)", () => {
    const result = audioTrackAddSchema.safeParse({
      campaignId: "camp-1",
      actorName: "Mestre",
      track: VALID_TRACK,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita campaignId vazio", () => {
    expect(
      audioTrackAddSchema.safeParse({
        campaignId: "",
        actorName: "Mestre",
        track: VALID_TRACK,
      }).success
    ).toBe(false);
  });

  it("rejeita track.id com tamanho errado", () => {
    expect(
      audioTrackAddSchema.safeParse({
        campaignId: "camp-1",
        actorName: "Mestre",
        track: { ...VALID_TRACK, id: "abcdefghij" },
      }).success
    ).toBe(false);
  });
});

describe("audioTrackPlaySchema", () => {
  const payload = { campaignId: "camp-1", trackId: "dQw4w9WgXcQ", playingAt: 1700000000000 };

  it("aceita payload válido", () => {
    expect(audioTrackPlaySchema.safeParse(payload).success).toBe(true);
  });

  it("rejeita campaignId vazio", () => {
    expect(audioTrackPlaySchema.safeParse({ ...payload, campaignId: "" }).success).toBe(false);
  });

  it("rejeita trackId ausente", () => {
    const { trackId: _omit, ...semTrackId } = payload;
    expect(audioTrackPlaySchema.safeParse(semTrackId).success).toBe(false);
  });
});

describe("audioTrackPauseSchema", () => {
  const payload = { campaignId: "camp-1", trackId: "dQw4w9WgXcQ" };

  it("aceita payload válido", () => {
    expect(audioTrackPauseSchema.safeParse(payload).success).toBe(true);
  });

  it("rejeita campaignId vazio", () => {
    expect(audioTrackPauseSchema.safeParse({ ...payload, campaignId: "" }).success).toBe(false);
  });

  it("rejeita trackId ausente", () => {
    const { trackId: _omit, ...semTrackId } = payload;
    expect(audioTrackPauseSchema.safeParse(semTrackId).success).toBe(false);
  });
});

describe("audioTrackLoopSchema", () => {
  it("aceita loop true e false (booleanos)", () => {
    expect(
      audioTrackLoopSchema.safeParse({ campaignId: "camp-1", trackId: "dQw4w9WgXcQ", loop: true }).success
    ).toBe(true);
    expect(
      audioTrackLoopSchema.safeParse({ campaignId: "camp-1", trackId: "dQw4w9WgXcQ", loop: false }).success
    ).toBe(true);
  });

  it("rejeita loop como string \"true\"", () => {
    expect(
      audioTrackLoopSchema.safeParse({ campaignId: "camp-1", trackId: "dQw4w9WgXcQ", loop: "true" }).success
    ).toBe(false);
  });

  it("rejeita trackId ausente", () => {
    expect(audioTrackLoopSchema.safeParse({ campaignId: "camp-1", loop: true }).success).toBe(false);
  });
});

describe("audioTrackRemoveSchema", () => {
  const payload = { campaignId: "camp-1", trackId: "dQw4w9WgXcQ" };

  it("aceita payload válido", () => {
    expect(audioTrackRemoveSchema.safeParse(payload).success).toBe(true);
  });

  it("rejeita campaignId vazio", () => {
    expect(audioTrackRemoveSchema.safeParse({ ...payload, campaignId: "" }).success).toBe(false);
  });

  it("rejeita trackId ausente", () => {
    const { trackId: _omit, ...semTrackId } = payload;
    expect(audioTrackRemoveSchema.safeParse(semTrackId).success).toBe(false);
  });
});
