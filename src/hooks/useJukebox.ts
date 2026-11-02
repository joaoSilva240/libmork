"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { extractYouTubeId } from "@/lib/audio/youtube";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

export interface UseJukeboxReturn {
  tracks: AudioTrack[];
  playingTrackIds: Set<string>;
  playingTrackId: string | null;
  loopTrackIds: Set<string>;
  playingAt: number | null;
  trackPlayingAts: Record<string, number>;
  isLoading: boolean;
  addTrack: (url: string, addedBy: string, actorName: string) => { ok: boolean; error?: string };
  removeTrack: (trackId: string) => void;
  togglePlay: (trackId: string) => void;
  seekTrack: (trackId: string, seconds: number) => void;
  stopAll: () => void;
  toggleLoop: (trackId: string) => void;
  createPlaylist: (trackIds: string[], name: string) => void;
  ungroupPlaylist: (playlistId: string) => void;
}

function getApiUrl(path: string): string {
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    window.location.origin !== "null"
  ) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function useJukebox(campaignId: string | null, isMaster: boolean): UseJukeboxReturn {
  const {
    emitAudioTrackAdd,
    emitAudioTrackPlay,
    emitAudioTrackPause,
    emitAudioTrackLoop,
    emitAudioTrackRemove,
    emitAudioTrackPlaylist,
    subscribeAudioTrackAdd,
    subscribeAudioTrackPlay,
    subscribeAudioTrackPause,
    subscribeAudioTrackLoop,
    subscribeAudioTrackRemove,
    subscribeAudioTrackPlaylist,
    subscribeAudioTrackState,
  } = useSocket();

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [playingTrackIds, setPlayingTrackIds] = useState<Set<string>>(new Set());
  const [loopTrackIds, setLoopTrackIds] = useState<Set<string>>(new Set());
  const [playingAt, setPlayingAt] = useState<number | null>(null);
  const [trackPlayingAts, setTrackPlayingAts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Retrocompatibilidade para single-track (primeira faixa tocando ou null)
  const playingTrackId = playingTrackIds.size > 0 ? Array.from(playingTrackIds)[0] : null;

  // ============================= Carregamento Inicial (DB) =============================

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setIsLoading(true);

    fetch(getApiUrl(`/api/campaigns/${campaignId}/tracks`), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar faixas");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.data)) {
          setTracks((prev) => {
            const map = new Map<string, AudioTrack>();
            data.data.forEach((t: AudioTrack) => map.set(t.id, t));
            prev.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {
        // Falhas silenciosas em ambiente de teste ou desconexão
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [campaignId]);

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

      // Persistir no banco de dados via API em segundo plano
      fetch(getApiUrl(`/api/campaigns/${campaignId}/tracks`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoId, title: videoId }),
      }).catch((err) => {
        console.error("Erro ao persistir faixa:", err);
      });

      return { ok: true };
    },
    [isMaster, campaignId, emitAudioTrackAdd],
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
      setPlayingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        if (next.size === 0) setPlayingAt(null);
        return next;
      });
      setTrackPlayingAts((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });

      // Emit to server
      emitAudioTrackRemove({ campaignId, trackId });

      // Remover do banco de dados via API em segundo plano
      fetch(getApiUrl(`/api/campaigns/${campaignId}/tracks/${trackId}`), {
        method: "DELETE",
        credentials: "include",
      }).catch((err) => {
        console.error("Erro ao deletar faixa:", err);
      });
    },
    [isMaster, campaignId, emitAudioTrackRemove],
  );

  const togglePlay = useCallback(
    (trackId: string) => {
      if (!isMaster || !campaignId) return;

      setPlayingTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) {
          // Pause faixa
          next.delete(trackId);
          if (next.size === 0) setPlayingAt(null);
          emitAudioTrackPause({ campaignId, trackId });
        } else {
          // Play faixa (execução simultânea permitida!)
          const now = Date.now();
          next.add(trackId);
          setPlayingAt(now);
          setTrackPlayingAts((curr) => ({ ...curr, [trackId]: now }));
          emitAudioTrackPlay({ campaignId, trackId, playingAt: now });
        }
        return next;
      });
    },
    [isMaster, campaignId, emitAudioTrackPlay, emitAudioTrackPause],
  );

  const seekTrack = useCallback(
    (trackId: string, seconds: number) => {
      if (!isMaster || !campaignId) return;

      const now = Date.now();
      const virtualPlayingAt = now - Math.round(seconds * 1000);
      setPlayingAt(virtualPlayingAt);
      setTrackPlayingAts((curr) => ({ ...curr, [trackId]: virtualPlayingAt }));

      // Garante que a faixa esteja marcada como playing
      setPlayingTrackIds((prev) => {
        if (!prev.has(trackId)) {
          const next = new Set(prev);
          next.add(trackId);
          return next;
        }
        return prev;
      });

      emitAudioTrackPlay({ campaignId, trackId, playingAt: virtualPlayingAt });
    },
    [isMaster, campaignId, emitAudioTrackPlay],
  );

  const stopAll = useCallback(() => {
    if (!isMaster || !campaignId) return;

    setPlayingTrackIds((prev) => {
      prev.forEach((trackId) => {
        emitAudioTrackPause({ campaignId, trackId });
      });
      return new Set();
    });
    setPlayingAt(null);
    setTrackPlayingAts({});
  }, [isMaster, campaignId, emitAudioTrackPause]);

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
    [isMaster, campaignId, emitAudioTrackLoop],
  );

  const createPlaylist = useCallback(
    (trackIds: string[], name: string) => {
      if (!isMaster || !campaignId || trackIds.length < 2) return;
      const playlistId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const playlistName = name.trim() || "Nova Playlist";

      setTracks((prev) =>
        prev.map((t) => (trackIds.includes(t.id) ? { ...t, playlistId, playlistName } : t)),
      );

      emitAudioTrackPlaylist({ campaignId, trackIds, playlistId, playlistName });

      fetch(getApiUrl(`/api/campaigns/${campaignId}/tracks`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackIds, playlistId, playlistName }),
      }).catch((err) => {
        console.error("Erro ao criar playlist:", err);
      });
    },
    [isMaster, campaignId, emitAudioTrackPlaylist],
  );

  const ungroupPlaylist = useCallback(
    (playlistId: string) => {
      if (!isMaster || !campaignId) return;

      const trackIds = tracks.filter((t) => t.playlistId === playlistId).map((t) => t.id);
      if (trackIds.length === 0) return;

      setTracks((prev) =>
        prev.map((t) =>
          t.playlistId === playlistId ? { ...t, playlistId: null, playlistName: null } : t,
        ),
      );

      emitAudioTrackPlaylist({ campaignId, trackIds, playlistId: null, playlistName: null });

      fetch(getApiUrl(`/api/campaigns/${campaignId}/tracks`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackIds, playlistId: null }),
      }).catch((err) => {
        console.error("Erro ao desagrupar playlist:", err);
      });
    },
    [isMaster, campaignId, tracks, emitAudioTrackPlaylist],
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
      setPlayingTrackIds((prev) => new Set(prev).add(payload.trackId));
      setPlayingAt(payload.playingAt);
      setTrackPlayingAts((curr) => ({ ...curr, [payload.trackId]: payload.playingAt }));
    });

    const unsubPause = subscribeAudioTrackPause((payload) => {
      if (payload.campaignId !== campaignId) return;
      setPlayingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.trackId);
        if (next.size === 0) setPlayingAt(null);
        return next;
      });
      setTrackPlayingAts((curr) => {
        const next = { ...curr };
        delete next[payload.trackId];
        return next;
      });
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
      setPlayingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.trackId);
        if (next.size === 0) setPlayingAt(null);
        return next;
      });
      setTrackPlayingAts((curr) => {
        const next = { ...curr };
        delete next[payload.trackId];
        return next;
      });
    });

    const unsubPlaylist = subscribeAudioTrackPlaylist((payload) => {
      if (payload.campaignId !== campaignId) return;
      setTracks((prev) =>
        prev.map((t) => {
          if (payload.trackIds.includes(t.id)) {
            return {
              ...t,
              playlistId: payload.playlistId ?? null,
              playlistName: payload.playlistName ?? null,
            };
          }
          return t;
        }),
      );
    });

    const unsubState = subscribeAudioTrackState((payload) => {
      if (payload.campaignId !== campaignId) return;
      // Full state replacement
      setTracks(payload.tracks);
      if (payload.playingTrackIds && Array.isArray(payload.playingTrackIds)) {
        setPlayingTrackIds(new Set(payload.playingTrackIds));
      } else if (payload.playingTrackId) {
        setPlayingTrackIds(new Set([payload.playingTrackId]));
      } else {
        setPlayingTrackIds(new Set());
      }
      setPlayingAt(payload.playingAt ?? null);
      setLoopTrackIds(new Set(payload.loopTrackIds));
    });

    return () => {
      unsubAdd();
      unsubPlay();
      unsubPause();
      unsubLoop();
      unsubRemove();
      unsubPlaylist();
      unsubState();
    };
  }, [
    campaignId,
    subscribeAudioTrackAdd,
    subscribeAudioTrackPlay,
    subscribeAudioTrackPause,
    subscribeAudioTrackLoop,
    subscribeAudioTrackRemove,
    subscribeAudioTrackPlaylist,
    subscribeAudioTrackState,
  ]);

  return {
    tracks,
    playingTrackIds,
    playingTrackId,
    loopTrackIds,
    playingAt,
    trackPlayingAts,
    isLoading,
    addTrack,
    removeTrack,
    togglePlay,
    seekTrack,
    stopAll,
    toggleLoop,
    createPlaylist,
    ungroupPlaylist,
  };
}
