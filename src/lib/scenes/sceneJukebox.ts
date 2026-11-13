import type { AudioTrack } from "@/lib/audio/jukebox-protocol";
import type { ActiveScene } from "./sceneConfig";

/**
 * Lista visível da jukebox para a cena ativa: faixas da cena + gerais (scene null/undefined).
 * Faixas em reprodução permanecem visíveis independentemente da cena (o áudio não para).
 */
export function filterTracksForScene(
  tracks: AudioTrack[],
  activeScene: ActiveScene,
  playingIds: Set<string>,
): AudioTrack[] {
  if (!activeScene) return tracks;
  return tracks.filter((t) => !t.scene || t.scene === activeScene || playingIds.has(t.id));
}
