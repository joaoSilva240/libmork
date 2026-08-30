import { describe, it, expect } from "vitest";
import { createCharacterSchema, updateCharacterSchema, attributesSchema } from "../character";

describe("Character Validator Schemas", () => {
  it("should validate character creation without campaignId", () => {
    const payload = {
      name: "Valeros",
      attributes: {
        forca: 10,
        destreza: 10,
        vigor: 10,
        inteligencia: 10,
        empatia: 8, // 10+10+10+10+8 = 48 (5*8 + 8)
      },
    };

    const result = createCharacterSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Valeros");
      expect(result.data.campaignId).toBeUndefined();
    }
  });

  it("should validate character creation with valid campaignId uuid", () => {
    const payload = {
      name: "Merisiel",
      campaignId: "550e8400-e29b-41d4-a716-446655440000",
      attributes: {
        forca: 8,
        destreza: 14,
        vigor: 10,
        inteligencia: 8,
        empatia: 8, // 8+14+10+8+8 = 48
      },
    };

    const result = createCharacterSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Merisiel");
      expect(result.data.campaignId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("should reject invalid campaignId (non-uuid format)", () => {
    const payload = {
      name: "Kyra",
      campaignId: "invalid-campaign-id",
    };

    const result = createCharacterSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject character with attribute sum different from 48", () => {
    const payload = {
      name: "Ezren",
      attributes: {
        forca: 18,
        destreza: 18,
        vigor: 18,
        inteligencia: 18,
        empatia: 18, // Sum = 90 (expected 48)
      },
    };

    const result = createCharacterSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject character names shorter than 2 characters", () => {
    const payload = {
      name: "A",
    };

    const result = createCharacterSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should validate update character payload", () => {
    const updatePayload = {
      name: "Valeros o Bravo",
      hitPointsCurrent: 12,
      xp: 150,
    };

    const result = updateCharacterSchema.safeParse(updatePayload);
    expect(result.success).toBe(true);
  });
});
