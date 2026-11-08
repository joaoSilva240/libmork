import { describe, it, expect } from "vitest";
import {
  launchSessionSchema,
  applySessionSchema,
  updateSessionSchema,
  decideCandidateSchema,
} from "../sessions";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("launchSessionSchema", () => {
  const base = {
    campaignId: UUID,
    description: "Sessão de abertura em Barovia",
    proposedStart: "2026-12-01T00:00:00.000Z",
    proposedEnd: "2026-12-03T23:59:59.000Z",
  };

  it("aceita lançamento válido", () => {
    expect(launchSessionSchema.safeParse(base).success).toBe(true);
  });

  it("rejeita período invertido", () => {
    expect(
      launchSessionSchema.safeParse({ ...base, proposedEnd: "2026-11-01T00:00:00.000Z" }).success,
    ).toBe(false);
  });

  it("rejeita descrição curta e xp negativo", () => {
    expect(launchSessionSchema.safeParse({ ...base, description: "curta" }).success).toBe(false);
    expect(launchSessionSchema.safeParse({ ...base, xpReward: -1 }).success).toBe(false);
  });

  it("aceita sessionType/maxSlots opcionais e rejeita fora dos limites", () => {
    expect(
      launchSessionSchema.safeParse({ ...base, sessionType: "one_shot", maxSlots: 5 }).success,
    ).toBe(true);
    expect(launchSessionSchema.safeParse({ ...base, maxSlots: 0 }).success).toBe(false);
    expect(launchSessionSchema.safeParse({ ...base, maxSlots: 21 }).success).toBe(false);
  });
});

describe("applySessionSchema", () => {
  it("aceita candidatura mínima (sem personagem, sem horário)", () => {
    expect(applySessionSchema.safeParse({ availableDays: ["2026-12-01"] }).success).toBe(true);
  });

  it("exige ao menos 1 dia e formato ISO", () => {
    expect(applySessionSchema.safeParse({ availableDays: [] }).success).toBe(false);
    expect(applySessionSchema.safeParse({ availableDays: ["01/12/2026"] }).success).toBe(false);
  });

  it("exige horários aos pares e fim > início", () => {
    expect(
      applySessionSchema.safeParse({ availableDays: ["2026-12-01"], preferredStart: "19:00" })
        .success,
    ).toBe(false);
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "23:00",
        preferredEnd: "19:00",
      }).success,
    ).toBe(false);
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "19:00",
        preferredEnd: "23:00",
      }).success,
    ).toBe(true);
  });

  it("rejeita hora inválida", () => {
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "25:00",
        preferredEnd: "26:00",
      }).success,
    ).toBe(false);
  });
});

describe("updateSessionSchema", () => {
  it("aceita confirm com scheduledAt e default de duração", () => {
    const r = updateSessionSchema.safeParse({
      action: "confirm",
      scheduledAt: "2026-12-02T19:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.action === "confirm") {
      expect(r.data.durationMinutes).toBe(240);
    }
  });

  it("aceita cancel sem campos extras", () => {
    expect(updateSessionSchema.safeParse({ action: "cancel" }).success).toBe(true);
  });

  it("rejeita action desconhecida e duração fora dos limites", () => {
    expect(updateSessionSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(
      updateSessionSchema.safeParse({
        action: "confirm",
        scheduledAt: "2026-12-02T19:00:00.000Z",
        durationMinutes: 10,
      }).success,
    ).toBe(false);
  });
});

describe("decideCandidateSchema", () => {
  it("aceita accepted/rejected e rejeita outro valor", () => {
    expect(decideCandidateSchema.safeParse({ decision: "accepted" }).success).toBe(true);
    expect(decideCandidateSchema.safeParse({ decision: "rejected" }).success).toBe(true);
    expect(decideCandidateSchema.safeParse({ decision: "maybe" }).success).toBe(false);
  });
});
