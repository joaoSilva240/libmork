// =============================================================================
// Libmork — Testes: Scope Correction Issue #37
// =============================================================================

import { describe, it, expect } from "vitest";
import { characterItems, items } from "../schema";
import { buildJunctionValues, buildJunctionPatch } from "../content-registry";
import { itemSchema, getContentUpdateValidator } from "@/lib/validators/content";
import { createClassSchema } from "@/lib/validators/class";

describe("Scope Correction #I37 — Schema & Registry", () => {
  it("characterItems schema should define hitRoll and damageRoll columns", () => {
    expect(characterItems.hitRoll).toBeDefined();
    expect(characterItems.damageRoll).toBeDefined();
  });

  it("items schema should NOT define hitRoll and damageRoll columns", () => {
    expect((items as unknown as Record<string, unknown>).hitRoll).toBeUndefined();
    expect((items as unknown as Record<string, unknown>).damageRoll).toBeUndefined();
  });

  it("buildJunctionValues should persist hitRoll and damageRoll on character_items", () => {
    const values = buildJunctionValues("items", "char-1", {
      contentId: "item-123",
      quantity: 2,
      hitRoll: "1d20 + @forca",
      damageRoll: "1d8 + 3",
    });

    expect(values).toEqual({
      characterId: "char-1",
      itemId: "item-123",
      quantity: 2,
      hitRoll: "1d20 + @forca",
      damageRoll: "1d8 + 3",
    });
  });

  it("buildJunctionValues should omit hitRoll/damageRoll when not provided", () => {
    const values = buildJunctionValues("items", "char-1", {
      contentId: "item-123",
      quantity: 1,
    });

    expect(values).toEqual({
      characterId: "char-1",
      itemId: "item-123",
      quantity: 1,
    });
    expect("hitRoll" in values).toBe(false);
    expect("damageRoll" in values).toBe(false);
  });

  it("buildJunctionPatch should only patch hitRoll and damageRoll when explicitly provided", () => {
    const patchWithRolls = buildJunctionPatch("items", {
      quantity: 3,
      hitRoll: "1d20 + 2",
      damageRoll: "2d6",
    });

    expect(patchWithRolls).toEqual({
      quantity: 3,
      hitRoll: "1d20 + 2",
      damageRoll: "2d6",
    });

    const patchOnlyQty = buildJunctionPatch("items", {
      quantity: 5,
    });

    expect(patchOnlyQty).toEqual({
      quantity: 5,
    });
    expect("hitRoll" in patchOnlyQty).toBe(false);
    expect("damageRoll" in patchOnlyQty).toBe(false);
  });

  it("createClassSchema allows optional hitRoll/damageRoll on initialItems", () => {
    const parsed = createClassSchema.safeParse({
      name: "Guerreiro",
      initialItems: [
        {
          name: "Espada Longa",
          quantity: 1,
          hitRoll: "1d20 + @forca",
          damageRoll: "1d8 + @forca",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.initialItems[0].hitRoll).toBe("1d20 + @forca");
      expect(parsed.data.initialItems[0].damageRoll).toBe("1d8 + @forca");
    }
  });

  it("global itemSchema rejects or strips hitRoll and damageRoll", () => {
    const parsed = itemSchema.safeParse({
      name: "Poção de Vida",
      hitRoll: "1d20",
      damageRoll: "2d4",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("hitRoll" in parsed.data).toBe(false);
      expect("damageRoll" in parsed.data).toBe(false);
    }
  });

  it("global item update validator ignores hitRoll and damageRoll", () => {
    const updateValidator = getContentUpdateValidator("items");
    const parsed = updateValidator.safeParse({
      hitRoll: "1d20",
      damageRoll: "2d4",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("hitRoll" in parsed.data).toBe(false);
      expect("damageRoll" in parsed.data).toBe(false);
    }
  });
});
