// =============================================================================
// Libmork — Gerenciador do System Tray do Electron Desktop (Issue #80)
// =============================================================================

import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import path from "path";

let tray: Electron.Tray | null = null;

export interface TrayState {
  online: boolean;
  serverName?: string;
  audioPlaying?: boolean;
  muted?: boolean;
}

export function createTray(
  mainWindow: BrowserWindow | null,
  getState: () => TrayState,
  callbacks: {
    onToggleAudio?: () => void;
    onQuit?: () => void;
  },
): Electron.Tray | null {
  if (process.platform === "darwin") {
    return null; // macOS não usa system tray no modo padrão
  }

  const iconPath = path.join(__dirname, "..", "electron", "assets", "icon.png");
  let trayIcon: Electron.NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Fallback para o ícone padrão do Windows se não conseguir carregar
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const updateContextMenu = () => {
    const state = getState();
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: `Libmork — ${state.online ? "Online" : "Offline"}`,
        enabled: false,
      },
      {
        label: state.serverName ? `Servidor: ${state.serverName}` : "Nenhum servidor",
        enabled: false,
      },
      { type: "separator" },
      {
        label: state.audioPlaying ? "Pausar Jukebox" : "Tocar Jukebox",
        click: () => callbacks.onToggleAudio?.(),
      },
      {
        label: state.muted ? "Desmutar" : "Mutar",
        click: () => callbacks.onToggleAudio?.(),
      },
      { type: "separator" },
      {
        label: "Restaurar Janela",
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "Sair",
        click: () => callbacks.onQuit?.() || app.quit(),
      },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    tray?.setContextMenu(contextMenu);
  };

  tray.setToolTip("Libmork — Sistema de RPG de Mesa");
  updateContextMenu();

  // Atualiza o menu periodicamente ou em caso de mudança de estado (chamado externamente)
  setInterval(updateContextMenu, 5000);

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
