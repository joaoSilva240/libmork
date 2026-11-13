import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDesktopClient } from "../useDesktopClient";
import type { DesktopClientApi } from "../../../electron/types";

describe("useDesktopClient Hook (Issue #80)", () => {
  beforeEach(() => {
    delete window.desktopClient;
  });

  afterEach(() => {
    delete window.desktopClient;
    vi.restoreAllMocks();
  });

  it("retorna isDesktop=false no navegador e usa window.open para links externos", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useDesktopClient());

    expect(result.current.isDesktop).toBe(false);
    expect(await result.current.getActiveServer()).toBeNull();

    await act(async () => {
      await result.current.openExternal("https://github.com/joaoSilva240/libmork");
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/joaoSilva240/libmork",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("delega notificações, servidores e desconexão para window.desktopClient no Electron", async () => {
    const mockClient: DesktopClientApi = {
      isElectron: true,
      platform: "win32",
      version: "0.1.0",
      sendNotification: vi.fn().mockResolvedValue(true),
      getServerList: vi
        .fn()
        .mockResolvedValue([
          { id: "preset-local", name: "Local", url: "http://localhost:3000", preset: true },
        ]),
      saveServer: vi.fn().mockResolvedValue(undefined),
      removeServer: vi.fn().mockResolvedValue(undefined),
      getActiveServer: vi.fn().mockResolvedValue("http://localhost:3000"),
      setActiveServer: vi.fn().mockResolvedValue(undefined),
      disconnectServer: vi.fn().mockResolvedValue(undefined),
      checkServerHealth: vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }),
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

    const { result } = renderHook(() => useDesktopClient());

    expect(result.current.isDesktop).toBe(true);
    expect(await result.current.getActiveServer()).toBe("http://localhost:3000");

    let sent = false;
    await act(async () => {
      sent = await result.current.notify({
        title: "Turno de Combate",
        body: "Sua vez de agir!",
      });
    });

    expect(sent).toBe(true);
    expect(mockClient.sendNotification).toHaveBeenCalledWith({
      title: "Turno de Combate",
      body: "Sua vez de agir!",
    });

    const servers = await result.current.getServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].url).toBe("http://localhost:3000");

    await act(async () => {
      await result.current.disconnectServer();
    });
    expect(mockClient.disconnectServer).toHaveBeenCalledTimes(1);
  });
});
