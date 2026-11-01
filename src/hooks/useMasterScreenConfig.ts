"use client";

import { useCallback, useState } from "react";

export type MasterScreenConfig = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
};

export type MasterScreenConfigPayload = MasterScreenConfig & {
  version?: number;
};

export const DEFAULT_MASTER_SCREEN_CONFIG: MasterScreenConfig = {
  showRoster: true,
  showSessionLog: true,
  showCanvas: true,
  showMap: true,
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
      setConfig((current) => {
        const next: MasterScreenConfig = {
          ...current,
          ...patch,
        };
        const sanitized = sanitizeMasterScreenConfig(next);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              masterScreenConfigKey,
              JSON.stringify({ version: 1, ...sanitized })
            );
          } catch {
            // Storage quota exceeded or disabled; ignore error without crash
          }
        }
        return sanitized;
      });
    },
    []
  );

  const resetConfig = useCallback(() => {
    updateConfig(DEFAULT_MASTER_SCREEN_CONFIG);
  }, [updateConfig]);

  return {
    config,
    updateConfig,
    resetConfig,
    isLoaded,
  };
}
