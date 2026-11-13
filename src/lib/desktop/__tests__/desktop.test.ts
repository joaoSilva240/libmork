import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDesktopEnvironment, getDesktopClient } from "../index";
import type { DesktopClientApi } from "../../../../electron/types";

describe("Desktop Environment Utilities (Issue #80)", () => {
  const originalDesktopClient = window.desktopClient;

  beforeEach(() => {
    delete window.desktopClient;
  });

  afterEach(() => {
    if (originalDesktopClient) {
      window.desktopClient = originalDesktopClient;
    } else {
      delete window.desktopClient;
    }
  });

  it("retorna isDesktop=false e client=null quando executado no navegador comum", () => {
    expect(getDesktopEnvironment()).toEqual({ isDesktop: false });
    expect(getDesktopClient()).toBeNull();
  });

  it("retorna isDesktop=true, platform e version quando window.desktopClient está exposto pelo Electron preload", () => {
    const mockClient: DesktopClientApi = {
      isElectron: true,
      platform: "win32",
      version: "0.1.0",
      sendNotification: vi.fn().mockResolvedValue(true),
      getServerList: vi.fn().mockResolvedValue([]),
      saveServer: vi.fn().mockResolvedValue(undefined),
      removeServer: vi.fn().mockResolvedValue(undefined),
      getActiveServer: vi.fn().mockResolvedValue("http://localhost:3000"),
      setActiveServer: vi.fn().mockResolvedValue(undefined),
      disconnectServer: vi.fn().mockResolvedValue(undefined),
      checkServerHealth: vi.fn().mockResolvedValue({ ok: true, latencyMs: 12 }),
      openExternal: vi.fn().mockResolvedValue(undefined),
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onJukeboxTogglePlay: vi.fn(() => () => {}),
      onJukeboxMute: vi.fn(() => () => {}),
      onUpdateAvailable: vi.fn(() => () => {}),
      onUpdateDownloaded: vi.fn(() => () => {}),
    };

    window.desktopClient = mockClient;

    expect(getDesktopEnvironment()).toEqual({
      isDesktop: true,
      platform: "win32",
      version: "0.1.0",
    });
    expect(getDesktopClient()).toBe(mockClient);
  });
});
