// =============================================================================
// Libmork — Motor de Regras: Combate (D-19, D-24, D-41)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

import { getModifier, getBlockValue } from "./attributes";

/** Tipo de reação defensiva (D-41) */
export type DefenseReaction = "dodge" | "block";

/** Dados de um combatente na ordem de iniciativa */
export interface Combatant {
  id: string;
  name: string;
  type: "character" | "npc";
  characterId?: string;
  npcId?: string;
  initiative: number;
  actionsRemaining: number;
  maxActions: number;
  hpCurrent: number;
  hpMax: number;
  vigor: number;
  destreza: number;
  level: number;
  avatarUrl?: string | null;
  isFallen?: boolean;
  deathSavesSuccess?: number;
  deathSavesFailure?: number;
  isDead?: boolean;
}

/** Solicitação pendente de reação defensiva */
export interface PendingDefenseReaction {
  id: string;
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  rawDamage: number;
  attackRoll: number;
  isPhysical: boolean;
  actionName?: string;
}

/** Estado completo de uma sessão de combate */
export interface CombatSessionState {
  id: string;
  campaignId: string;
  active: boolean;
  round: number;
  currentTurnIndex: number;
  combatants: Combatant[];
  pendingReaction: PendingDefenseReaction | null;
  logs: Array<{ id: string; timestamp: string; message: string }>;
}

/**
 * Cria uma nova sessão de combate ordenando combatentes por iniciativa descendente (RF-039).
 */
export function createCombatSession(
  campaignId: string,
  rawCombatants: Array<Omit<Combatant, "actionsRemaining" | "maxActions">>
): CombatSessionState {
  const sorted = [...rawCombatants].sort((a, b) => b.initiative - a.initiative);

  const combatants: Combatant[] = sorted.map((c) => ({
    ...c,
    actionsRemaining: 3,
    maxActions: 3,
    deathSavesSuccess: c.deathSavesSuccess ?? 0,
    deathSavesFailure: c.deathSavesFailure ?? 0,
  }));

  return {
    id: `combat_${Date.now()}`,
    campaignId,
    active: true,
    round: 1,
    currentTurnIndex: 0,
    combatants,
    pendingReaction: null,
    logs: [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        message: "Combate iniciado! Ordem de iniciativa definida.",
      },
    ],
  };
}

/**
 * Avança o turno no combate (RF-040, RF-062).
 * Reinicia as 3 ações do próximo combatente e incrementa o round se der a volta.
 */
export function advanceCombatTurn(session: CombatSessionState): CombatSessionState {
  if (!session.active || session.combatants.length === 0) return session;

  let nextIndex = session.currentTurnIndex + 1;
  let newRound = session.round;

  if (nextIndex >= session.combatants.length) {
    nextIndex = 0;
    newRound += 1;
  }

  const updatedCombatants = session.combatants.map((c, idx) => {
    if (idx === nextIndex) {
      return { ...c, actionsRemaining: c.maxActions || 3 };
    }
    return c;
  });

  const nextCombatant = updatedCombatants[nextIndex];

  return {
    ...session,
    round: newRound,
    currentTurnIndex: nextIndex,
    combatants: updatedCombatants,
    logs: [
      {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        message: `Turno de ${nextCombatant.name} (Rodada ${newRound}). Ações: ${nextCombatant.actionsRemaining}/3`,
      },
      ...session.logs.slice(0, 49),
    ],
  };
}

/**
 * Consome ações do turno do combatente atual (RF-040, RF-062).
 */
export function spendCombatActions(
  session: CombatSessionState,
  combatantId: string,
  actionCost: number
): { session: CombatSessionState; success: boolean; message: string } {
  const currentCombatant = session.combatants[session.currentTurnIndex];
  if (!currentCombatant || currentCombatant.id !== combatantId) {
    return { session, success: false, message: "Não é o turno deste combatente." };
  }

  if (currentCombatant.actionsRemaining < actionCost) {
    return {
      session,
      success: false,
      message: `Ações insuficientes (${currentCombatant.actionsRemaining}/${actionCost} necessárias).`,
    };
  }

  const updatedCombatants = session.combatants.map((c) => {
    if (c.id === combatantId) {
      return { ...c, actionsRemaining: Math.max(0, c.actionsRemaining - actionCost) };
    }
    return c;
  });

  return {
    session: { ...session, combatants: updatedCombatants },
    success: true,
    message: `${currentCombatant.name} usou ${actionCost} ação(ões). Restam: ${currentCombatant.actionsRemaining - actionCost}`,
  };
}

/**
 * Processa a rolagem de salvaguarda de morte (RF-042).
 * Dificuldade = 10 - mod Vigor.
 * 3 Sucessos -> Estabilizado (remove Caído).
 * 3 Falhas -> Morto.
 */
export function processDeathSaveRoll(
  currentSuccesses: number,
  currentFailures: number,
  dieRoll: number,
  vigorMod: number
): {
  success: boolean;
  dieRoll: number;
  dc: number;
  newSuccesses: number;
  newFailures: number;
  isStabilized: boolean;
  isDead: boolean;
  details: string;
} {
  const dc = 10 - vigorMod;
  const isSuccess = dieRoll >= dc;

  const newSuccesses = isSuccess ? currentSuccesses + 1 : currentSuccesses;
  const newFailures = !isSuccess ? currentFailures + 1 : currentFailures;

  const isStabilized = newSuccesses >= 3;
  const isDead = newFailures >= 3;

  const details = isSuccess
    ? `D20 [${dieRoll}] >= CD ${dc}: Sucesso no teste de morte (${newSuccesses}/3)!`
    : `D20 [${dieRoll}] < CD ${dc}: Falha no teste de morte (${newFailures}/3)!`;

  return {
    success: isSuccess,
    dieRoll,
    dc,
    newSuccesses,
    newFailures,
    isStabilized,
    isDead,
    details,
  };
}

/**
 * Calcula o dano efetivo após reação defensiva (D-19, D-24).
 *
 * @param rawDamage Dano bruto do ataque
 * @param reaction Reação defensiva escolhida (Esquivar ou Bloqueio)
 * @param attackRoll Resultado da rolagem de ataque (para esquiva)
 * @param defenseValue Valor de defesa estático do alvo (para esquiva)
 * @param vigor Valor de Vigor do defensor (para bloqueio)
 * @param level Nível do defensor (para bloqueio)
 * @param isPhysical Se o dano é físico (bloqueio só funciona contra físico — D-19)
 */
export function resolveAttack(params: {
  rawDamage: number;
  reaction: DefenseReaction;
  attackRoll: number;
  defenseValue: number;
  vigor: number;
  level: number;
  isPhysical: boolean;
}): {
  hit: boolean;
  damageTaken: number;
  blocked: number;
  details: string;
} {
  const { rawDamage, reaction, attackRoll, defenseValue, vigor, level, isPhysical } = params;

  if (reaction === "dodge") {
    // Esquiva: testa contra defesa estática
    const hit = attackRoll >= defenseValue;
    return {
      hit,
      damageTaken: hit ? rawDamage : 0,
      blocked: 0,
      details: hit
        ? `Ataque ${attackRoll} >= Defesa ${defenseValue}: acertou! Dano: ${rawDamage}`
        : `Ataque ${attackRoll} < Defesa ${defenseValue}: esquivou!`,
    };
  }

  // Bloqueio: acerto automático, mas dano mitigado (D-19)
  if (!isPhysical) {
    // Bloqueio só funciona contra dano físico
    return {
      hit: true,
      damageTaken: rawDamage,
      blocked: 0,
      details: `Bloqueio ineficaz contra dano não-físico. Dano total: ${rawDamage}`,
    };
  }

  const blockValue = getBlockValue(vigor, level);
  const damageTaken = Math.max(0, rawDamage - blockValue);

  return {
    hit: true,
    damageTaken,
    blocked: Math.min(blockValue, rawDamage),
    details: `Bloqueio: ${rawDamage} - ${blockValue} (Vigor) = ${damageTaken} dano recebido`,
  };
}

/**
 * Calcula o valor de defesa estática de um personagem (para esquiva).
 * Fórmula: 10 + modificador de Destreza
 */
export function getDefenseValue(destreza: number): number {
  return 10 + getModifier(destreza);
}

/**
 * Verifica se o personagem está caído (0 HP) e deve entrar no fluxo de morte (D-25).
 */
export function shouldEnterDeathFlow(currentHp: number): boolean {
  return currentHp <= 0;
}

/**
 * Calcula a dificuldade do teste de morte (D-25).
 * Fórmula: 10 - modificador de Vigor
 */
export function getDeathSaveDifficulty(vigor: number): number {
  return 10 - getModifier(vigor);
}

/**
 * Calcula stats do Renascimento Fênix (D-25).
 * Metade dos níveis (arredondado para baixo), 50% HP/Mana do novo nível.
 */
export function calculatePhoenixRebirth(
  currentLevel: number,
  vigor: number,
  inteligencia: number,
): {
  newLevel: number;
  newHpMax: number;
  newHpCurrent: number;
  newManaMax: number;
  newManaCurrent: number;
} {
  const newLevel = Math.max(1, Math.floor(currentLevel / 2));
  const newHpMax = 15 + getModifier(vigor) * newLevel;
  const newManaMax = 5 + getModifier(inteligencia) * newLevel;

  return {
    newLevel,
    newHpMax,
    newHpCurrent: Math.floor(newHpMax * 0.5),
    newManaMax,
    newManaCurrent: Math.floor(newManaMax * 0.5),
  };
}

/**
 * Calcula os Pontos de Sombra ganhos na morte definitiva (D-26).
 * Metade do nível do personagem morto, arredondado para baixo.
 */
export function calculateShadowPointsGained(level: number): number {
  return Math.floor(level / 2);
}
