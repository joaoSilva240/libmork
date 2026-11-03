// =============================================================================
// Libmork — Contenção do grid do Escudo do Mestre (Gestão | Mesa | Log)
// =============================================================================

export const SHIELD_LEFT_MIN = 200;
export const SHIELD_LEFT_MAX = 380;
export const SHIELD_RIGHT_MIN = 240;
export const SHIELD_RIGHT_MAX = 420;
export const SHIELD_CENTER_MIN = 380;
/** Equivalente ao `gap-2.5` do Tailwind. */
export const SHIELD_GRID_GAP = 10;

export type ShieldSide = "left" | "right";

const LEFT_TRACK = `minmax(${SHIELD_LEFT_MIN}px, clamp(${SHIELD_LEFT_MIN}px, var(--w-l), ${SHIELD_LEFT_MAX}px))`;
const CENTER_TRACK = `minmax(${SHIELD_CENTER_MIN}px, 1fr)`;
const RIGHT_TRACK = `minmax(${SHIELD_RIGHT_MIN}px, clamp(${SHIELD_RIGHT_MIN}px, var(--w-r), ${SHIELD_RIGHT_MAX}px))`;

export function getShieldGridTemplate(showSessionLog: boolean): string {
  return showSessionLog
    ? `${LEFT_TRACK} ${CENTER_TRACK} ${RIGHT_TRACK}`
    : `${LEFT_TRACK} ${CENTER_TRACK}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface ShieldColumnWidths {
  left: number;
  right: number;
}

export interface ShieldLayoutInput extends ShieldColumnWidths {
  /** Largura útil do contêiner do grid em px. `0`/desconhecida desativa a contenção pela janela. */
  containerWidth: number;
  showSessionLog: boolean;
}

/** Espaço disponível para as colunas laterais preservando o mínimo da coluna central. */
function getSideBudget(containerWidth: number, showSessionLog: boolean): number {
  const gaps = (showSessionLog ? 2 : 1) * SHIELD_GRID_GAP;
  return containerWidth - gaps - SHIELD_CENTER_MIN;
}

/**
 * Largura máxima que uma coluna lateral pode assumir sem empurrar a coluna
 * central abaixo de {@link SHIELD_CENTER_MIN}.
 */
export function getMaxSideWidth(side: ShieldSide, input: ShieldLayoutInput): number {
  const min = side === "left" ? SHIELD_LEFT_MIN : SHIELD_RIGHT_MIN;
  const max = side === "left" ? SHIELD_LEFT_MAX : SHIELD_RIGHT_MAX;
  if (!input.containerWidth || input.containerWidth <= 0) return max;

  const budget = getSideBudget(input.containerWidth, input.showSessionLog);
  const other =
    side === "left"
      ? input.showSessionLog
        ? clamp(input.right, SHIELD_RIGHT_MIN, SHIELD_RIGHT_MAX)
        : 0
      : clamp(input.left, SHIELD_LEFT_MIN, SHIELD_LEFT_MAX);

  return clamp(budget - other, min, max);
}

/**
 * Ajusta as larguras laterais para caberem no contêiner: limita cada coluna
 * aos seus extremos e, se a soma estrangular a coluna central, reduz as
 * laterais proporcionalmente ao excedente (sem passar dos mínimos).
 */
export function fitShieldColumns(input: ShieldLayoutInput): ShieldColumnWidths {
  let left = clamp(input.left, SHIELD_LEFT_MIN, SHIELD_LEFT_MAX);
  let right = clamp(input.right, SHIELD_RIGHT_MIN, SHIELD_RIGHT_MAX);

  if (!input.containerWidth || input.containerWidth <= 0) return { left, right };

  const budget = getSideBudget(input.containerWidth, input.showSessionLog);

  if (!input.showSessionLog) {
    return { left: clamp(Math.min(left, budget), SHIELD_LEFT_MIN, SHIELD_LEFT_MAX), right };
  }

  const overflow = left + right - budget;
  if (overflow <= 0) return { left, right };

  const leftSlack = left - SHIELD_LEFT_MIN;
  const rightSlack = right - SHIELD_RIGHT_MIN;
  const totalSlack = leftSlack + rightSlack;
  if (totalSlack <= 0) return { left, right };

  const reduction = Math.min(overflow, totalSlack);
  left -= (reduction * leftSlack) / totalSlack;
  right -= (reduction * rightSlack) / totalSlack;

  return { left: Math.floor(left), right: Math.floor(right) };
}
