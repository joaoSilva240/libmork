// =============================================================================
// Libmork — Fallout 2d20: Testes pendentes de re-rolagem com Pontos de Sorte
// =============================================================================
// Guarda no servidor as faces e os parâmetros de cada teste para que o jogador
// possa re-rolar dado a dado sem que o cliente dite o resultado. Vive em memória
// (mesma natureza do estado de presença do Socket.IO) e expira sozinho.
// =============================================================================

import { randomUUID } from "crypto";
import type {
  FalloutBodyLocation,
  FalloutRollParams,
  FalloutRollResult,
} from "@/lib/systems/fallout/types";

export interface FalloutHitLocation {
  location: FalloutBodyLocation;
  label: string;
  roll: number;
}

export interface PendingFalloutRoll {
  id: string;
  characterId: string;
  campaignId: string | null;
  params: FalloutRollParams;
  values: number[];
  rerolledIndexes: number[];
  result: FalloutRollResult;
  hitLocation: FalloutHitLocation | null;
  createdAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;

const globalForRolls = globalThis as unknown as {
  _falloutPendingRolls?: Map<string, PendingFalloutRoll>;
};

function getStore(): Map<string, PendingFalloutRoll> {
  if (!globalForRolls._falloutPendingRolls) {
    globalForRolls._falloutPendingRolls = new Map();
  }
  return globalForRolls._falloutPendingRolls;
}

function prune(store: Map<string, PendingFalloutRoll>) {
  const now = Date.now();
  for (const [id, roll] of store) {
    if (now - roll.createdAt > TTL_MS) store.delete(id);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function createPendingRoll(
  input: Omit<PendingFalloutRoll, "id" | "createdAt" | "rerolledIndexes">,
): PendingFalloutRoll {
  const store = getStore();
  prune(store);

  const roll: PendingFalloutRoll = {
    ...input,
    id: randomUUID(),
    rerolledIndexes: [],
    createdAt: Date.now(),
  };
  store.set(roll.id, roll);
  return roll;
}

export function getPendingRoll(id: string): PendingFalloutRoll | null {
  const store = getStore();
  prune(store);
  return store.get(id) ?? null;
}

export function clearPendingRolls() {
  getStore().clear();
}
