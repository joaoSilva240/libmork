"use client";

// =============================================================================
// Libmork — Audio: Componente YouTubeAudioPlayer (Issue #60)
// =============================================================================
// Player de áudio invisível via YouTube IFrame API. Controle declarativo
// via props (playing, volume, loop, seekTime). Suporta callback de progresso
// onTimeUpdate(currentTime, duration).
// Estável contra re-renders (callbacks preservados em refs).

import { useEffect, useRef, useState } from "react";
import { loadYouTubeIframeApi } from "@/lib/audio/youTubeApi";

export interface YouTubeAudioPlayerProps {
  videoId: string;
  volume?: number;
  loop?: boolean;
  playing?: boolean;
  seekTime?: number | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (state: "playing" | "paused" | "ended" | "unstarted" | "error") => void;
}

export function YouTubeAudioPlayer({
  videoId,
  volume = 50,
  loop = false,
  playing = false,
  seekTime,
  onTimeUpdate,
  onStateChange,
}: YouTubeAudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const lastSeekRef = useRef<number | null>(null);

  // Armazena callbacks e props dinâmicos em refs para NÃO disparar re-mount do player
  const onStateChangeRef = useRef(onStateChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const loopRef = useRef(loop);
  const playingRef = useRef(playing);
  const volumeRef = useRef(volume);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Função pura para reportar tempo atual usando ref estável
  const reportTime = () => {
    const player = playerRef.current;
    if (!player || !onTimeUpdateRef.current) return;
    try {
      const cur = typeof player.getCurrentTime === "function" ? player.getCurrentTime() : 0;
      const dur = typeof player.getDuration === "function" ? player.getDuration() : 0;
      onTimeUpdateRef.current(cur, dur);
    } catch {
      // Ignora erro se player não estiver pronto
    }
  };

  // Mount: carrega API + cria player (APENAS quando videoId mudar)
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
            if (!mounted) return;
            setPlayerReady(true);

            const player = playerRef.current;
            if (player) {
              // Aplica volume inicial
              try {
                const vol = Math.max(0, Math.min(100, volumeRef.current));
                player.setVolume(vol);
                if (vol > 0) player.unMute();
              } catch {}

              // Se já estiver marcado para tocar, inicia imediatamente
              if (playingRef.current) {
                try {
                  player.playVideo();
                } catch {}
              }

              // Notifica tempo inicial
              reportTime();
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            reportTime();

            // Notifica callback se presente
            if (onStateChangeRef.current) {
              if (state === YT.PlayerState.UNSTARTED) {
                onStateChangeRef.current("unstarted");
              } else if (state === YT.PlayerState.ENDED) {
                onStateChangeRef.current("ended");
              } else if (state === YT.PlayerState.PLAYING) {
                onStateChangeRef.current("playing");
              } else if (state === YT.PlayerState.PAUSED) {
                onStateChangeRef.current("paused");
              }
            }

            // Loop: se ativado e chegou ao fim, reinicia
            if (state === YT.PlayerState.ENDED && loopRef.current && playerRef.current) {
              try {
                playerRef.current.seekTo(0, true);
                playerRef.current.playVideo();
              } catch {}
            }
          },
          onError: () => {
            if (onStateChangeRef.current) {
              onStateChangeRef.current("error");
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
        } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Controle declarativo: playing
  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;

    try {
      const currentState =
        typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
      if (playing && currentState !== 1) {
        // 1 = PLAYING
        player.playVideo();
      } else if (!playing && currentState === 1) {
        player.pauseVideo();
      }
    } catch {}
  }, [playing, playerReady]);

  // Controle declarativo: seekTime (apenas quando seekTime mudar explicitamente)
  useEffect(() => {
    if (seekTime == null || !playerReady) return;
    if (lastSeekRef.current === seekTime) return;
    lastSeekRef.current = seekTime;

    const player = playerRef.current;
    if (!player || typeof player.seekTo !== "function") return;

    try {
      player.seekTo(seekTime, true);
      reportTime();
    } catch {}
  }, [seekTime, playerReady]);

  // Atualização periódica de tempo enquanto playing (apenas se onTimeUpdate for fornecido)
  useEffect(() => {
    if (!playerReady || !playing || !onTimeUpdate) return;

    reportTime();
    const interval = setInterval(reportTime, 500);

    return () => clearInterval(interval);
  }, [playing, playerReady, onTimeUpdate]);

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
    } catch {}
  }, [volume, playerReady]);

  return <div ref={containerRef} aria-hidden data-testid={`youtube-audio-player-${videoId}`} />;
}
