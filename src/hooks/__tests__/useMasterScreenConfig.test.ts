import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useMasterScreenConfig,
  DEFAULT_MASTER_SCREEN_CONFIG,
  sanitizeMasterScreenConfig,
  DEFAULT_SHIELD_LEFT_ORDER,
  DEFAULT_SHIELD_RIGHT_ORDER,
  masterScreenConfigKey,
} from "../useMasterScreenConfig";

describe("useMasterScreenConfig hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return default config when no stored data exists", () => {
    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
    expect(result.current.isLoaded).toBe(true);
  });

  it("should load config from localStorage", () => {
    const stored = {
      showRoster: false,
      showSessionLog: true,
      showCanvas: false,
      showMap: true,
      showJukebox: false,
      showDiceRolls: true,
      showCharactersNpcs: false,
      showPlayers: true,
      showAssets: true,
      leftColumnOrder: DEFAULT_SHIELD_LEFT_ORDER,
      rightColumnOrder: DEFAULT_SHIELD_RIGHT_ORDER,
      aiApiKey: "sk-test",
      aiApiEndpoint: "https://api.openai.com/v1",
      aiModel: "gpt-4o-mini",
    };
    localStorage.setItem(masterScreenConfigKey, JSON.stringify(stored));

    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config).toEqual(stored);
  });

  it("should update config and persist to localStorage globally", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({ showRoster: false, showJukebox: false });
    });

    expect(result.current.config.showRoster).toBe(false);
    expect(result.current.config.showJukebox).toBe(false);
    expect(result.current.config.showSessionLog).toBe(true);

    const stored = JSON.parse(localStorage.getItem(masterScreenConfigKey)!);
    expect(stored.showRoster).toBe(false);
    expect(stored.showJukebox).toBe(false);
  });

  it("should reset config to defaults", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({ showRoster: false, showMap: false, showPlayers: false });
    });
    expect(result.current.config.showRoster).toBe(false);
    expect(result.current.config.showPlayers).toBe(false);

    act(() => {
      result.current.resetConfig();
    });

    expect(result.current.config).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
  });

  it("should sanitize invalid JSON and return defaults", () => {
    localStorage.setItem(masterScreenConfigKey, "invalid-json");

    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
  });

  it("should sanitize missing fields with defaults", () => {
    const partial = { showRoster: false };
    localStorage.setItem(masterScreenConfigKey, JSON.stringify(partial));

    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config.showRoster).toBe(false);
    expect(result.current.config.showSessionLog).toBe(true);
    expect(result.current.config.showCanvas).toBe(true);
    expect(result.current.config.showMap).toBe(true);
    expect(result.current.config.showJukebox).toBe(true);
    expect(result.current.config.showDiceRolls).toBe(true);
    expect(result.current.config.showCharactersNpcs).toBe(true);
    expect(result.current.config.showPlayers).toBe(true);
    expect(result.current.config.showAssets).toBe(true);
    expect(result.current.config.leftColumnOrder).toEqual(DEFAULT_SHIELD_LEFT_ORDER);
    expect(result.current.config.rightColumnOrder).toEqual(DEFAULT_SHIELD_RIGHT_ORDER);
    expect(result.current.config.aiApiKey).toBe("");
    expect(result.current.config.aiApiEndpoint).toBe("");
    expect(result.current.config.aiModel).toBe("");
  });

  it("should sanitize non-boolean fields with defaults", () => {
    const invalid = { showRoster: "yes", showSessionLog: 1, showCanvas: null, showMap: undefined };
    localStorage.setItem(masterScreenConfigKey, JSON.stringify(invalid));

    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
  });

  it("should handle localStorage unavailable without crash", () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("Quota exceeded");
    });

    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({ showRoster: false });
    });

    expect(result.current.config.showRoster).toBe(false);
    Storage.prototype.setItem = originalSetItem;
  });
});

describe("sanitizeMasterScreenConfig", () => {
  it("should return defaults for null", () => {
    expect(sanitizeMasterScreenConfig(null)).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
  });

  it("should return defaults for non-object", () => {
    expect(sanitizeMasterScreenConfig("string")).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
    expect(sanitizeMasterScreenConfig(123)).toEqual(DEFAULT_MASTER_SCREEN_CONFIG);
  });

  it("should fill missing boolean fields with true", () => {
    const result = sanitizeMasterScreenConfig({ showRoster: false });
    expect(result).toEqual({
      showRoster: false,
      showSessionLog: true,
      showCanvas: true,
      showMap: true,
      showJukebox: true,
      showDiceRolls: true,
      showCharactersNpcs: true,
      showPlayers: true,
      showAssets: true,
      leftColumnOrder: DEFAULT_SHIELD_LEFT_ORDER,
      rightColumnOrder: DEFAULT_SHIELD_RIGHT_ORDER,
      aiApiKey: "",
      aiApiEndpoint: "",
      aiModel: "",
    });
  });

  it("should replace non-boolean fields with true", () => {
    const result = sanitizeMasterScreenConfig({ showRoster: "false", showSessionLog: 0 });
    expect(result.showRoster).toBe(true);
    expect(result.showSessionLog).toBe(true);
  });
});

describe("useMasterScreenConfig - Module Ordering & Assets Visibility (Issue #75)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default configuration with showAssets=true and default column orders", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    expect(result.current.config.showAssets).toBe(true);
    expect(result.current.config.leftColumnOrder).toEqual(DEFAULT_SHIELD_LEFT_ORDER);
    expect(result.current.config.rightColumnOrder).toEqual(DEFAULT_SHIELD_RIGHT_ORDER);
  });

  it("sanitizes legacy localStorage data missing order and showAssets", () => {
    const legacyConfig = {
      showRoster: true,
      showSessionLog: true,
      showCanvas: true,
      showMap: true,
      showJukebox: false,
    };

    const sanitized = sanitizeMasterScreenConfig(legacyConfig);
    expect(sanitized.showAssets).toBe(true);
    expect(sanitized.leftColumnOrder).toEqual(DEFAULT_SHIELD_LEFT_ORDER);
    expect(sanitized.rightColumnOrder).toEqual(DEFAULT_SHIELD_RIGHT_ORDER);
  });

  it("recovers missing modules and removes duplicate modules during sanitization", () => {
    const corruptedConfig = {
      leftColumnOrder: ["jukebox", "jukebox"],
      rightColumnOrder: ["sessionLog"],
    };

    const sanitized = sanitizeMasterScreenConfig(corruptedConfig);
    const allModules = [...sanitized.leftColumnOrder, ...sanitized.rightColumnOrder];

    // Blocos consolidados da issue #89: módulos legados migram para mediaPanel.
    expect(new Set(allModules).size).toBe(3);
    expect(allModules).toContain("mediaPanel");
    expect(allModules).toContain("actorsPanel");
    expect(allModules).toContain("sessionLog");
  });

  it("migrates legacy module ids into consolidated blocks preserving order (issue #89)", () => {
    const legacyConfig = {
      leftColumnOrder: ["assets", "worlds", "jukebox", "charactersNpcs", "players"],
      rightColumnOrder: ["sessionLog"],
    };

    const sanitized = sanitizeMasterScreenConfig(legacyConfig);
    expect(sanitized.leftColumnOrder).toEqual(["mediaPanel", "actorsPanel"]);
    expect(sanitized.rightColumnOrder).toEqual(["sessionLog"]);
  });

  it("migrates blocks placed in different columns keeping the first column occurrence", () => {
    const legacyConfig = {
      leftColumnOrder: ["worlds"],
      rightColumnOrder: ["jukebox", "assets", "charactersNpcs", "players", "sessionLog"],
    };

    const sanitized = sanitizeMasterScreenConfig(legacyConfig);
    // Mundos migram para mediaPanel na esquerda; o jukebox/assets da direita
    // colapsa no bloco já existente — actorsPanel permanece na coluna direita
    // onde seus módulos estavam.
    expect(sanitized.leftColumnOrder).toEqual(["mediaPanel"]);
    expect(sanitized.rightColumnOrder).toEqual(["actorsPanel", "sessionLog"]);
  });

  it("persists column order and showAssets updates to localStorage", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({
        showAssets: false,
        leftColumnOrder: ["actorsPanel"],
        rightColumnOrder: ["mediaPanel", "sessionLog"],
      });
    });

    expect(result.current.config.showAssets).toBe(false);
    expect(result.current.config.leftColumnOrder).toEqual(["actorsPanel"]);

    const stored = JSON.parse(localStorage.getItem(masterScreenConfigKey) || "{}");
    expect(stored.showAssets).toBe(false);
    expect(stored.leftColumnOrder).toEqual(["actorsPanel"]);
  });
});

