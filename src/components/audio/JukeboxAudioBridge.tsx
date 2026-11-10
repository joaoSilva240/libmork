"use client";

// =============================================================================
// Libmork — Audio: JukeboxAudioBridge (Issue #60)
// =============================================================================
// Componente invisível que consome eventos de jukebox remota e renderiza
// players de áudio sincronizados. Usado por jogadores para receber áudio
// do mestre sem UI visível. Suporta execução simultânea.

import { useState, useEffect } from "react";
import { useJukebox } from "@/hooks/useJukebox";
import { YouTubeAudioPlayer } from "./YouTubeAudioPlayer";

export interface JukeboxAudioBridgeProps {
  campaignId: string;
}

export function JukeboxAudioBridge({ campaignId }: JukeboxAudioBridgeProps) {
  const { tracks, playingTrackIds, playingTrackId, loopTrackIds } = useJukebox(campaignId, false);
  const [volumeLocal] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const handleMute = () => setMuted((prev) => !prev);
    window.addEventListener("libmork:jukebox-mute", handleMute);
    return () => window.removeEventListener("libmork:jukebox-mute", handleMute);
  }, []);

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
            volume={muted ? 0 : (volumeLocal[track.id] ?? 50)}
            loop={loopTrackIds.has(track.id)}
          />
        );
      })}
    </div>
  );
}
