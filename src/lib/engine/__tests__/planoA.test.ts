// =============================================================================
// Libmork — Testes: Plano A — Normalização de Fórmulas com Tokens @atributo
// =============================================================================

import { describe, it, expect } from 'vitest';
import { normalizeFormulaWithAttributes, rollExpression } from '../dice';

describe('Plano A — normalizeFormulaWithAttributes', () => {
  const modifiers = {
    forca: 3,
    destreza: 2,
    vigor: 1,
    inteligencia: 4,
    empatia: 0,
    sorte: -1,
  };

  it('substitui token @forca por valor do modificador', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @forca', modifiers)).toBe('1d20 + 3');
  });

  it('substitui token @força (com acento) por valor do modificador', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @força', modifiers)).toBe('1d20 + 3');
  });

  it('substitui token @destreza', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @destreza', modifiers)).toBe('1d20 + 2');
  });

  it('substitui token @vigor', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @vigor', modifiers)).toBe('1d20 + 1');
  });

  it('substitui token @inteligencia e @inteligência', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @inteligencia', modifiers)).toBe('1d20 + 4');
    expect(normalizeFormulaWithAttributes('1d20 + @inteligência', modifiers)).toBe('1d20 + 4');
  });

  it('substitui token @empatia', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @empatia', modifiers)).toBe('1d20 + 0');
  });

  it('substitui token @sorte (incluindo valor negativo)', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @sorte', modifiers)).toBe('1d20 + -1');
  });

  it('substitui múltiplos tokens na mesma fórmula', () => {
    expect(normalizeFormulaWithAttributes('2d6 + @forca + @destreza', modifiers)).toBe('2d6 + 3 + 2');
  });

  it('case-insensitive: @FORCA, @Forca, @fOrCa', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @FORCA', modifiers)).toBe('1d20 + 3');
    expect(normalizeFormulaWithAttributes('1d20 + @Forca', modifiers)).toBe('1d20 + 3');
    expect(normalizeFormulaWithAttributes('1d20 + @fOrCa', modifiers)).toBe('1d20 + 3');
  });

  it('retorna null para token @desconhecido', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @carisma', modifiers)).toBe(null);
    expect(normalizeFormulaWithAttributes('1d20 + @agilidade', modifiers)).toBe(null);
    expect(normalizeFormulaWithAttributes('1d20 + @sabedoria', modifiers)).toBe(null);
  });

  it('retorna null quando @ é usado sem atributo válido', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @123', modifiers)).toBe(null);
    expect(normalizeFormulaWithAttributes('1d20 + @', modifiers)).toBe(null);
  });

  it('preserva fórmulas sem tokens de atributo', () => {
    expect(normalizeFormulaWithAttributes('1d20 + 5', modifiers)).toBe('1d20 + 5');
    expect(normalizeFormulaWithAttributes('2d6 + 3', modifiers)).toBe('2d6 + 3');
    expect(normalizeFormulaWithAttributes('1d8', modifiers)).toBe('1d8');
  });

  it('retorna 1d20 para valores vazios ou null/undefined', () => {
    expect(normalizeFormulaWithAttributes(null, modifiers)).toBe('1d20');
    expect(normalizeFormulaWithAttributes(undefined, modifiers)).toBe('1d20');
    expect(normalizeFormulaWithAttributes('', modifiers)).toBe('1d20');
    expect(normalizeFormulaWithAttributes('   ', modifiers)).toBe('1d20');
  });

  it('não substitui "d" de dado por atributo', () => {
    expect(normalizeFormulaWithAttributes('1d20', modifiers)).toBe('1d20');
    expect(normalizeFormulaWithAttributes('2d6', modifiers)).toBe('2d6');
  });

  it('aceita atributo ausente do mapa de modificadores (usa 0 como fallback)', () => {
    expect(normalizeFormulaWithAttributes('1d20 + @forca', {})).toBe('1d20 + 0');
    expect(normalizeFormulaWithAttributes('1d20 + @vigor', { forca: 5 })).toBe('1d20 + 0');
  });
});

describe('Plano A — integração com rollExpression', () => {
  const modifiers = {
    forca: 3,
    destreza: 2,
    vigor: 1,
    inteligencia: 4,
    empatia: 0,
    sorte: -1,
  };

  it('rollExpression processa @forca quando modifiers é fornecido', () => {
    const result = rollExpression('1d20 + @forca', 0, { modifiers, rng: () => 0.5 });
    expect(result.valid).toBe(true);
    expect(result.total).toBe(14); // 11 (d20) + 3 (força)
  });

  it('rollExpression processa múltiplos tokens', () => {
    const result = rollExpression('2d6 + @forca + @destreza', 0, { modifiers, rng: () => 0.5 });
    expect(result.valid).toBe(true);
    expect(result.total).toBe(13); // 4 + 4 (2d6) + 3 (força) + 2 (destreza)
  });

  it('rollExpression rejeita token desconhecido', () => {
    const result = rollExpression('1d20 + @carisma', 0, { modifiers });
    expect(result.valid).toBe(false);
    expect(result.total).toBe(0);
  });

  it('rollExpression sem modifiers não altera fórmula', () => {
    const result = rollExpression('1d20 + 5', 0, { rng: () => 0.5 });
    expect(result.valid).toBe(true);
    expect(result.total).toBe(16); // 11 + 5
  });

  it('rollExpression com modifiers vazios usa 0 como fallback', () => {
    const result = rollExpression('1d20 + @forca', 0, { modifiers: {}, rng: () => 0.5 });
    expect(result.valid).toBe(true);
    expect(result.total).toBe(11); // 11 + 0
  });
});
