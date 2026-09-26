import { getPendingMutations, removeMutation } from "./storage";
import { apiFetch } from "@/lib/client/apiClient";
import { offlineDb } from "./db";

export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined" || !offlineDb) return { synced: 0, failed: 0 };

  const pending = await getPendingMutations();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    if (!item.id) continue;
    try {
      await apiFetch(item.endpoint, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.payload ? JSON.stringify(item.payload) : undefined,
      });
      await removeMutation(item.id);
      synced++;
    } catch (err) {
      console.error(`[Offline Sync Failed for ${item.endpoint}]:`, err);
      failed++;
    }
  }

  return { synced, failed };
}
