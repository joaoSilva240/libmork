// =============================================================================
// Libmork — Atalhos Globais do Electron Desktop (Issue #80)
// =============================================================================

import { globalShortcut, BrowserWindow } from "electron";

export function registerGlobalShortcuts(
  getWindow: () => BrowserWindow | null,
  callbacks: {
    onToggleMute?: () => void;
    onTogglePlay?: () => void;
    onSwitchServer?: () => void;
  },
): void {
  try {
    // Controle da Jukebox: Alternar Play/Pause
    globalShortcut.register("CommandOrControl+Shift+P", () => {
      callbacks.onTogglePlay?.();
      const win = getWindow();
      win?.webContents.send("jukebox:toggle-play");
    });

    // Controle da Jukebox: Mutar/Desmutar áudio
    globalShortcut.register("CommandOrControl+Shift+M", () => {
      callbacks.onToggleMute?.();
      const win = getWindow();
      win?.webContents.send("jukebox:mute");
    });

    // Alternar Tela Cheia (mesmo fora de foco ou em foco)
    globalShortcut.register("CommandOrControl+Shift+F", () => {
      const win = getWindow();
      if (win) {
        win.setFullScreen(!win.isFullScreen());
      }
    });

    // Trocar de Servidor / Voltar ao Gateway de Instância
    globalShortcut.register("CommandOrControl+Shift+G", () => {
      callbacks.onSwitchServer?.();
    });
  } catch (err) {
    console.error("[Electron Shortcuts] Erro ao registrar atalhos globais:", err);
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
