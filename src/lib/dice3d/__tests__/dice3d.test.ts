import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DICE3D_STORAGE_KEY,
  buildDice3DColorset,
  buildDice3DNotation,
  isDice3DEnabled,
  sanitizeDice3D,
  setDice3DEnabled,
  showDice3D,
  subscribeDice3DRolls,
} from "@/lib/dice3d";
import { rollExpression } from "@/lib/engine/dice";
import { themes } from "@/lib/theme";

describe("dice3d", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("monta notação predeterminada agrupando dados do mesmo tipo", () => {
    expect(
      buildDice3DNotation([
        { sides: 20, value: 15 },
        { sides: 6, value: 3 },
        { sides: 20, value: 2 },
      ]),
    ).toBe("2d20+1d6@15,2,3");
  });

  it("descarta dados não suportados ou valores fora da face", () => {
    expect(
      sanitizeDice3D([
        { sides: 100, value: 50 },
        { sides: 6, value: 7 },
        { sides: 6, value: 0 },
        { sides: 8, value: 8 },
      ]),
    ).toEqual([{ sides: 8, value: 8 }]);
    expect(buildDice3DNotation([{ sides: 3, value: 1 }])).toBeNull();
  });

  it("vem ligado por padrão e respeita o toggle", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDice3DRolls(listener);
    expect(isDice3DEnabled()).toBe(true);
    showDice3D([{ sides: 20, value: 7 }]);
    expect(listener).toHaveBeenCalledWith([{ sides: 20, value: 7 }]);

    setDice3DEnabled(false);
    expect(window.localStorage.getItem(DICE3D_STORAGE_KEY)).toBe("false");
    showDice3D([{ sides: 20, value: 9 }]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("usa as cores de destaque do tema", () => {
    const theme = themes["crimson-dark"];
    const colorset = buildDice3DColorset(theme);
    expect(colorset.background).toBe(theme.colors.accent.primary);
    expect(colorset.outline).toBe(theme.colors.accent.dark);
  });

  it("rollExpression expõe os dados individuais sem o modificador", () => {
    const result = rollExpression("2d6 + 3", 0, { rng: () => 0.5 });
    expect(result.rolledDice).toEqual([
      { sides: 6, value: 4 },
      { sides: 6, value: 4 },
    ]);
    expect(result.total).toBe(11);
  });
});
