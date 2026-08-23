// =============================================================================
// Libmork — Gerenciador e Registro de Sistemas de Regras (Modular Systems)
// =============================================================================

import type { GameSystem } from "./types";
import { libmorkSystem } from "./systems/libmorkSystem";

const systemsRegistry = new Map<string, GameSystem>();

// Registra sistema padrão
systemsRegistry.set(libmorkSystem.id, libmorkSystem);

/**
 * Registra um novo sistema de regras na engine.
 */
export function registerGameSystem(system: GameSystem): void {
  systemsRegistry.set(system.id, system);
}

/**
 * Retorna uma instância do sistema pelo ID ou o sistema padrão (Libmork).
 */
export function getGameSystem(systemId: string = "libmork"): GameSystem {
  const system = systemsRegistry.get(systemId);
  if (!system) {
    // Fallback para Libmork se o sistema solicitado não estiver registrado
    return libmorkSystem;
  }
  return system;
}

/**
 * Lista todos os sistemas de regras disponíveis.
 */
export function listGameSystems(): Array<{ id: string; name: string; description: string }> {
  return Array.from(systemsRegistry.values()).map((sys) => ({
    id: sys.id,
    name: sys.name,
    description: sys.description,
  }));
}
