// =============================================================================
// Libmork — Preload Seguro com contextBridge (Issue #80)
// =============================================================================
// Hardening & Segurança:
// - contextIsolation: true
// - nodeIntegration: false
// - sandbox: true
// Expõe estritamente a API tipada em window.desktopClient.

import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopClientApi,
  DesktopNotificationOptions,
  ServerConfig,
  HealthCheckResult,
} from "./types";

const desktopClient: DesktopClientApi = {
  isElectron: true,
  platform: process.platform,
  version: "0.1.0",

  sendNotification: (options: DesktopNotificationOptions): Promise<boolean> =>
    ipcRenderer.invoke("notification:send", options),

  getServerList: (): Promise<ServerConfig[]> => ipcRenderer.invoke("servers:list"),

  saveServer: (server: ServerConfig): Promise<void> => ipcRenderer.invoke("servers:save", server),

  removeServer: (id: string): Promise<void> => ipcRenderer.invoke("servers:remove", id),

  getActiveServer: (): Promise<string | null> => ipcRenderer.invoke("servers:get-active"),

  setActiveServer: (url: string): Promise<void> => ipcRenderer.invoke("servers:set-active", url),

  disconnectServer: (): Promise<void> => ipcRenderer.invoke("servers:disconnect"),

  checkServerHealth: (url: string): Promise<HealthCheckResult> =>
    ipcRenderer.invoke("servers:check-health", url),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:open-external", url),

  minimize: (): void => {
    ipcRenderer.send("window:minimize");
  },

  maximize: (): void => {
    ipcRenderer.send("window:maximize");
  },

  close: (): void => {
    ipcRenderer.send("window:close");
  },

  isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),

  onJukeboxTogglePlay: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("jukebox:toggle-play", listener);
    return () => {
      ipcRenderer.removeListener("jukebox:toggle-play", listener);
    };
  },

  onJukeboxMute: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("jukebox:mute", listener);
    return () => {
      ipcRenderer.removeListener("jukebox:mute", listener);
    };
  },

  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { version: string }) =>
      callback(info);
    ipcRenderer.on("updater:available", listener);
    return () => {
      ipcRenderer.removeListener("updater:available", listener);
    };
  },

  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { version: string }) =>
      callback(info);
    ipcRenderer.on("updater:downloaded", listener);
    return () => {
      ipcRenderer.removeListener("updater:downloaded", listener);
    };
  },
};

contextBridge.exposeInMainWorld("desktopClient", desktopClient);
