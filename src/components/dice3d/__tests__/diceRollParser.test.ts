import { describe, it, expect } from "vitest";
import { extractDiceRolls } from "../diceRollParser";

describe("extractDiceRolls", () => {
  it("extrai rolagem simples 1d20 com resultado", () => {
    const rolls = extractDiceRolls("1d20", 17, "Rolou 17");
    expect(rolls).toEqual([{ sides: 20, result: 17 }]);
  });

  it("extrai rolagem com modificador e bracket no detail", () => {
    const rolls = extractDiceRolls("1d20 + 3", 19, "Dado [16] + 3 = 19");
    expect(rolls).toEqual([{ sides: 20, result: 16 }]);
  });

  it("extrai múltiplos dados (ex: 2d6)", () => {
    const rolls = extractDiceRolls("2d6", 7, "2d6 [3, 4] = 7");
    expect(rolls).toEqual([
      { sides: 6, result: 3 },
      { sides: 6, result: 4 },
    ]);
  });

  it("faz fallback limpo para d20 quando fórmula não possui dados explícitos", () => {
    const rolls = extractDiceRolls("+4", 12);
    expect(rolls).toEqual([{ sides: 20, result: 12 }]);
  });
});
