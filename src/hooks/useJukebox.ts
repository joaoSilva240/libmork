"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { extractYouTubeId } from "@/lib/audio/youtube";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

export interface UseJukeboxReturn {
  tracks: AudioTrack[];
  playingTrackId: string | null;
  loopTrackIds: Set<string>;
  playingAt: number | null;
  addTrack: (url: string, addedBy: string, actorName: string) => { ok: boolean; error?: string };
  removeTrack: (trackId: string) => void;
  togglePlay: (trackId: string) => void;
  toggleLoop: (trackId: string) => void;
}

export function useJukebox(campaignId: string | null, isMaster: boolean): UseJukeboxReturn {
  const {
    emitAudioTrackAdd,
    emitAudioTrackPlay,
    emitAudioTrackPause,
    emitAudioTrackLoop,
    emitAudioTrackRemove,
    subscribeAudioTrackAdd,
    subscribeAudioTrackPlay,
    subscribeAudioTrackPause,
    subscribeAudioTrackLoop,
    subscribeAudioTrackRemove,
    subscribeAudioTrackState,
  } = useSocket();

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [loopTrackIds, setLoopTrackIds] = useState<Set<string>>(new Set());
  const [playingAt, setPlayingAt] = useState<number | null>(null);

  // ============================= Mutators (master-only) =============================

  const addTrack = useCallback(
    (url: string, addedBy: string, actorName: string): { ok: boolean; error?: string } => {
      if (!isMaster) {
        return { ok: false, error: "Apenas o mestre pode adicionar faixas" };
      }

      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return { ok: false, error: "URL inválida do YouTube" };
      }

      if (!campaignId) {
        return { ok: false, error: "campaignId não disponível" };
      }

      const track: AudioTrack = {
        id: videoId,
        title: videoId,
        addedBy,
        addedAt: new Date().toISOString(),
      };

      // Optimistic local update (dedupe)
      setTracks((prev) => {
        if (prev.some((t) => t.id === track.id)) {
          return prev;
        }
        return [...prev, track];
      });

      // Emit to server
      emitAudioTrackAdd({ campaignId, actorName, track });

      return { ok: true };
    },
    [isMaster, campaignId, emitAudioTrackAdd]
  );

  const removeTrack = useCallback(
    (trackId: string) => {
      if (!isMaster || !campaignId) return;

      // Optimistic local removal
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setLoopTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });

      if (playingTrackId === trackId) {
        setPlayingTrackId(null);
        setPlayingAt(null);
      }

      // Emit to server
      emitAudioTrackRemove({ campaignId, trackId });
    },
    [isMaster, campaignId, playingTrackId, emitAudioTrackRemove]
  );

  const togglePlay = useCallback(
    (trackId: string) => {
      if (!isMaster || !campaignId) return;

      if (playingTrackId === trackId) {
        // Pause
        setPlayingTrackId(null);
        setPlayingAt(null);
        emitAudioTrackPause({ campaignId, trackId });
      } else {
        // Play
        const now = Date.now();
        setPlayingTrackId(trackId);
        setPlayingAt(now);
        emitAudioTrackPlay({ campaignId, trackId, playingAt: now });
      }
    },
    [isMaster, campaignId, playingTrackId, emitAudioTrackPlay, emitAudioTrackPause]
  );

  const toggleLoop = useCallback(
    (trackId: string) => {
      if (!isMaster || !campaignId) return;

      setLoopTrackIds((prev) => {
        const next = new Set(prev);
        const willLoop = !prev.has(trackId);
        if (willLoop) {
          next.add(trackId);
        } else {
          next.delete(trackId);
        }

        // Emit to server
        emitAudioTrackLoop({ campaignId, trackId, loop: willLoop });

        return next;
      });
    },
    [isMaster, campaignId, emitAudioTrackLoop]
  );

  // ============================= Subscribers =============================

  useEffect(() => {
    if (!campaignId) return;

    const unsubAdd = subscribeAudioTrackAdd((payload) => {
      if (payload.campaignId !== campaignId) return;
      setTracks((prev) => {
        if (prev.some((t) => t.id === payload.track.id)) {
          return prev;
        }
        return [...prev, payload.track];
      });
    });

    const unsubPlay = subscribeAudioTrackPlay((payload) => {
      if (payload.campaignId !== campaignId) return;
      setPlayingTrackId(payload.trackId);
      setPlayingAt(payload.playingAt);
    });

    const unsubPause = subscribeAudioTrackPause((payload) => {
      if (payload.campaignId !== campaignId) return;
      setPlayingTrackId(null);
      setPlayingAt(null);
    });

    const unsubLoop = subscribeAudioTrackLoop((payload) => {
      if (payload.campaignId !== campaignId) return;
      setLoopTrackIds((prev) => {
        const next = new Set(prev);
        if (payload.loop) {
          next.add(payload.trackId);
        } else {
          next.delete(payload.trackId);
        }
        return next;
      });
    });

    const unsubRemove = subscribeAudioTrackRemove((payload) => {
      if (payload.campaignId !== campaignId) return;
      setTracks((prev) => prev.filter((t) => t.id !== payload.trackId));
      setLoopTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.trackId);
        return next;
      });
      if (playingTrackId === payload.trackId) {
        setPlayingTrackId(null);
        setPlayingAt(null);
      }
    });

    const unsubState = subscribeAudioTrackState((payload) => {
      if (payload.campaignId !== campaignId) return;
      // Full state replacement
      setTracks(payload.tracks);
      setPlayingTrackId(payload.playingTrackId);
      setPlayingAt(payload.playingAt);
      setLoopTrackIds(new Set(payload.loopTrackIds));
    });

    return () => {
      unsubAdd();
      unsubPlay();
      unsubPause();
      unsubLoop();
      unsubRemove();
      unsubState();
    };
  }, [
    campaignId,
    playingTrackId,
    subscribeAudioTrackAdd,
    subscribeAudioTrackPlay,
    subscribeAudioTrackPause,
    subscribeAudioTrackLoop,
    subscribeAudioTrackRemove,
    subscribeAudioTrackState,
  ]);

  return {
    tracks,
    playingTrackId,
    loopTrackIds,
    playingAt,
    addTrack,
    removeTrack,
    togglePlay,
    toggleLoop,
  };
}
