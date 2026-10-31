// =============================================================================
// Libmork — Sistema MISSING — Edição ZERO: Motor de Regras
// Horror Analógico e Investigação Minimalista
// =============================================================================

import type {
  ConnectionType,
  DiceOutcome,
  ForcedTestResult,
  HabitantLine,
  InvestigationConnection,
  MissingEquipment,
  MissingThreat,
  TestResult,
  TestType,
} from "./types";

/**
 * Rola um dado de seis faces (1 a 6).
 */
export function roll1d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Rola dois dados de seis faces [d1, d2].
 */
export function roll2d6(): [number, number] {
  return [roll1d6(), roll1d6()];
}

/**
 * Avalia o resultado binário do teste conforme regra de MISSING:
 * 1-3 = Perda (loss)
 * 4-6 = Ganho (gain)
 */
export function resolveDiceOutcome(value: number): DiceOutcome {
  return value >= 4 ? "gain" : "loss";
}

/**
 * Resolve um teste em MISSING (Comum, Provável ou Improvável).
 *
 * - Comum: rola 1d6. Usa dice[0]. Bônus de apoio soma ao dado.
 * - Provável: rola 2d6. Escolhe o maior dado. Bônus de apoio soma ao maior dado.
 * - Improvável: rola 2d6. Escolhe o menor dado. Conforme o livro (pág. 13), o bônus de
 *   apoio concede +1 ao maior dado do teste original, mantendo o menor dado como decisivo.
 */
export function resolveTest(params: {
  type: TestType;
  dice: number[];
  supportGains?: number;
}): TestResult {
  const { type, dice } = params;
  const safeDice = dice.length > 0 ? dice : [1];
  const supportBonus = Math.max(0, params.supportGains ?? 0);

  let selectedDie: number;
  let effectiveTotal: number;
  let details: string;

  if (type === "common") {
    selectedDie = safeDice[0];
    effectiveTotal = selectedDie + supportBonus;
    const outcome = resolveDiceOutcome(effectiveTotal);
    details =
      supportBonus > 0
        ? `Teste comum: dado [${selectedDie}] + bônus de apoio (${supportBonus}) = ${effectiveTotal} (${outcome === "gain" ? "Ganho" : "Perda"}).`
        : `Teste comum: dado [${selectedDie}] (${outcome === "gain" ? "Ganho" : "Perda"}).`;

    return {
      type,
      dice: safeDice,
      selectedDie,
      supportBonus,
      effectiveTotal,
      outcome,
      details,
    };
  }

  if (type === "probable") {
    selectedDie = Math.max(...safeDice);
    effectiveTotal = selectedDie + supportBonus;
    const outcome = resolveDiceOutcome(effectiveTotal);
    details =
      supportBonus > 0
        ? `Teste provável: dados [${safeDice.join(", ")}], maior dado ${selectedDie} + bônus de apoio (${supportBonus}) = ${effectiveTotal} (${outcome === "gain" ? "Ganho" : "Perda"}).`
        : `Teste provável: dados [${safeDice.join(", ")}], maior dado ${selectedDie} (${outcome === "gain" ? "Ganho" : "Perda"}).`;

    return {
      type,
      dice: safeDice,
      selectedDie,
      supportBonus,
      effectiveTotal,
      outcome,
      details,
    };
  }

  // Improbable
  selectedDie = Math.min(...safeDice);
  effectiveTotal = selectedDie;
  const outcome = resolveDiceOutcome(effectiveTotal);
  details =
    supportBonus > 0
      ? `Teste improvável: dados [${safeDice.join(", ")}], menor dado ${selectedDie} (bônus de apoio +${supportBonus} somado ao maior dado). Total efetivo: ${effectiveTotal} (${outcome === "gain" ? "Ganho" : "Perda"}).`
      : `Teste improvável: dados [${safeDice.join(", ")}], menor dado ${selectedDie} (${outcome === "gain" ? "Ganho" : "Perda"}).`;

  return {
    type,
    dice: safeDice,
    selectedDie,
    supportBonus,
    effectiveTotal,
    outcome,
    details,
  };
}

/**
 * Força um teste através do uso de um equipamento importante ativo (Manual, pág. 13).
 *
 * - Valida se o equipamento está ativo. Se estiver "lost", lança exceção.
 * - Substitui o dado único (teste comum) ou o menor dado (teste provável/improvável).
 * - O novo resultado é obrigatório, mesmo que inferior.
 * - Caso o novo desfecho resulte em Perda (loss), o equipamento é inutilizado/perdido.
 */
export function resolveForcedTest(params: {
  originalResult: TestResult;
  forcedDie: number;
  equipment: MissingEquipment;
}): ForcedTestResult {
  const { originalResult, forcedDie, equipment } = params;

  if (equipment.status !== "active") {
    throw new Error("Não é possível forçar o teste com um equipamento inativo ou perdido.");
  }

  if (forcedDie < 1 || forcedDie > 6) {
    throw new Error("O dado forçado deve estar entre 1 e 6.");
  }

  const supportBonus = originalResult.supportBonus;
  let newSelectedDie: number;
  let effectiveTotal: number;

  if (originalResult.type === "common") {
    newSelectedDie = forcedDie;
    effectiveTotal = newSelectedDie + supportBonus;
  } else if (originalResult.type === "probable") {
    const dice = [...originalResult.dice];
    let minIndex = 0;
    for (let i = 1; i < dice.length; i++) {
      if (dice[i] < dice[minIndex]) {
        minIndex = i;
      }
    }
    dice[minIndex] = forcedDie;
    newSelectedDie = Math.max(...dice);
    effectiveTotal = newSelectedDie + supportBonus;
  } else {
    // improbable
    const dice = [...originalResult.dice];
    let minIndex = 0;
    for (let i = 1; i < dice.length; i++) {
      if (dice[i] < dice[minIndex]) {
        minIndex = i;
      }
    }
    dice[minIndex] = forcedDie;
    newSelectedDie = Math.min(...dice);
    effectiveTotal = newSelectedDie;
  }

  const outcome = resolveDiceOutcome(effectiveTotal);
  const equipmentLost = outcome === "loss";
  const details = `Teste forçado com '${equipment.name}': novo dado [${forcedDie}]. Total efetivo: ${effectiveTotal} (${outcome === "gain" ? "Ganho" : "Perda"}). ${
    equipmentLost
      ? `Equipamento '${equipment.name}' foi perdido/danificado.`
      : `Equipamento '${equipment.name}' preservado.`
  }`;

  return {
    originalResult,
    forcedDie,
    equipmentUsedId: equipment.id,
    newSelectedDie,
    effectiveTotal,
    outcome,
    equipmentLost,
    details,
  };
}

/**
 * Calcula a quantidade de rasuras provocadas por uma Perda em teste.
 * Regra do PDF (pág. 15 e 22): 1 rasura base + soma dos níveis de perigo de todas
 * as ameaças ativas na cena.
 */
export function calculateErasuresOnLoss(activeThreats?: Array<{ dangerLevel: number }>): number {
  if (!activeThreats || activeThreats.length === 0) {
    return 1;
  }
  const threatSum = activeThreats.reduce((sum, t) => sum + (t.dangerLevel || 0), 0);
  return 1 + threatSum;
}

/**
 * Valida o limite estrito de perigo da cena (Manual, pág. 22).
 * A soma dos Níveis de Perigo de todas as ameaças ativas nunca deve ultrapassar 3.
 */
export function validateSceneDanger(threats: Array<{ dangerLevel: number }>): {
  valid: boolean;
  totalDanger: number;
} {
  const totalDanger = (threats || []).reduce((sum, t) => sum + (t.dangerLevel || 0), 0);
  return {
    valid: totalDanger <= 3,
    totalDanger,
  };
}

/**
 * Verifica se o Habitante desapareceu da existência (Manual, pág. 15).
 * Um habitante desaparece se e somente se todas as suas linhas do Registro
 * estiverem rasuradas (isErased === true) e houver ao menos 1 linha registrada.
 */
export function checkHabitantDisappearance(lines: HabitantLine[]): boolean {
  if (!lines || lines.length === 0) {
    return false;
  }
  return lines.every((line) => line.isErased === true);
}

/**
 * Avalia se o grupo pode declarar uma Epifania com a Teia de Investigação (Manual, pág. 20).
 *
 * - Estágio 1: Requer ao menos 1 conexão de cada tipo (cause, origin, perspective).
 * - Estágio 2+: Requer progressivamente ao menos 2 conexões de cada tipo.
 */
export function canDeclareEpiphany(
  connections: InvestigationConnection[],
  currentStage: number,
): {
  canDeclare: boolean;
  requiredPerType: number;
  currentCounts: Record<ConnectionType, number>;
} {
  const requiredPerType = currentStage <= 1 ? 1 : 2;
  const currentCounts: Record<ConnectionType, number> = {
    cause: 0,
    origin: 0,
    perspective: 0,
  };

  for (const conn of connections || []) {
    if (conn.type in currentCounts) {
      currentCounts[conn.type]++;
    }
  }

  const canDeclare =
    currentCounts.cause >= requiredPerType &&
    currentCounts.origin >= requiredPerType &&
    currentCounts.perspective >= requiredPerType;

  return {
    canDeclare,
    requiredPerType,
    currentCounts,
  };
}

/**
 * Reduz em 1 o Nível de Perigo de uma ameaça ao obter Ganho direcionado a ela (Manual, pág. 22).
 * Ao chegar a 0, a ameaça é terminada/eliminada.
 */
export function reduceThreatDanger(threat: MissingThreat): {
  newDangerLevel: number;
  isTerminated: boolean;
} {
  const newDangerLevel = Math.max(0, threat.dangerLevel - 1);
  const isTerminated = newDangerLevel <= 0;
  return {
    newDangerLevel,
    isTerminated,
  };
}
