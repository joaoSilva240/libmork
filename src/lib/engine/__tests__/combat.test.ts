// =============================================================================
// Libmork — Testes: Sistema de Combate
// =============================================================================

import { describe, it, expect } from 'vitest';
import { createCombatSession, advanceCombatTurn, spendCombatActions, resolveAttack, getDefenseValue, processDeathSaveRoll, applyHpChange, applyHealing, shouldEnterDeathFlow, getDeathSaveDifficulty, calculatePhoenixRebirth, calculateShadowPointsGained } from '../combat';
import type { Combatant, CombatSessionState } from '../combat';
import { ACTIONS_PER_TURN } from '@/lib/utils/constants';

describe('combat — createCombatSession', () => {
  it('ordena combatentes por iniciativa decrescente', () => {
    const rawCombatants = [
      { id: 'a', name: 'Alice', type: 'character' as const, initiative: 10, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
      { id: 'b', name: 'Bob', type: 'character' as const, initiative: 15, hpCurrent: 25, hpMax: 25, vigor: 12, destreza: 12, level: 2 },
      { id: 'c', name: 'Carol', type: 'npc' as const, initiative: 8, hpCurrent: 15, hpMax: 15, vigor: 8, destreza: 14, level: 1 },
    ];

    const session = createCombatSession('campaign-1', rawCombatants);

    expect(session.combatants[0].name).toBe('Bob');
    expect(session.combatants[1].name).toBe('Alice');
    expect(session.combatants[2].name).toBe('Carol');
    expect(session.active).toBe(true);
    expect(session.round).toBe(1);
    expect(session.currentTurnIndex).toBe(0);
  });

  it('inicializa actionsRemaining = ACTIONS_PER_TURN para todos', () => {
    const rawCombatants = [
      { id: 'a', name: 'Alice', type: 'character' as const, initiative: 10, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
    ];

    const session = createCombatSession('campaign-1', rawCombatants);

    expect(session.combatants[0].actionsRemaining).toBe(ACTIONS_PER_TURN);
    expect(session.combatants[0].maxActions).toBe(ACTIONS_PER_TURN);
  });
});

describe('combat — advanceCombatTurn', () => {
  it('avança o índice e reinicia ações do próximo combatente', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'Alice', type: 'character', initiative: 15, actionsRemaining: 0, maxActions: 3, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
      { id: 'b', name: 'Bob', type: 'character', initiative: 10, actionsRemaining: 1, maxActions: 3, hpCurrent: 25, hpMax: 25, vigor: 12, destreza: 12, level: 2 },
    ];

    const session: CombatSessionState = {
      id: 'combat_1',
      campaignId: 'camp1',
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants,
      pendingReaction: null,
      logs: [],
    };

    const next = advanceCombatTurn(session);

    expect(next.currentTurnIndex).toBe(1);
    expect(next.combatants[1].actionsRemaining).toBe(3);
    expect(next.round).toBe(1);
  });

  it('incrementa round quando dá a volta completa', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'Alice', type: 'character', initiative: 15, actionsRemaining: 0, maxActions: 3, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
      { id: 'b', name: 'Bob', type: 'character', initiative: 10, actionsRemaining: 0, maxActions: 3, hpCurrent: 25, hpMax: 25, vigor: 12, destreza: 12, level: 2 },
    ];

    const session: CombatSessionState = {
      id: 'combat_1',
      campaignId: 'camp1',
      active: true,
      round: 1,
      currentTurnIndex: 1,
      combatants,
      pendingReaction: null,
      logs: [],
    };

    const next = advanceCombatTurn(session);

    expect(next.currentTurnIndex).toBe(0);
    expect(next.round).toBe(2);
    expect(next.combatants[0].actionsRemaining).toBe(3);
  });
});

describe('combat — spendCombatActions', () => {
  it('consome ações do combatente atual', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'Alice', type: 'character', initiative: 15, actionsRemaining: 3, maxActions: 3, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
    ];

    const session: CombatSessionState = {
      id: 'c1',
      campaignId: 'camp1',
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants,
      pendingReaction: null,
      logs: [],
    };

    const result = spendCombatActions(session, 'a', 2);

    expect(result.success).toBe(true);
    expect(result.session.combatants[0].actionsRemaining).toBe(1);
  });

  it('avança turno automaticamente se esgotar ações', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'Alice', type: 'character', initiative: 15, actionsRemaining: 3, maxActions: 3, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
      { id: 'b', name: 'Bob', type: 'character', initiative: 10, actionsRemaining: 3, maxActions: 3, hpCurrent: 25, hpMax: 25, vigor: 12, destreza: 12, level: 2 },
    ];

    const session: CombatSessionState = {
      id: 'c1',
      campaignId: 'camp1',
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants,
      pendingReaction: null,
      logs: [],
    };

    const result = spendCombatActions(session, 'a', 3);

    expect(result.success).toBe(true);
    expect(result.session.currentTurnIndex).toBe(1);
    expect(result.session.combatants[1].actionsRemaining).toBe(3);
  });

  it('rejeita se não for o turno do combatente', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'Alice', type: 'character', initiative: 15, actionsRemaining: 3, maxActions: 3, hpCurrent: 20, hpMax: 20, vigor: 10, destreza: 10, level: 1 },
      { id: 'b', name: 'Bob', type: 'character', initiative: 10, actionsRemaining: 3, maxActions: 3, hpCurrent: 25, hpMax: 25, vigor: 12, destreza: 12, level: 2 },
    ];

    const session: CombatSessionState = {
      id: 'c1',
      campaignId: 'camp1',
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants,
      pendingReaction: null,
      logs: [],
    };

    const result = spendCombatActions(session, 'b', 1);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Não é o turno deste combatente');
  });
});

describe('combat — resolveAttack', () => {
  it('esquiva: acerta quando ataque >= defesa', () => {
    const result = resolveAttack({
      rawDamage: 10,
      reaction: 'dodge',
      attackRoll: 15,
      defenseValue: 12,
      vigor: 10,
      level: 1,
      isPhysical: true,
    });

    expect(result.hit).toBe(true);
    expect(result.damageTaken).toBe(10);
    expect(result.blocked).toBe(0);
  });

  it('esquiva: erra quando ataque < defesa', () => {
    const result = resolveAttack({
      rawDamage: 10,
      reaction: 'dodge',
      attackRoll: 10,
      defenseValue: 12,
      vigor: 10,
      level: 1,
      isPhysical: true,
    });

    expect(result.hit).toBe(false);
    expect(result.damageTaken).toBe(0);
  });

  it('bloqueio: acerto automático, mitiga dano físico', () => {
    const result = resolveAttack({
      rawDamage: 20,
      reaction: 'block',
      attackRoll: 15,
      defenseValue: 12,
      vigor: 14, // floor(14/2) * 3 = 7 * 3 = 21
      level: 3,
      isPhysical: true,
    });

    expect(result.hit).toBe(true);
    expect(result.blocked).toBe(20); // bloqueio > dano
    expect(result.damageTaken).toBe(0);
  });

  it('bloqueio não funciona contra dano não-físico', () => {
    const result = resolveAttack({
      rawDamage: 10,
      reaction: 'block',
      attackRoll: 15,
      defenseValue: 12,
      vigor: 14,
      level: 3,
      isPhysical: false,
    });

    expect(result.hit).toBe(true);
    expect(result.damageTaken).toBe(10);
    expect(result.blocked).toBe(0);
  });
});

describe('combat — getDefenseValue', () => {
  it('calcula defesa = 10 + mod_destreza', () => {
    expect(getDefenseValue(10)).toBe(10); // 10 + 0
    expect(getDefenseValue(14)).toBe(12); // 10 + 2
    expect(getDefenseValue(8)).toBe(9); // 10 + (-1)
  });
});

describe('combat — processDeathSaveRoll', () => {
  it('sucesso quando d20 >= DC', () => {
    const result = processDeathSaveRoll(1, 0, 12, 2); // DC = 10 - 2 = 8
    expect(result.success).toBe(true);
    expect(result.newSuccesses).toBe(2);
    expect(result.newFailures).toBe(0);
    expect(result.isStabilized).toBe(false);
  });

  it('estabiliza com 3 sucessos', () => {
    const result = processDeathSaveRoll(2, 0, 15, 1); // DC = 9
    expect(result.success).toBe(true);
    expect(result.newSuccesses).toBe(3);
    expect(result.isStabilized).toBe(true);
  });

  it('morte com 3 falhas', () => {
    const result = processDeathSaveRoll(0, 2, 5, 1); // DC = 9
    expect(result.success).toBe(false);
    expect(result.newFailures).toBe(3);
    expect(result.isDead).toBe(true);
  });
});

describe('combat — applyHpChange', () => {
  it('aplica dano e marca como caído se HP <= 0', () => {
    const combatant: Combatant = {
      id: 'a',
      name: 'Alice',
      type: 'character',
      initiative: 10,
      actionsRemaining: 3,
      maxActions: 3,
      hpCurrent: 10,
      hpMax: 20,
      vigor: 10,
      destreza: 10,
      level: 1,
    };

    const result = applyHpChange(combatant, -15);

    expect(result.hpCurrent).toBe(0);
    expect(result.isFallen).toBe(true);
  });

  it('não ultrapassa HP máximo ao curar', () => {
    const combatant: Combatant = {
      id: 'a',
      name: 'Alice',
      type: 'character',
      initiative: 10,
      actionsRemaining: 3,
      maxActions: 3,
      hpCurrent: 15,
      hpMax: 20,
      vigor: 10,
      destreza: 10,
      level: 1,
    };

    const result = applyHpChange(combatant, 10);

    expect(result.hpCurrent).toBe(20);
  });
});

describe('combat — applyHealing', () => {
  it('cura quantidade absoluta respeitando HP máximo', () => {
    const combatant: Combatant = {
      id: 'a',
      name: 'Alice',
      type: 'character',
      initiative: 10,
      actionsRemaining: 3,
      maxActions: 3,
      hpCurrent: 5,
      hpMax: 20,
      vigor: 10,
      destreza: 10,
      level: 1,
    };

    const result = applyHealing(combatant, 10);

    expect(result.hpCurrent).toBe(15);
  });
});

describe('combat — shouldEnterDeathFlow', () => {
  it('retorna true para HP <= 0', () => {
    expect(shouldEnterDeathFlow(0)).toBe(true);
    expect(shouldEnterDeathFlow(-5)).toBe(true);
  });

  it('retorna false para HP > 0', () => {
    expect(shouldEnterDeathFlow(1)).toBe(false);
  });
});

describe('combat — getDeathSaveDifficulty', () => {
  it('calcula DC = 10 - mod_vigor', () => {
    expect(getDeathSaveDifficulty(10)).toBe(10); // 10 - 0
    expect(getDeathSaveDifficulty(14)).toBe(8); // 10 - 2
    expect(getDeathSaveDifficulty(8)).toBe(11); // 10 - (-1)
  });
});

describe('combat — calculatePhoenixRebirth', () => {
  it('calcula renascimento: metade nível, 50% HP/Mana', () => {
    const result = calculatePhoenixRebirth(6, 14, 12);
    // newLevel = floor(6/2) = 3
    // HP = 15 + 2*3 = 21, 50% = 10
    // Mana = 5 + 1*3 = 8, 50% = 4

    expect(result.newLevel).toBe(3);
    expect(result.newHpMax).toBe(21);
    expect(result.newHpCurrent).toBe(10);
    expect(result.newManaMax).toBe(8);
    expect(result.newManaCurrent).toBe(4);
  });
});

describe('combat — calculateShadowPointsGained', () => {
  it('calcula floor(nivel/2) pontos de sombra', () => {
    expect(calculateShadowPointsGained(5)).toBe(2);
    expect(calculateShadowPointsGained(10)).toBe(5);
    expect(calculateShadowPointsGained(1)).toBe(0);
  });
});
