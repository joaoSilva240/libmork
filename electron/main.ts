// =============================================================================
// Libmork — Processo Principal do Electron Desktop (Issue #80)
// =============================================================================
// Empacotamento Desktop (Windows/macOS/Linux) com gateway de instâncias,
// segurança (contextIsolation, sandbox), notificações nativas e bandeja.

import { app, BrowserWindow, ipcMain, Notification, shell, session } from "electron";
import path from "path";
import url from "url";
import { createDesktopStore, DEFAULT_SERVERS } from "./store";
import type { ServerConfig, DesktopNotificationOptions, HealthCheckResult } from "./types";
import { createTray, destroyTray, TrayState } from "./tray";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./shortcuts";
import { setupApplicationMenu } from "./menu";

// =============================================================================
// Variáveis Globais de Estado
// =============================================================================
let mainWindow: BrowserWindow | null = null;
let currentServerUrl: string | null = null;
let isQuitting = false;
const store = createDesktopStore();

// =============================================================================
// Inicialização e Ciclo de Vida
// =============================================================================
app.whenReady().then(() => {
  setupIpcHandlers();
  setupSecurity();
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  unregisterGlobalShortcuts();
  destroyTray();
});

// =============================================================================
// Janela Principal e Carregamento
// =============================================================================
function createWindow(): void {
  // Recupera servidor ativo salvo
  const activeServer = store.get("activeServer") as string | null;
  const servers = (store.get("servers") as ServerConfig[]) || DEFAULT_SERVERS;
  const activeConfig = servers.find((s) => s.url === activeServer);
  const rememberLastServer = store.get("rememberLastServer") as boolean;

  const loadGateway = () => {
    const gatewayUrl = url.format({
      pathname: path.join(__dirname, "..", "electron", "gateway", "index.html"),
      protocol: "file:",
      slashes: true,
    });
    mainWindow?.loadURL(gatewayUrl);
  };

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: "#09090b", // Fallback dark do tema
    title: "Libmork Desktop",
    icon: path.join(__dirname, "..", "electron", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Configura menu nativo
  setupApplicationMenu(() => mainWindow, {
    onSwitchServer: () => {
      store.set("activeServer", null);
      currentServerUrl = null;
      loadGateway();
    },
    onToggleMute: () => {
      if (mainWindow) {
        const nextMuted = !mainWindow.webContents.isAudioMuted();
        mainWindow.webContents.setAudioMuted(nextMuted);
        store.set("volumeMuted", nextMuted);
        mainWindow.webContents.send("jukebox:mute");
      }
    },
  });

  // Configura tray
  createTray(
    mainWindow,
    (): TrayState => ({
      online: !!currentServerUrl,
      serverName: activeConfig?.name || currentServerUrl || "Desconectado",
      muted: mainWindow ? mainWindow.webContents.isAudioMuted() : false,
    }),
    {
      onToggleAudio: () => {
        if (mainWindow) {
          const nextMuted = !mainWindow.webContents.isAudioMuted();
          mainWindow.webContents.setAudioMuted(nextMuted);
          store.set("volumeMuted", nextMuted);
          mainWindow.webContents.send("jukebox:mute");
        }
      },
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    },
  );

  // Atalhos globais (controle de áudio, fullscreen, gateway)
  registerGlobalShortcuts(() => mainWindow, {
    onTogglePlay: () => mainWindow?.webContents.send("jukebox:toggle-play"),
    onToggleMute: () => {
      if (mainWindow) {
        const nextMuted = !mainWindow.webContents.isAudioMuted();
        mainWindow.webContents.setAudioMuted(nextMuted);
        store.set("volumeMuted", nextMuted);
      }
    },
    onSwitchServer: () => {
      store.set("activeServer", null);
      currentServerUrl = null;
      loadGateway();
    },
  });

  // Renderização suave
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Minimizar para tray ao fechar (Windows/Linux)
  mainWindow.on("close", (event) => {
    if (!isQuitting && process.platform !== "darwin") {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Segurança: Navegação externa deve abrir no navegador padrão do OS
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    // Permite navegação apenas dentro do servidor conectado ou gateway local
    const isGateway = targetUrl.startsWith("file://");
    const isActiveServer = currentServerUrl && targetUrl.startsWith(currentServerUrl);
    if (!isGateway && !isActiveServer && !isGateway) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  // Carrega tela inicial
  if (rememberLastServer && activeServer) {
    connectToServer(activeServer);
  } else {
    loadGateway();
  }
}

function connectToServer(serverUrl: string): void {
  if (!mainWindow) return;
  try {
    const parsed = new URL(serverUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Protocolo inválido");
    }

    // Remove barra final para padronizar
    const cleanUrl = parsed.toString().replace(/\/$/, "");
    currentServerUrl = cleanUrl;
    store.set("activeServer", cleanUrl);

    mainWindow.loadURL(cleanUrl);
    mainWindow.setTitle(`Libmork — ${cleanUrl}`);
  } catch {
    // Se URL inválida, volta pro gateway
    currentServerUrl = null;
    store.set("activeServer", null);
    const gatewayUrl = url.format({
      pathname: path.join(__dirname, "..", "electron", "gateway", "index.html"),
      protocol: "file:",
      slashes: true,
    });
    mainWindow.loadURL(gatewayUrl);
  }
}

// =============================================================================
// Segurança Adicional (Headers CSP para o Gateway Local)
// =============================================================================
function setupSecurity(): void {
  const ses = session.defaultSession;
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith("file://")) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';",
          ],
        },
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
}

// =============================================================================
// Auto-Updater (GitHub Releases)
// =============================================================================
async function setupAutoUpdater(): Promise<void> {
  if (process.env.NODE_ENV === "development") return;

  try {
    const { autoUpdater } = await import("electron-updater");

    autoUpdater.on("update-available", (info: { version: string }) => {
      mainWindow?.webContents.send("updater:available", { version: info.version });
    });

    autoUpdater.on("update-downloaded", (info: { version: string }) => {
      mainWindow?.webContents.send("updater:downloaded", { version: info.version });
      autoUpdater.quitAndInstall();
    });

    autoUpdater.checkForUpdatesAndNotify();
  } catch {
    // Ignora silenciosamente em dev ou se falhar
  }
}

// =============================================================================
// IPC Handlers (Comunicação Renderer <-> Main)
// =============================================================================
function setupIpcHandlers(): void {
  // Gerenciamento de Servidores
  ipcMain.handle("servers:list", () => {
    return (store.get("servers") as ServerConfig[]) || DEFAULT_SERVERS;
  });

  ipcMain.handle("servers:save", (_event, server: ServerConfig) => {
    const servers = (store.get("servers") as ServerConfig[]) || [];
    const existingIndex = servers.findIndex((s) => s.url === server.url);
    if (existingIndex >= 0) {
      servers[existingIndex] = {
        ...servers[existingIndex],
        ...server,
        id: servers[existingIndex].id,
      };
    } else {
      servers.push({
        ...server,
        id: server.id || `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      });
    }
    store.set("servers", servers);
  });

  ipcMain.handle("servers:remove", (_event, id: string) => {
    const servers = (store.get("servers") as ServerConfig[]) || [];
    const filtered = servers.filter((s) => s.id !== id && !s.preset);
    store.set("servers", filtered);
  });

  ipcMain.handle("servers:get-active", () => {
    return store.get("activeServer") as string | null;
  });

  ipcMain.handle("servers:set-active", (_event, serverUrl: string) => {
    connectToServer(serverUrl);
  });

  ipcMain.handle("servers:disconnect", () => {
    currentServerUrl = null;
    store.set("activeServer", null);
    if (mainWindow) {
      const gatewayUrl = url.format({
        pathname: path.join(__dirname, "..", "electron", "gateway", "index.html"),
        protocol: "file:",
        slashes: true,
      });
      mainWindow.loadURL(gatewayUrl);
      mainWindow.setTitle("Libmork Desktop — Gateway de Instâncias");
    }
  });

  ipcMain.handle(
    "servers:check-health",
    async (_event, serverUrl: string): Promise<HealthCheckResult> => {
      try {
        const parsed = new URL(serverUrl);
        const healthUrl = new URL("/api/health", parsed).toString();
        const start = Date.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(healthUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;

        if (!response.ok) {
          return { ok: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
          ok: data.status === "ok" || data.status === "degraded",
          status: data.status,
          latencyMs,
          version: data.version,
        };
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        return {
          ok: false,
          error: err.name === "AbortError" ? "Timeout (5s)" : err.message || "Falha de rede",
        };
      }
    },
  );

  // Notificações do Sistema
  ipcMain.handle("notification:send", async (_event, options: DesktopNotificationOptions) => {
    if (!Notification.isSupported()) return false;

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon ? path.join(__dirname, "..", options.icon) : undefined,
        silent: options.sound === false,
      });

      notification.on("click", () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.show();
      return true;
    } catch {
      return false;
    }
  });

  // Shell Externo
  ipcMain.handle("shell:open-external", (_event, targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return shell.openExternal(targetUrl);
      }
    } catch {
      // Ignora URLs inválidas
    }
    return Promise.resolve();
  });

  // Janela
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow?.close());
  ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);
}
