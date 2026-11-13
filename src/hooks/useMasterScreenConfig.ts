"use client";

import { useCallback, useState } from "react";

// IDs agregadores da issue #89: "mediaPanel" consolida worlds/assets/jukebox e
// "actorsPanel" consolida charactersNpcs/players em contêineres com abas. Os IDs
// legados permanecem válidos apenas para migração do localStorage.
export type ShieldModuleId =
  | "mediaPanel"
  | "actorsPanel"
  | "worlds"
  | "assets"
  | "jukebox"
  | "charactersNpcs"
  | "players"
  | "sessionLog";

export const CONSOLIDATED_MODULES = {
  mediaPanel: ["worlds", "assets", "jukebox"],
  actorsPanel: ["charactersNpcs", "players"],
} as const satisfies Record<
  string,
  readonly Exclude<ShieldModuleId, "mediaPanel" | "actorsPanel" | "sessionLog">[]
>;

export const ALL_SHIELD_MODULES: readonly ShieldModuleId[] = [
  "mediaPanel",
  "actorsPanel",
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
  "sessionLog",
] as const;

export const DEFAULT_SHIELD_LEFT_ORDER: ShieldModuleId[] = ["mediaPanel", "actorsPanel"];

export const DEFAULT_SHIELD_RIGHT_ORDER: ShieldModuleId[] = ["sessionLog"];

export type MasterScreenConfig = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox: boolean;
  showDiceRolls: boolean;
  showCharactersNpcs: boolean;
  showPlayers: boolean;
  showAssets: boolean;
  leftColumnOrder: ShieldModuleId[];
  rightColumnOrder: ShieldModuleId[];
  aiApiKey?: string;
  aiApiEndpoint?: string;
  aiModel?: string;
};

export type MasterScreenConfigPayload = MasterScreenConfig & {
  version?: number;
};

export const DEFAULT_MASTER_SCREEN_CONFIG: MasterScreenConfig = {
  showRoster: true,
  showSessionLog: true,
  showCanvas: true,
  showMap: true,
  showJukebox: true,
  showDiceRolls: true,
  showCharactersNpcs: true,
  showPlayers: true,
  showAssets: true,
  leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
  rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
  aiApiKey: "",
  aiApiEndpoint: "",
  aiModel: "",
};

export const masterScreenConfigKey = "libmork:master-screen-config";

function sanitizeColumnOrder(
  leftInput: unknown,
  rightInput: unknown,
): { left: ShieldModuleId[]; right: ShieldModuleId[] } {
  const isModuleId = (val: unknown): val is ShieldModuleId =>
    typeof val === "string" && ALL_SHIELD_MODULES.includes(val as ShieldModuleId);

  // Migração da issue #89: configs legados com módulos soltos são consolidados em
  // blocos (mediaPanel/actorsPanel). O bloco substitui o primeiro módulo do grupo
  // na coluna; os demais módulos do mesmo grupo são descartados.
  const LEGACY_TO_BLOCK: Record<string, ShieldModuleId> = {
    worlds: "mediaPanel",
    assets: "mediaPanel",
    jukebox: "mediaPanel",
    charactersNpcs: "actorsPanel",
    players: "actorsPanel",
  };

  const sanitizeColumn = (raw: unknown): ShieldModuleId[] => {
    const input = Array.isArray(raw) ? raw.filter(isModuleId) : [];
    const seen = new Set<ShieldModuleId>();
    const result: ShieldModuleId[] = [];
    for (const m of input) {
      const mapped = LEGACY_TO_BLOCK[m] ?? m;
      if (!seen.has(mapped)) {
        seen.add(mapped);
        result.push(mapped);
      }
    }
    return result;
  };

  const cleanLeft = sanitizeColumn(leftInput);
  const cleanRight = sanitizeColumn(rightInput);

  // Um bloco não pode existir nas duas colunas; mantém na primeira ocorrência
  // (coluna esquerda tem precedência, mesma semântica do dedupe legado).
  for (const block of ["mediaPanel", "actorsPanel"] as const) {
    if (cleanLeft.includes(block) && cleanRight.includes(block)) {
      const idx = cleanRight.indexOf(block);
      cleanRight.splice(idx, 1);
    }
  }

  // Any missing modules are appended to their default column
  for (const defaultModule of DEFAULT_SHIELD_LEFT_ORDER) {
    if (!cleanLeft.includes(defaultModule) && !cleanRight.includes(defaultModule)) {
      cleanLeft.push(defaultModule);
    }
  }
  for (const defaultModule of DEFAULT_SHIELD_RIGHT_ORDER) {
    if (!cleanRight.includes(defaultModule) && !cleanLeft.includes(defaultModule)) {
      cleanRight.push(defaultModule);
    }
  }

  return { left: cleanLeft, right: cleanRight };
}

export function sanitizeMasterScreenConfig(value: unknown): MasterScreenConfig {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_MASTER_SCREEN_CONFIG,
      leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
      rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
    };
  }
  const input = value as Record<string, unknown>;
  const { left, right } = sanitizeColumnOrder(input.leftColumnOrder, input.rightColumnOrder);

  return {
    showRoster: typeof input.showRoster === "boolean" ? input.showRoster : true,
    showSessionLog: typeof input.showSessionLog === "boolean" ? input.showSessionLog : true,
    showCanvas: typeof input.showCanvas === "boolean" ? input.showCanvas : true,
    showMap: typeof input.showMap === "boolean" ? input.showMap : true,
    showJukebox: typeof input.showJukebox === "boolean" ? input.showJukebox : true,
    showDiceRolls: typeof input.showDiceRolls === "boolean" ? input.showDiceRolls : true,
    showCharactersNpcs:
      typeof input.showCharactersNpcs === "boolean" ? input.showCharactersNpcs : true,
    showPlayers: typeof input.showPlayers === "boolean" ? input.showPlayers : true,
    showAssets: typeof input.showAssets === "boolean" ? input.showAssets : true,
    leftColumnOrder: left,
    rightColumnOrder: right,
    aiApiKey: typeof input.aiApiKey === "string" ? input.aiApiKey : "",
    aiApiEndpoint: typeof input.aiApiEndpoint === "string" ? input.aiApiEndpoint : "",
    aiModel: typeof input.aiModel === "string" ? input.aiModel : "",
  };
}

export function useMasterScreenConfig() {
  const [config, setConfig] = useState<MasterScreenConfig>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_MASTER_SCREEN_CONFIG };
    try {
      const stored = window.localStorage.getItem(masterScreenConfigKey);
      return stored
        ? sanitizeMasterScreenConfig(JSON.parse(stored))
        : { ...DEFAULT_MASTER_SCREEN_CONFIG };
    } catch {
      return { ...DEFAULT_MASTER_SCREEN_CONFIG };
    }
  });
  const [isLoaded] = useState(true);

  const updateConfig = useCallback((patch: Partial<MasterScreenConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(masterScreenConfigKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({
      ...DEFAULT_MASTER_SCREEN_CONFIG,
      leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
      rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
    });
    try {
      window.localStorage.setItem(
        masterScreenConfigKey,
        JSON.stringify(DEFAULT_MASTER_SCREEN_CONFIG),
      );
    } catch {
      // ignore
    }
  }, []);

  return {
    config,
    isLoaded,
    updateConfig,
    resetConfig,
  };
}
