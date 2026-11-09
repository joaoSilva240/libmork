// =============================================================================
// Libmork — Menu Nativo da Aplicação Desktop (Issue #80)
// =============================================================================

import { Menu, BrowserWindow, app } from "electron";

export function setupApplicationMenu(
  getWindow: () => BrowserWindow | null,
  callbacks: {
    onSwitchServer: () => void;
    onToggleMute: () => void;
  },
): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Servidor",
      submenu: [
        {
          label: "Trocar Servidor (Gateway)",
          accelerator: "CommandOrControl+Shift+G",
          click: () => callbacks.onSwitchServer(),
        },
        {
          label: "Recarregar Página",
          accelerator: "CommandOrControl+R",
          click: () => getWindow()?.webContents.reload(),
        },
        { type: "separator" },
        {
          label: "Mutar/Desmutar Jukebox",
          accelerator: "CommandOrControl+Shift+M",
          click: () => callbacks.onToggleMute(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Exibir",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { role: "forceReload", label: "Forçar Recarregamento" },
        { role: "toggleDevTools", label: "Ferramentas do Desenvolvedor" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom Padrão" },
        { role: "zoomIn", label: "Aumentar Zoom" },
        { role: "zoomOut", label: "Diminuir Zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela Cheia" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
