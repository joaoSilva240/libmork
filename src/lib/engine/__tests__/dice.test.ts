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
