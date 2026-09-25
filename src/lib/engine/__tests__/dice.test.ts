// =============================================================================
// Libmork — Testes: Rolagem de Dados
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollDie, rollDice, rollD20WithModifier, rollDualD20Sum, rollWithAdvantage, rollWithDisadvantage, resolveTest, rollDeathSave, rollExpression, getExpression, normalizeSkillExpression } from '../dice';

describe('dice — rollDie', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('retorna 1 quando random é 0', () => {
    randomSpy.mockReturnValue(0);
    expect(rollDie(20)).toBe(1);
  });

  it('retorna 20 quando random é 0.999', () => {
    randomSpy.mockReturnValue(0.999);
    expect(rollDie(20)).toBe(20);
  });

  it('retorna 6 quando random é 0.5 e dado é d6', () => {
    randomSpy.mockReturnValue(0.5);
    expect(rollDie(6)).toBe(4); // floor(0.5 * 6) + 1 = 3 + 1 = 4
  });
});

describe('dice — rollDice', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('retorna array de resultados', () => {
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.999);
    const result = rollDice(3, 20);
    expect(result).toEqual([1, 11, 20]);
  });

  it('retorna array vazio para count 0', () => {
    const result = rollDice(0, 20);
    expect(result).toEqual([]);
  });
});

describe('dice — rollD20WithModifier', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('retorna dado + modificador', () => {
    randomSpy.mockReturnValue(0.5); // d20 = 11
    const result = rollD20WithModifier(3);
    expect(result.die).toBe(11);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(14);
  });
});

describe('dice — rollDualD20Sum', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('soma dois d20', () => {
    randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);
    const result = rollDualD20Sum();
    expect(result.dice).toEqual([11, 19]);
    expect(result.total).toBe(30);
  });
});

describe('dice — rollWithAdvantage', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('retorna o maior dos dois dados', () => {
    randomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const result = rollWithAdvantage();
    expect(result.dice).toEqual([3, 19]);
    expect(result.result).toBe(19);
  });
});

describe('dice — rollWithDisadvantage', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('retorna o menor dos dois dados', () => {
    randomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const result = rollWithDisadvantage();
    expect(result.dice).toEqual([3, 19]);
    expect(result.result).toBe(3);
  });
});

describe('dice — resolveTest', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('d20_mod sem vantagem: sucesso', () => {
    randomSpy.mockReturnValue(0.9); // d20 = 19
    const result = resolveTest('d20_mod', 2, 15, false);
    expect(result.success).toBe(true);
    expect(result.total).toBe(21);
    expect(result.details).toContain('19');
  });

  it('d20_mod sem vantagem: falha', () => {
    randomSpy.mockReturnValue(0.1); // d20 = 3
    const result = resolveTest('d20_mod', 1, 10, false);
    expect(result.success).toBe(false);
    expect(result.total).toBe(4);
  });

  it('d20_mod com vantagem: pega o maior', () => {
    randomSpy.mockReturnValueOnce(0.2).mockReturnValueOnce(0.8);
    const result = resolveTest('d20_mod', 2, 15, true);
    expect(result.total).toBe(19); // 17 + 2
    expect(result.success).toBe(true);
  });

  it('dual_d20_sum: soma ambos dados', () => {
    randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);
    const result = resolveTest('dual_d20_sum', 3, 20, false);
    expect(result.total).toBe(25); // 11 + 11 + 3
    expect(result.success).toBe(true);
  });
});

describe('dice — rollDeathSave', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('sucesso quando d20 >= 10 - mod_vigor', () => {
    randomSpy.mockReturnValue(0.9); // d20 = 19
    const result = rollDeathSave(2); // DC = 10 - 2 = 8
    expect(result.success).toBe(true);
    expect(result.die).toBe(19);
    expect(result.difficulty).toBe(8);
  });

  it('falha quando d20 < DC', () => {
    randomSpy.mockReturnValue(0.1); // d20 = 3
    const result = rollDeathSave(-1); // DC = 10 - (-1) = 11
    expect(result.success).toBe(false);
    expect(result.die).toBe(3);
    expect(result.difficulty).toBe(11);
  });
});

describe('dice — getExpression', () => {
  it('retorna string diretamente', () => {
    expect(getExpression('2d6+3')).toBe('2d6+3');
  });

  it('retorna number diretamente', () => {
    expect(getExpression(10)).toBe(10);
  });

  it('extrai formula de objeto', () => {
    expect(getExpression({ formula: '1d20' })).toBe('1d20');
  });

  it('retorna null para valores inválidos', () => {
    expect(getExpression(null)).toBe(null);
    expect(getExpression(undefined)).toBe(null);
    expect(getExpression({})).toBe(null);
  });
});

describe('dice — rollExpression', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('rola expressão 2d6+3', () => {
    randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.8);
    const result = rollExpression('2d6+3');
    expect(result.valid).toBe(true);
    expect(result.total).toBe(12); // 4 + 5 + 3
  });

  it('retorna fallback para expressão inválida', () => {
    const result = rollExpression('eval()', 5);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(5);
  });

  it('aceita número direto', () => {
    const result = rollExpression(10);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(10);
  });
});

describe('dice — normalizeSkillExpression', () => {
  const baseAttributes = {
    forca: 16, // mod = +3
    destreza: 14, // mod = +2
    vigor: 12, // mod = +1
    inteligencia: 18, // mod = +4
    empatia: 10, // mod = 0
  };

  const modifiers = {
    forca: 3,
    destreza: 2,
    vigor: 1,
    inteligencia: 4,
    empatia: 0,
  };

  it('substitui 1d20 + Destreza pelo valor do modificador (+2) e NÃO pelo valor base (14)', () => {
    // Prova que 1d20 + Destreza usa o modificador (2) e não o atributo base (14)
    expect(baseAttributes.destreza).toBe(14);
    expect(modifiers.destreza).toBe(2);
    expect(normalizeSkillExpression('1d20 + Destreza', modifiers)).toBe('1d20 + 2');
    expect(normalizeSkillExpression('1d20 + Destreza', modifiers)).not.toBe('1d20 + 14');
  });

  it('normaliza quando expressão é apenas um atributo ou contém atributo com e sem acento', () => {
    expect(normalizeSkillExpression('força', modifiers)).toBe('1d20 + 3');
    expect(normalizeSkillExpression('forca', modifiers)).toBe('1d20 + 3');
    expect(normalizeSkillExpression('1d20 + Força', modifiers)).toBe('1d20 + 3');
    expect(normalizeSkillExpression('inteligência', modifiers)).toBe('1d20 + 4');
    expect(normalizeSkillExpression('inteligencia', modifiers)).toBe('1d20 + 4');
    expect(normalizeSkillExpression('1d20 + Inteligência', modifiers)).toBe('1d20 + 4');
    expect(normalizeSkillExpression('sorte', { sorte: 2 })).toBe('1d20 + 2');
  });

  it('preserve fórmulas numéricas', () => {
    expect(normalizeSkillExpression('1d20 + 5', modifiers)).toBe('1d20 + 5');
    expect(normalizeSkillExpression('2d6 + 1', modifiers)).toBe('2d6 + 1');
  });

  it('retorna null para expressão com token alfabético desconhecido e nomes/descrições narrativos', () => {
    expect(normalizeSkillExpression('1d20 + carisma', modifiers)).toBe(null);
    expect(normalizeSkillExpression('agilidade + 2', modifiers)).toBe(null);
    expect(normalizeSkillExpression('Ataque de Espada Sangrenta', modifiers)).toBe(null);
    expect(normalizeSkillExpression('Bola de Fogo + 3', modifiers)).toBe(null);
  });

  it('retorna 1d20 para valores vazios ou null/undefined', () => {
    expect(normalizeSkillExpression(null, modifiers)).toBe('1d20');
    expect(normalizeSkillExpression(undefined, modifiers)).toBe('1d20');
    expect(normalizeSkillExpression('', modifiers)).toBe('1d20');
    expect(normalizeSkillExpression('   ', modifiers)).toBe('1d20');
  });
});

describe('dice — sorte (Issue #14)', () => {
  it('modificador 0 não altera e não consome RNG adicional', () => {
    let rngCalls = 0;
    const rng = () => {
      rngCalls++;
      return 0.5; // d20 = 11
    };
    const res = rollD20WithModifier(2, 0, rng);
    expect(res.die).toBe(11);
    expect(res.total).toBe(13);
    expect(res.luckActivated).toBe(false);
    expect(rngCalls).toBe(1); // Consumiu apenas 1 chamada de RNG para o dado
  });

  it('modificador positivo ativa e escolhe o maior', () => {
    const sequence = [0.1, 0.05, 0.9]; // 1º: rollDie=3; 2º: chance=0.05 (< 0.2, ativa); 3º: reroll=19
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollD20WithModifier(0, 1, rng);
    expect(res.luckActivated).toBe(true);
    expect(res.die).toBe(19);
    expect(res.luckRoll?.original).toBe(3);
    expect(res.luckRoll?.rolls).toEqual([3, 19]);
  });

  it('modificador negativo ativa e escolhe o menor', () => {
    const sequence = [0.8, 0.05, 0.1]; // 1º: rollDie=17; 2º: chance=0.05 (< 0.2, ativa); 3º: reroll=3
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollD20WithModifier(0, -1, rng);
    expect(res.luckActivated).toBe(true);
    expect(res.die).toBe(3);
    expect(res.luckRoll?.original).toBe(17);
    expect(res.luckRoll?.rolls).toEqual([17, 3]);
  });

  it('vantagem: aplica vantagem primeiro e uma única camada de sorte no resultado escolhido', () => {
    // 1º d20: 0.1 (3)
    // 2º d20: 0.5 (11) -> escolhido 11
    // chance de sorte: 0.05 (< 0.2, ativa)
    // reroll sorte: 0.9 (19)
    const sequence = [0.1, 0.5, 0.05, 0.9];
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollWithAdvantage(1, rng);
    expect(res.dice).toEqual([3, 11]);
    expect(res.result).toBe(19);
    expect(res.luckActivated).toBe(true);
    expect(res.luckRoll?.original).toBe(11);
    expect(res.luckRoll?.rolls).toEqual([11, 19]);
  });

  it('desvantagem: aplica desvantagem primeiro e uma única camada de sorte no resultado escolhido', () => {
    // 1º d20: 0.8 (17)
    // 2º d20: 0.5 (11) -> escolhido 11
    // chance de sorte: 0.05 (< 0.2, ativa)
    // reroll sorte: 0.9 (19)
    const sequence = [0.8, 0.5, 0.05, 0.9];
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollWithDisadvantage(1, rng);
    expect(res.dice).toEqual([17, 11]);
    expect(res.result).toBe(19); // 19 > 11 (sorte positiva escolhe maior)
    expect(res.luckActivated).toBe(true);
    expect(res.luckRoll?.original).toBe(11);
  });

  it('rollDeathSave com sorte', () => {
    const sequence = [0.1, 0.05, 0.9]; // base=3, chance ativa, reroll=19
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollDeathSave(0, 1, rng); // DC = 10
    expect(res.success).toBe(true);
    expect(res.die).toBe(19);
    expect(res.luckActivated).toBe(true);
  });

  it('rollExpression aplica sorte em cada dado com seus respectivos lados e não mexe em constantes', () => {
    // Expressão "1d6 + 4" com sorte +1
    // 1º: rollDie(6) -> 0.1 (1)
    // 2º: chance -> 0.05 (< 0.2, ativa)
    // 3º: reroll(6) -> 0.9 (6)
    const sequence = [0.1, 0.05, 0.9];
    let idx = 0;
    const rng = () => sequence[idx++];
    const res = rollExpression("1d6 + 4", 0, { luckModifier: 1, rng });
    expect(res.total).toBe(10); // 6 + 4
    expect(res.luckActivated).toBe(true);
    expect(res.luckDetails?.[0].rolls).toEqual([1, 6]);
  });

  it('resolveTest sem dupla aplicação em d20_mod', () => {
    let rngCalls = 0;
    const rng = () => {
      rngCalls++;
      return 0.5; // d20 = 11
    };
    const res = resolveTest("d20_mod", 3, 10, false, 0, rng);
    expect(res.total).toBe(14); // 11 + 3
    expect(res.success).toBe(true);
    expect(rngCalls).toBe(1); // Apenas 1 chamada de RNG
  });

  it('simulação estatística de 10.000 iterações com sorte +1 (taxa de ativação ~20%)', () => {
    let activatedCount = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      const res = rollD20WithModifier(0, 1);
      if (res.luckActivated) {
        activatedCount++;
        // Se ativado, o resultado final deve ser >= original
        expect(res.die).toBeGreaterThanOrEqual(res.luckRoll!.original);
      }
    }
    const activationRate = activatedCount / iterations;
    // Com 10.000 iterações, a taxa esperada é 0.20, com tolerância ±0.03
    expect(activationRate).toBeGreaterThan(0.17);
    expect(activationRate).toBeLessThan(0.23);
  });
});
