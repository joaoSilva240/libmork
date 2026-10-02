import { describe, it, expect } from "vitest";
import { itemSchema, getContentUpdateValidator } from "../content";

describe("Content Item Validator Schemas", () => {
  it("should ignore formula fields on global item creation", () => {
    const payload = {
      name: "Espada Longa",
      description: "Uma espada de lâmina afiada.",
      hitRoll: "1d20+4",
      damageRoll: "1d8+2",
    };

    const result = itemSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Espada Longa");
      expect("hitRoll" in result.data).toBe(false);
      expect("damageRoll" in result.data).toBe(false);
    }
  });

  it("should ignore formula fields on global item update", () => {
    const updateValidator = getContentUpdateValidator("items");
    const payload = {
      hitRoll: "1d20+6",
      damageRoll: null,
    };

    const result = updateValidator.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("hitRoll" in result.data).toBe(false);
      expect("damageRoll" in result.data).toBe(false);
    }
  });
});
