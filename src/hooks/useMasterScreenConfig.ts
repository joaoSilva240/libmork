"use client";

import { useCallback, useState } from "react";

export type ShieldModuleId =
  | "worlds"
  | "assets"
  | "jukebox"
  | "charactersNpcs"
  | "players"
  | "sessionLog";

export const ALL_SHIELD_MODULES: readonly ShieldModuleId[] = [
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
  "sessionLog",
] as const;

export const DEFAULT_SHIELD_LEFT_ORDER: ShieldModuleId[] = [
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
];

export const DEFAULT_SHIELD_RIGHT_ORDER: ShieldModuleId[] = [
  "sessionLog",
];

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
  rightInput: unknown
): { left: ShieldModuleId[]; right: ShieldModuleId[] } {
  const isModuleId = (val: unknown): val is ShieldModuleId =>
    typeof val === "string" && ALL_SHIELD_MODULES.includes(val as ShieldModuleId);

  const rawLeft = Array.isArray(leftInput) ? leftInput.filter(isModuleId) : [];
  const rawRight = Array.isArray(rightInput) ? rightInput.filter(isModuleId) : [];

  const seen = new Set<ShieldModuleId>();
  const cleanLeft: ShieldModuleId[] = [];
  const cleanRight: ShieldModuleId[] = [];

  for (const m of rawLeft) {
    if (!seen.has(m)) {
      seen.add(m);
      cleanLeft.push(m);
    }
  }

  for (const m of rawRight) {
    if (!seen.has(m)) {
      seen.add(m);
      cleanRight.push(m);
    }
  }

  // Any missing modules are appended to their default column
  for (const defaultModule of DEFAULT_SHIELD_LEFT_ORDER) {
    if (!seen.has(defaultModule)) {
      seen.add(defaultModule);
      cleanLeft.push(defaultModule);
    }
  }
  for (const defaultModule of DEFAULT_SHIELD_RIGHT_ORDER) {
    if (!seen.has(defaultModule)) {
      seen.add(defaultModule);
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
    showCharactersNpcs: typeof input.showCharactersNpcs === "boolean" ? input.showCharactersNpcs : true,
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
      return stored ? sanitizeMasterScreenConfig(JSON.parse(stored)) : { ...DEFAULT_MASTER_SCREEN_CONFIG };
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
        JSON.stringify(DEFAULT_MASTER_SCREEN_CONFIG)
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
