"use client";

// =============================================================================
// Libmork â€” Audio: Componente YouTubeAudioPlayer (Issue #60)
// =============================================================================
// Player de Ã¡udio invisÃ­vel via YouTube IFrame API. Controle declarativo
// via props (playing, volume, loop). O iframe nÃ£o deve ser visÃ­vel â€” a jukebox
// Ã© audio-only.

import { useEffect, useRef, useState } from "react";
import { loadYouTubeIframeApi } from "@/lib/audio/youTubeApi";

interface YouTubeAudioPlayerProps {
  videoId: string;
  volume?: number;
  loop?: boolean;
  playing?: boolean;
  onStateChange?: (
    state: "playing" | "paused" | "ended" | "unstarted" | "error",
  ) => void;
}

export function YouTubeAudioPlayer({
  videoId,
  volume = 50,
  loop = false,
  playing = false,
  onStateChange,
}: YouTubeAudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loopRef = useRef(loop);
  const [playerReady, setPlayerReady] = useState(false);

  // Atualiza ref de loop (para uso no callback onStateChange)
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // Mount: carrega API + cria player
  useEffect(() => {
    let mounted = true;

    loadYouTubeIframeApi().then((YT) => {
      if (!mounted || !containerRef.current) return;

      playerRef.current = new YT.Player(containerRef.current, {
        height: "0",
        width: "0",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (mounted) {
              setPlayerReady(true);
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            
            // Notifica callback se presente
            if (onStateChange) {
              if (state === YT.PlayerState.UNSTARTED) {
                onStateChange("unstarted");
              } else if (state === YT.PlayerState.ENDED) {
                onStateChange("ended");
              } else if (state === YT.PlayerState.PLAYING) {
                onStateChange("playing");
              } else if (state === YT.PlayerState.PAUSED) {
                onStateChange("paused");
              }
            }
            
            // Loop: se ativado e chegou ao fim, reinicia
            if (state === YT.PlayerState.ENDED && loopRef.current && playerRef.current) {
              try {
                playerRef.current.seekTo(0, true);
                playerRef.current.playVideo();
              } catch {
                // Ignora erros de seek/play
              }
            }
          },
          onError: () => {
            if (onStateChange) {
              onStateChange("error");
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignora erros de cleanup
        }
        playerRef.current = null;
      }
    };
  }, [videoId, onStateChange]);

  // Controle declarativo: playing
  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;

    try {
      const currentState = player.getPlayerState();
      if (playing && currentState !== 1) {
        // 1 = PLAYING
        player.playVideo();
      } else if (!playing && currentState === 1) {
        player.pauseVideo();
      }
    } catch {
      // Player pode nÃ£o estar pronto
    }
  }, [playing, playerReady]);

  // Controle declarativo: volume
  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;

    try {
      const clampedVolume = Math.max(0, Math.min(100, volume));
      player.setVolume(clampedVolume);
      if (clampedVolume > 0) {
        player.unMute();
      }
    } catch {
      // Player pode nÃ£o estar pronto
    }
  }, [volume, playerReady]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      data-testid={`youtube-audio-player-${videoId}`}
    />
  );
}
