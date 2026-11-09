// =============================================================================
// Libmork — Persistência Local do Electron Desktop (Issue #80)
// =============================================================================
// Armazenamento de servidores favoritos e preferências via electron-store
// e criptografia de segredos locais via safeStorage do Electron.

import { safeStorage } from "electron";
import Store from "electron-store";
import type { ServerConfig } from "./types";

export interface DesktopStoreSchema {
  servers: ServerConfig[];
  activeServer: string | null;
  volumeMuted: boolean;
  rememberLastServer: boolean;
  encryptedCredentials?: Record<string, string>;
}

export const DEFAULT_SERVERS: ServerConfig[] = [
  {
    id: "preset-cloud",
    name: "Servidor na Nuvem (Railway)",
    url: "https://libmork.up.railway.app",
    preset: true,
  },
  {
    id: "preset-local",
    name: "Desenvolvimento Local",
    url: "http://localhost:3000",
    preset: true,
    isDefault: true,
  },
  {
    id: "preset-zimaos",
    name: "Self-Hosted (ZimaOS / Tailscale)",
    url: "http://100.83.170.1:3000",
    preset: true,
  },
];

export function createDesktopStore(): Store<DesktopStoreSchema> {
  return new Store<DesktopStoreSchema>({
    name: "libmork-desktop-config",
    defaults: {
      servers: DEFAULT_SERVERS,
      activeServer: null,
      volumeMuted: false,
      rememberLastServer: true,
      encryptedCredentials: {},
    },
  });
}

export function encryptCredential(plainText: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plainText).toString("base64");
  }
  return Buffer.from(plainText, "utf-8").toString("base64");
}

export function decryptCredential(encoded: string): string {
  const buffer = Buffer.from(encoded, "base64");
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buffer);
  }
  return buffer.toString("utf-8");
}
