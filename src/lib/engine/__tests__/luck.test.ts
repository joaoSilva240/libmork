// =============================================================================
// Libmork — Testes: Sorte (Issue #14)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { applyLuckToRoll } from '../luck';

describe('luck — applyLuckToRoll', () => {
  it('modificador 0 não altera o resultado', () => {
    const result = applyLuckToRoll({ roll: 10, luckModifier: 0, sides: 20 });
    expect(result.final).toBe(10);
    expect(result.original).toBe(10);
    expect(result.wasLuckActivated).toBe(false);
    expect(result.rolls).toEqual([10]);
  });

  it('modificador positivo com RNG que não ativa (>= chance)', () => {
    const rng = () => 0.5; // chance = 0.2, então 0.5 >= 0.2 → não ativa
    const result = applyLuckToRoll({ roll: 10, luckModifier: 1, sides: 20, rng });
    expect(result.final).toBe(10);
    expect(result.wasLuckActivated).toBe(false);
    expect(result.rolls).toEqual([10]);
  });

  it('modificador +1 ativa (chance 0.2) e escolhe maior', () => {
    const rng = (() => {
      let calls = 0;
      return () => {
        if (calls === 0) { calls++; return 0.1; } // ativa (< 0.2)
        return 0.8; // reroll = floor(0.8*20)+1 = 17
      };
    })();
    const result = applyLuckToRoll({ roll: 5, luckModifier: 1, sides: 20, rng });
    expect(result.wasLuckActivated).toBe(true);
    expect(result.original).toBe(5);
    expect(result.final).toBe(17);
    expect(result.rolls).toEqual([5, 17]);
    expect(result.isPenalty).toBe(false);
  });

  it('modificador -2 ativa (chance 0.4) e escolhe menor', () => {
    const rng = (() => {
      let calls = 0;
      return () => {
        if (calls === 0) { calls++; return 0.3; } // ativa (< 0.4)
        return 0.5; // reroll = 11
      };
    })();
    const result = applyLuckToRoll({ roll: 15, luckModifier: -2, sides: 20, rng });
    expect(result.wasLuckActivated).toBe(true);
    expect(result.original).toBe(15);
    expect(result.final).toBe(11);
    expect(result.rolls).toEqual([15, 11]);
    expect(result.isPenalty).toBe(true);
  });

  it('modificador +5 (cap máximo, chance 1.0) sempre ativa e escolhe maior', () => {
    const rng = (() => {
      let calls = 0;
      return () => {
        if (calls === 0) { calls++; return 0.0; } // sempre ativa
        return 0.95; // reroll = 20
      };
    })();
    const result = applyLuckToRoll({ roll: 8, luckModifier: 5, sides: 20, rng });
    expect(result.wasLuckActivated).toBe(true);
    expect(result.luckChance).toBe(1.0);
    expect(result.final).toBe(20);
    expect(result.isPenalty).toBe(false);
  });

  it('modificador -5 (cap mínimo, chance 1.0) sempre ativa e escolhe menor', () => {
    const rng = (() => {
      let calls = 0;
      return () => {
        if (calls === 0) { calls++; return 0.0; } // sempre ativa
        return 0.0; // reroll = 1
      };
    })();
    const result = applyLuckToRoll({ roll: 18, luckModifier: -5, sides: 20, rng });
    expect(result.wasLuckActivated).toBe(true);
    expect(result.luckChance).toBe(1.0);
    expect(result.final).toBe(1);
    expect(result.isPenalty).toBe(true);
  });

  it('modificador fora do cap é truncado para ±5', () => {
    const rng = () => 0.0; // sempre ativa
    const result = applyLuckToRoll({ roll: 10, luckModifier: 10, sides: 20, rng });
    expect(result.luckChance).toBe(1.0); // abs(5) * 0.2
  });

  it('funciona com d6 (dano)', () => {
    const rng = (() => {
      let calls = 0;
      return () => {
        if (calls === 0) { calls++; return 0.1; } // ativa
        return 0.9; // reroll d6 = floor(0.9*6)+1 = 6
      };
    })();
    const result = applyLuckToRoll({ roll: 2, luckModifier: 2, sides: 6, rng });
    expect(result.wasLuckActivated).toBe(true);
    expect(result.final).toBe(6);
    expect(result.rolls).toEqual([2, 6]);
  });

  it('modificador negativo não ativa se RNG >= chance', () => {
    const rng = () => 0.5; // chance -1 = 0.2, 0.5 >= 0.2
    const result = applyLuckToRoll({ roll: 10, luckModifier: -1, sides: 20, rng });
    expect(result.wasLuckActivated).toBe(false);
    expect(result.final).toBe(10);
  });
});
