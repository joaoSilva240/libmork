import Dexie, { type Table } from "dexie";

export interface CharacterDraft {
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface OfflineMutation {
  id?: number;
  characterId: string;
  type: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: unknown;
  timestamp: number;
  status: "PENDING" | "SYNCING" | "FAILED";
}

export class LibmorkOfflineDB extends Dexie {
  characterDrafts!: Table<CharacterDraft, string>;
  mutationQueue!: Table<OfflineMutation, number>;

  constructor() {
    super("libmork_offline_db");
    this.version(1).stores({
      characterDrafts: "id, updatedAt",
      mutationQueue: "++id, characterId, timestamp, status",
    });
  }
}

export const offlineDb = typeof window !== "undefined" ? new LibmorkOfflineDB() : null;
