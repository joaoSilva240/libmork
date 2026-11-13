// =============================================================================
// Libmork — Tipos e interfaces compartilhadas do Electron Desktop (Issue #80)
// =============================================================================

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  lastConnected?: string;
  preset?: boolean;
  isDefault?: boolean;
}

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  sound?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  status?: string;
  latencyMs?: number;
  error?: string;
  version?: string;
}

export interface DesktopClientApi {
  isElectron: true;
  platform: string;
  version: string;
  sendNotification: (options: DesktopNotificationOptions) => Promise<boolean>;
  getServerList: () => Promise<ServerConfig[]>;
  saveServer: (server: ServerConfig) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  getActiveServer: () => Promise<string | null>;
  setActiveServer: (url: string) => Promise<void>;
  disconnectServer: () => Promise<void>;
  checkServerHealth: (url: string) => Promise<HealthCheckResult>;
  openExternal: (url: string) => Promise<void>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onJukeboxTogglePlay: (callback: () => void) => () => void;
  onJukeboxMute: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
}
