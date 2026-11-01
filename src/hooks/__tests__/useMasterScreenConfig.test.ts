import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useMasterScreenConfig,
  DEFAULT_MASTER_SCREEN_CONFIG,
  sanitizeMasterScreenConfig,
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
    const stored = { showRoster: false, showSessionLog: true, showCanvas: false, showMap: true };
    localStorage.setItem(masterScreenConfigKey, JSON.stringify(stored));

    const { result } = renderHook(() => useMasterScreenConfig());
    expect(result.current.config).toEqual(stored);
  });

  it("should update config and persist to localStorage globally", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({ showRoster: false });
    });

    expect(result.current.config.showRoster).toBe(false);
    expect(result.current.config.showSessionLog).toBe(true);

    const stored = JSON.parse(localStorage.getItem(masterScreenConfigKey)!);
    expect(stored.showRoster).toBe(false);
  });

  it("should reset config to defaults", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({ showRoster: false, showMap: false });
    });
    expect(result.current.config.showRoster).toBe(false);

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
    });
  });

  it("should replace non-boolean fields with true", () => {
    const result = sanitizeMasterScreenConfig({ showRoster: "false", showSessionLog: 0 });
    expect(result.showRoster).toBe(true);
    expect(result.showSessionLog).toBe(true);
  });
});
