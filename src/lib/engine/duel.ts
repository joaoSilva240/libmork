// =============================================================================
// Libmork — Motor de Regras: Duelo P2P Entre Jogadores (RF-069, D-45)
// =============================================================================
// Gerenciador de estado e ações de Duelos P2P client/socket side (D-45).
// =============================================================================

export interface DuelParticipant {
  id: string;
  characterId: string;
  name: string;
  avatarUrl?: string | null;
  initiative: number;
  actionsRemaining: number;
  maxActions: number;
  hpCurrent: number;
  hpMax: number;
  manaCurrent: number;
  manaMax: number;
  vigor: number;
  destreza: number;
  level: number;
  originalHp: number;
  originalMana: number;
}

export interface PendingDuelReaction {
  id: string;
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  rawDamage: number;
  attackRoll: number;
  isPhysical: boolean;
}

export interface DuelSessionState {
  id: string;
  campaignId: string;
  status: "pending" | "active" | "finished";
  permanentResults: boolean;
  round: number;
  currentTurnIndex: number;
  participants: DuelParticipant[];
  pendingReaction: PendingDuelReaction | null;
  winnerId: string | null;
  logs: Array<{ id: string; timestamp: string; message: string }>;
}

/**
 * Cria um novo duelo em estado pendente.
 */
export function createDuelSession(
  campaignId: string,
  permanentResults: boolean,
  participants: Omit<DuelParticipant, "actionsRemaining" | "maxActions">[]
): DuelSessionState {
  return {
    id: `duel_${Date.now()}`,
    campaignId,
    status: "pending",
    permanentResults,
    round: 1,
    currentTurnIndex: 0,
    participants: participants.map((p) => ({
      ...p,
      actionsRemaining: 3,
      maxActions: 3,
    })),
    pendingReaction: null,
    winnerId: null,
    logs: [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        message: `Desafio de duelo criado! Aguardando aceite dos participantes. (${permanentResults ? "Resultados Permanentes" : "Resultados Temporários"})`,
      },
    ],
  };
}

/**
 * Inicia o duelo após aceite, ordenando por iniciativa.
 */
export function startDuelSession(state: DuelSessionState): DuelSessionState {
  const sorted = [...state.participants].sort((a, b) => b.initiative - a.initiative);
  return {
    ...state,
    status: "active",
    participants: sorted.map((p) => ({ ...p, actionsRemaining: 3 })),
    currentTurnIndex: 0,
    round: 1,
    logs: [
      ...state.logs,
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        message: `Duelo iniciado! Turno de ${sorted[0]?.name}.`,
      },
    ],
  };
}

/**
 * Avança o turno no duelo.
 */
export function advanceDuelTurn(state: DuelSessionState): DuelSessionState {
  if (state.status !== "active" || state.participants.length === 0) return state;

  const nextIndex = (state.currentTurnIndex + 1) % state.participants.length;
  const isNewRound = nextIndex === 0;
  const newRound = isNewRound ? state.round + 1 : state.round;

  const updatedParticipants = state.participants.map((p, idx) =>
    idx === nextIndex ? { ...p, actionsRemaining: 3 } : p
  );

  const activeName = updatedParticipants[nextIndex]?.name ?? "Desconhecido";

  return {
    ...state,
    round: newRound,
    currentTurnIndex: nextIndex,
    participants: updatedParticipants,
    logs: [
      ...state.logs,
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        message: isNewRound
          ? `--- Rodada ${newRound} --- Turno de ${activeName}`
          : `Turno de ${activeName}`,
      },
    ],
  };
}

/**
 * Consome ações no turno de um participante do duelo.
 */
export function spendDuelActions(
  state: DuelSessionState,
  participantId: string,
  cost: number = 1
): { session: DuelSessionState; autoAdvanced: boolean } {
  const pIndex = state.participants.findIndex(
    (p) => p.id === participantId || p.characterId === participantId
  );

  if (pIndex === -1 || pIndex !== state.currentTurnIndex) {
    return { session: state, autoAdvanced: false };
  }

  const p = state.participants[pIndex];
  const newActions = Math.max(0, p.actionsRemaining - cost);

  const updatedParticipants = [...state.participants];
  updatedParticipants[pIndex] = { ...p, actionsRemaining: newActions };

  let nextState: DuelSessionState = {
    ...state,
    participants: updatedParticipants,
  };

  let autoAdvanced = false;
  if (newActions === 0) {
    nextState = advanceDuelTurn(nextState);
    autoAdvanced = true;
  }

  return { session: nextState, autoAdvanced };
}

/**
 * Aplica dano ao participante do duelo e verifica se o duelo terminou.
 */
export function applyDuelDamage(
  state: DuelSessionState,
  targetId: string,
  damageTaken: number
): DuelSessionState {
  let winnerId: string | null = null;

  const updatedParticipants = state.participants.map((p) => {
    if (p.id === targetId || p.characterId === targetId) {
      const newHp = Math.max(0, p.hpCurrent - damageTaken);
      return { ...p, hpCurrent: newHp };
    }
    return p;
  });

  const remaining = updatedParticipants.filter((p) => p.hpCurrent > 0);

  let newStatus = state.status;
  if (remaining.length === 1 && updatedParticipants.length > 1) {
    newStatus = "finished";
    winnerId = remaining[0].characterId;
  }

  return {
    ...state,
    status: newStatus,
    winnerId,
    participants: updatedParticipants,
    logs: [
      ...state.logs,
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        message: `${targetId} recebeu ${damageTaken} de dano! ${
          winnerId ? `Vencedor do duelo: ${remaining[0].name}!` : ""
        }`,
      },
    ],
  };
}

/**
 * Encerra o duelo e retorna o estado final (restaurando HP/Mana se temporário).
 */
export function finishDuelSession(
  state: DuelSessionState,
  winnerId?: string
): { session: DuelSessionState; restoredParticipants: DuelParticipant[] } {
  const restored = state.participants.map((p) => {
    if (!state.permanentResults) {
      return { ...p, hpCurrent: p.originalHp, manaCurrent: p.originalMana };
    }
    return p;
  });

  const finalState: DuelSessionState = {
    ...state,
    status: "finished",
    winnerId: winnerId ?? state.winnerId,
    participants: restored,
    logs: [
      ...state.logs,
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        message: `Duelo finalizado. ${
          !state.permanentResults ? "Status temporários restaurados ao valor original." : "Resultados mantidos permanentemente."
        }`,
      },
    ],
  };

  return { session: finalState, restoredParticipants: restored };
}
