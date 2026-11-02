"use client";

// =============================================================================
// Libmork — Audio: JukeboxAudioBridge (Issue #60)
// =============================================================================
// Componente invisível que consome eventos de jukebox remota e renderiza
// players de áudio sincronizados. Usado por jogadores para receber áudio
// do mestre sem UI visível. Suporta execução simultânea.

import { useState } from "react";
import { useJukebox } from "@/hooks/useJukebox";
import { YouTubeAudioPlayer } from "./YouTubeAudioPlayer";

export interface JukeboxAudioBridgeProps {
  campaignId: string;
}

export function JukeboxAudioBridge({ campaignId }: JukeboxAudioBridgeProps) {
  const { tracks, playingTrackIds, playingTrackId, loopTrackIds } = useJukebox(campaignId, false);
  const [volumeLocal, setVolumeLocal] = useState<Record<string, number>>({});

  return (
    <div data-testid="jukebox-audio-bridge" className="hidden" aria-hidden>
      {tracks.map((track) => {
        const isPlaying = playingTrackIds
          ? playingTrackIds.has(track.id)
          : playingTrackId === track.id;

        return (
          <YouTubeAudioPlayer
            key={track.id}
            videoId={track.id}
            playing={isPlaying}
            volume={volumeLocal[track.id] ?? 50}
            loop={loopTrackIds.has(track.id)}
          />
        );
      })}
    </div>
  );
}
