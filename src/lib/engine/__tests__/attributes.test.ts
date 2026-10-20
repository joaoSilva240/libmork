// =============================================================================
// Libmork — Testes: Atributos e Derivações
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getActiveHeritageBonuses, getActiveHeritageMovementSize, getModifier, getBlockValue, getHeritageHitPointsMax, getMaxHitPoints, getMaxManaPoints, getTrainedSkillSlots, getDerivedStats, transitionRaceHeritageAttributes, validateCreationAttributes } from '../attributes';
import type { AttributeMap } from '../attributes';

describe('attributes — getModifier', () => {
  it('retorna -1 para atributo 8', () => {
    expect(getModifier(8)).toBe(-1);
  });

  it('retorna 0 para atributo 10', () => {
    expect(getModifier(10)).toBe(0);
  });

  it('retorna 0 para atributo 11', () => {
    expect(getModifier(11)).toBe(0);
  });

  it('retorna 4 para atributo 18', () => {
    expect(getModifier(18)).toBe(4);
  });

  it('retorna -5 para atributo 1', () => {
    expect(getModifier(1)).toBe(-5);
  });
});

describe('attributes — getBlockValue', () => {
  it('calcula bloqueio = floor(vigor/2) * nivel', () => {
    expect(getBlockValue(14, 5)).toBe(35); // floor(14/2) * 5 = 7 * 5
  });

  it('retorna 0 para vigor 8 nivel 1', () => {
    expect(getBlockValue(8, 1)).toBe(4); // floor(8/2) * 1 = 4
  });

  it('retorna 0 para vigor 1 nivel 1', () => {
    expect(getBlockValue(1, 1)).toBe(0); // floor(1/2) * 1 = 0
  });

  it('calcula bloqueio para vigor 20 nivel 10', () => {
    expect(getBlockValue(20, 10)).toBe(100); // floor(20/2) * 10 = 10 * 10
  });
});

describe('attributes — getMaxHitPoints', () => {
  it('calcula HP máximo = 15 + mod_vigor * nivel', () => {
    expect(getMaxHitPoints(10, 1)).toBe(15); // 15 + 0 * 1
    expect(getMaxHitPoints(14, 5)).toBe(25); // 15 + 2 * 5
    expect(getMaxHitPoints(8, 3)).toBe(12); // 15 + (-1) * 3
  });
});

describe('attributes — getMaxManaPoints', () => {
  it('calcula Mana máxima = 5 + mod_inteligencia * nivel', () => {
    expect(getMaxManaPoints(10, 1)).toBe(5); // 5 + 0 * 1
    expect(getMaxManaPoints(16, 4)).toBe(17); // 5 + 3 * 4
    expect(getMaxManaPoints(8, 2)).toBe(3); // 5 + (-1) * 2
  });
});

describe('attributes — getTrainedSkillSlots', () => {
  it('calcula slots = floor(inteligencia/2) * nivel', () => {
    expect(getTrainedSkillSlots(10, 1)).toBe(5); // floor(10/2) * 1
    expect(getTrainedSkillSlots(14, 3)).toBe(21); // floor(14/2) * 3 = 7 * 3
    expect(getTrainedSkillSlots(8, 2)).toBe(8); // floor(8/2) * 2 = 4 * 2
  });
});

describe('attributes — getDerivedStats', () => {
  it('calcula todos os stats derivados corretamente', () => {
    const attrs: AttributeMap = {
      forca: 12,
      destreza: 14,
      vigor: 16,
      inteligencia: 10,
      empatia: 8,
      sorte: 12,
    };

    const stats = getDerivedStats(attrs, 3);

    expect(stats.hitPointsMax).toBe(24); // 15 + 3 * 3
    expect(stats.manaPointsMax).toBe(5); // 5 + 0 * 3
    expect(stats.block).toBe(24); // floor(16/2) * 3 = 8 * 3
    expect(stats.trainedSkillSlots).toBe(15); // floor(10/2) * 3 = 5 * 3
    expect(stats.modifiers.forca).toBe(1);
    expect(stats.modifiers.destreza).toBe(2);
    expect(stats.modifiers.vigor).toBe(3);
    expect(stats.modifiers.inteligencia).toBe(0);
    expect(stats.modifiers.empatia).toBe(-1);
    expect(stats.modifiers.sorte).toBe(1);
  });
});

describe('attributes — transitionRaceHeritageAttributes', () => {
  const attributes: AttributeMap = {
    forca: 10,
    destreza: 11,
    vigor: 12,
    inteligencia: 13,
    empatia: 14,
    sorte: 15,
  };
  const heritages = [
    { name: 'A', hitPointsBonus: 2, attributeBonuses: { vigor: 1 } },
    { name: 'B', hitPointsBonus: 3, attributeBonuses: { destreza: 2 } },
  ];

  it('soma somente os bônus das heranças selecionadas', () => {
    const bonusesA = getActiveHeritageBonuses(heritages, ['A']);
    const withBonuses = transitionRaceHeritageAttributes(attributes, {}, bonusesA.attributeBonuses);

    expect(withBonuses).toEqual({
      forca: 10,
      destreza: 11,
      vigor: 13,
      inteligencia: 13,
      empatia: 14,
      sorte: 15,
    });
    expect(getHeritageHitPointsMax(withBonuses, 1, bonusesA.hitPointsBonus)).toBe(18);
  });

  it('acumula, remove parcialmente e é idempotente', () => {
    const bonusesA = getActiveHeritageBonuses(heritages, ['A']);
    const bonusesAB = getActiveHeritageBonuses(heritages, ['A', 'B']);
    const bonusesB = getActiveHeritageBonuses(heritages, ['B']);
    const withA = transitionRaceHeritageAttributes(attributes, {}, bonusesA.attributeBonuses);
    const withAB = transitionRaceHeritageAttributes(withA, bonusesA.attributeBonuses, bonusesAB.attributeBonuses);
    const withB = transitionRaceHeritageAttributes(withAB, bonusesAB.attributeBonuses, bonusesB.attributeBonuses);
    const withoutHeritages = transitionRaceHeritageAttributes(withB, bonusesB.attributeBonuses, {});

    expect(bonusesAB).toEqual({ hitPointsBonus: 5, attributeBonuses: { vigor: 1, destreza: 2 } });
    expect(withB).toEqual({ ...attributes, destreza: 13 });
    expect(withoutHeritages).toEqual(attributes);
    expect(transitionRaceHeritageAttributes(withAB, bonusesAB.attributeBonuses, bonusesAB.attributeBonuses)).toEqual(withAB);
  });

  it('rejeita heranças desconhecidas e duplicadas', () => {
    expect(() => getActiveHeritageBonuses(heritages, ['Desconhecida'])).toThrow('não pertence');
    expect(() => getActiveHeritageBonuses(heritages, ['A', 'A'])).toThrow('duplicatas');
  });
});

describe('attributes — getActiveHeritageMovementSize', () => {
  const race = {
    speed: 30,
    size: 'Médio',
    heritages: [
      { name: 'Ágil', speed: 35, size: 'Pequeno' },
      { name: 'Robusta', speed: 25, size: 'Grande' },
    ],
  };

  it('seleciona a maior velocidade e o maior tamanho das heranças ativas', () => {
    expect(getActiveHeritageMovementSize(race, ['Ágil', 'Robusta'])).toEqual({ speed: 35, size: 'Grande' });
  });

  it('mantém os dados-base para heranças legadas sem deslocamento ou tamanho', () => {
    expect(getActiveHeritageMovementSize({ speed: 30, size: 'Médio', heritages: [{ name: 'Legada' }] }, ['Legada']))
      .toEqual({ speed: 30, size: 'Médio' });
  });

  it('rejeita nomes inexistentes e duplicados', () => {
    expect(() => getActiveHeritageMovementSize(race, ['Inexistente'])).toThrow('não pertence');
    expect(() => getActiveHeritageMovementSize(race, ['Ágil', 'Ágil'])).toThrow('duplicatas');
  });
});

describe('attributes — validateCreationAttributes', () => {
  it('aceita distribuição válida (6*8 + 10 pontos livres = 58)', () => {
    const attrs: AttributeMap = {
      forca: 10,
      destreza: 10,
      vigor: 10,
      inteligencia: 10,
      empatia: 10,
      sorte: 8,
    };
    const result = validateCreationAttributes(attrs);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejeita soma incorreta', () => {
    const attrs: AttributeMap = {
      forca: 20,
      destreza: 20,
      vigor: 20,
      inteligencia: 20,
      empatia: 20,
      sorte: 20,
    };
    const result = validateCreationAttributes(attrs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Soma dos atributos deve ser 58');
  });

  it('rejeita atributo menor que 1', () => {
    const attrs: AttributeMap = {
      forca: 0,
      destreza: 10,
      vigor: 10,
      inteligencia: 10,
      empatia: 18,
      sorte: 10,
    };
    const result = validateCreationAttributes(attrs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não pode ser menor que 1');
  });
});
