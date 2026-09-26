import { offlineDb, CharacterDraft, OfflineMutation } from "./db";

export async function saveCharacterDraft(characterId: string, data: Record<string, unknown>): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.characterDrafts.put({
    id: characterId,
    data,
    updatedAt: Date.now(),
  });
}

export async function getCharacterDraft(characterId: string): Promise<CharacterDraft | undefined> {
  if (!offlineDb) return undefined;
  return await offlineDb.characterDrafts.get(characterId);
}

export async function enqueueOfflineMutation(mutation: Omit<OfflineMutation, "id" | "timestamp" | "status">): Promise<number | undefined> {
  if (!offlineDb) return undefined;
  return await offlineDb.mutationQueue.add({
    ...mutation,
    timestamp: Date.now(),
    status: "PENDING",
  });
}

export async function getPendingMutations(characterId?: string): Promise<OfflineMutation[]> {
  if (!offlineDb) return [];
  if (characterId) {
    return await offlineDb.mutationQueue.where("characterId").equals(characterId).toArray();
  }
  return await offlineDb.mutationQueue.where("status").equals("PENDING").toArray();
}

export async function removeMutation(id: number): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.mutationQueue.delete(id);
}

export async function clearMutationQueue(): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.mutationQueue.clear();
}
