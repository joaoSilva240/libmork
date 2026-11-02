"use client";

import { useCallback, useState } from "react";

export type MasterScreenConfig = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox: boolean;
  showDiceRolls: boolean;
  showCharactersNpcs: boolean;
  showPlayers: boolean;
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
  aiApiKey: "",
  aiApiEndpoint: "",
  aiModel: "",
};

export const masterScreenConfigKey = "libmork:master-screen-config";

export function sanitizeMasterScreenConfig(value: unknown): MasterScreenConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_MASTER_SCREEN_CONFIG };
  }
  const input = value as Record<string, unknown>;
  return {
    showRoster: typeof input.showRoster === "boolean" ? input.showRoster : true,
    showSessionLog: typeof input.showSessionLog === "boolean" ? input.showSessionLog : true,
    showCanvas: typeof input.showCanvas === "boolean" ? input.showCanvas : true,
    showMap: typeof input.showMap === "boolean" ? input.showMap : true,
    showJukebox: typeof input.showJukebox === "boolean" ? input.showJukebox : true,
    showDiceRolls: typeof input.showDiceRolls === "boolean" ? input.showDiceRolls : true,
    showCharactersNpcs: typeof input.showCharactersNpcs === "boolean" ? input.showCharactersNpcs : true,
    showPlayers: typeof input.showPlayers === "boolean" ? input.showPlayers : true,
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

  const updateConfig = useCallback(
    (patch: Partial<MasterScreenConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(masterScreenConfigKey, JSON.stringify(next));
        } catch {
          // ignore localStorage errors (e.g. quota exceeded)
        }
        return next;
      });
    },
    []
  );

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_MASTER_SCREEN_CONFIG });
    try {
      window.localStorage.setItem(masterScreenConfigKey, JSON.stringify(DEFAULT_MASTER_SCREEN_CONFIG));
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
