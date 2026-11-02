"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Play,
  Pause,
  Repeat,
  X,
  Square,
  Volume2,
  SkipBack,
  SkipForward,
  ListMusic,
  Unlink,
} from "lucide-react";
import { useJukebox } from "@/hooks/useJukebox";
import { YouTubeAudioPlayer } from "@/components/audio/YouTubeAudioPlayer";
import { getYouTubeThumbnailUrl, formatAudioTime } from "@/lib/audio/youtube";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

interface MasterJukeboxProps {
  campaignId: string;
  userId: string;
  userName: string;
  className?: string;
}

export function MasterJukebox({
  campaignId,
  userId,
  userName,
  className = "",
}: MasterJukeboxProps) {
  const {
    tracks,
    playingTrackIds,
    playingTrackId,
    loopTrackIds,
    addTrack,
    removeTrack,
    togglePlay,
    seekTrack,
    stopAll,
    toggleLoop,
    createPlaylist,
    ungroupPlaylist,
  } = useJukebox(campaignId, true);

  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [volumeLocal, setVolumeLocal] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<Record<string, { current: number; duration: number }>>(
    {},
  );
  const [seekTargets, setSeekTargets] = useState<Record<string, number | null>>({});

  // Seleção múltipla para criação de playlist
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [playlistNameInput, setPlaylistNameInput] = useState("");

  // Índice da faixa ativa por playlist { [playlistId]: number }
  const [playlistIndices, setPlaylistIndices] = useState<Record<string, number>>({});

  // Estado de loop por playlist { [playlistId]: boolean }
  // Quando ativado: reprodução sequencial volta para a primeira faixa ao terminar a última
  const [playlistLoops, setPlaylistLoops] = useState<Record<string, boolean>>({});

  const togglePlaylistLoop = (playlistId: string) => {
    setPlaylistLoops((prev) => ({
      ...prev,
      [playlistId]: !prev[playlistId],
    }));
  };

  const handleAdd = () => {
    const result = addTrack(urlInput, userId, userName);
    if (result.ok) {
      setUrlInput("");
      setError(null);
    } else {
      setError(result.error || "Erro desconhecido");
    }
  };

  const handleVolumeChange = (trackId: string, value: number) => {
    setVolumeLocal((prev) => ({ ...prev, [trackId]: value }));
  };

  const handleTimeUpdate = useCallback((trackId: string, current: number, duration: number) => {
    setProgress((prev) => {
      const prevTrack = prev[trackId];
      if (
        prevTrack &&
        Math.floor(prevTrack.current) === Math.floor(current) &&
        Math.floor(prevTrack.duration) === Math.floor(duration)
      ) {
        return prev;
      }
      return {
        ...prev,
        [trackId]: { current, duration },
      };
    });
  }, []);

  const handleSeek = (trackId: string, newTime: number) => {
    setProgress((prev) => ({
      ...prev,
      [trackId]: {
        current: newTime,
        duration: prev[trackId]?.duration || 0,
      },
    }));
    setSeekTargets((prev) => ({ ...prev, [trackId]: newTime }));

    // Sincroniza posição com jogadores se a faixa estiver em reprodução
    if (playingTrackIds?.has(trackId)) {
      seekTrack(trackId, newTime);
    }
  };

  const toggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const handleCreatePlaylist = () => {
    if (selectedTrackIds.size < 2) return;
    createPlaylist(Array.from(selectedTrackIds), playlistNameInput || "Nova Playlist");
    setSelectedTrackIds(new Set());
    setPlaylistNameInput("");
  };

  // Navegação na Playlist
  const handlePlaylistPrev = (playlistId: string, plTracks: AudioTrack[]) => {
    const currentIdx = playlistIndices[playlistId] ?? 0;
    const prevIdx = (currentIdx - 1 + plTracks.length) % plTracks.length;
    setPlaylistIndices((prev) => ({ ...prev, [playlistId]: prevIdx }));

    const currentTrack = plTracks[currentIdx];
    const prevTrack = plTracks[prevIdx];
    const isPlaying = playingTrackIds?.has(currentTrack.id);
    if (isPlaying) {
      togglePlay(currentTrack.id);
      togglePlay(prevTrack.id);
    }
  };

  const handlePlaylistNext = (playlistId: string, plTracks: AudioTrack[]) => {
    const currentIdx = playlistIndices[playlistId] ?? 0;
    const nextIdx = (currentIdx + 1) % plTracks.length;
    setPlaylistIndices((prev) => ({ ...prev, [playlistId]: nextIdx }));

    const currentTrack = plTracks[currentIdx];
    const nextTrack = plTracks[nextIdx];
    const isPlaying = playingTrackIds?.has(currentTrack.id);
    if (isPlaying) {
      togglePlay(currentTrack.id);
      togglePlay(nextTrack.id);
    }
  };

  const handlePlaylistTogglePlay = (playlistId: string, plTracks: AudioTrack[]) => {
    const currentIdx = playlistIndices[playlistId] ?? 0;
    const activeTrack = plTracks[currentIdx];
    if (activeTrack) {
      togglePlay(activeTrack.id);
    }
  };

  const handleAutoAdvance = (playlistId: string, trackId: string, plTracks: AudioTrack[]) => {
    const finishedIdx = plTracks.findIndex((t) => t.id === trackId);
    const currentIdx = finishedIdx !== -1 ? finishedIdx : (playlistIndices[playlistId] ?? 0);
    const isLast = currentIdx >= plTracks.length - 1;
    const isPlaylistLooping = !!playlistLoops[playlistId];

    // Pausa a faixa que acabou de finalizar
    togglePlay(trackId);

    if (isLast) {
      if (isPlaylistLooping) {
        // Volta para a primeira reprodução quando a última acabar
        const nextIdx = 0;
        setPlaylistIndices((prev) => ({ ...prev, [playlistId]: nextIdx }));
        const nextTrack = plTracks[nextIdx];
        if (nextTrack) {
          if (nextTrack.id === trackId) {
            seekTrack(trackId, 0);
          } else {
            togglePlay(nextTrack.id);
          }
        }
      } else {
        // Sem loop: finaliza a reprodução e reseta o ponteiro para o início
        setPlaylistIndices((prev) => ({ ...prev, [playlistId]: 0 }));
      }
    } else {
      // Reprodução sequencial para a próxima música da playlist
      const nextIdx = currentIdx + 1;
      setPlaylistIndices((prev) => ({ ...prev, [playlistId]: nextIdx }));
      const nextTrack = plTracks[nextIdx];
      if (nextTrack) {
        togglePlay(nextTrack.id);
      }
    }
  };

  const activeCount = playingTrackIds ? playingTrackIds.size : playingTrackId ? 1 : 0;

  // Agrupar faixas em itens de renderização (faixas soltas vs playlists unificadas)
  type Item =
    | { type: "track"; track: AudioTrack }
    | { type: "playlist"; playlistId: string; playlistName: string; tracks: AudioTrack[] };

  const items: Item[] = [];
  const seenPlaylists = new Set<string>();
  const playlistMap = new Map<string, AudioTrack[]>();

  tracks.forEach((t) => {
    if (t.playlistId) {
      if (!playlistMap.has(t.playlistId)) {
        playlistMap.set(t.playlistId, []);
      }
      playlistMap.get(t.playlistId)!.push(t);
    }
  });

  tracks.forEach((t) => {
    if (!t.playlistId) {
      items.push({ type: "track", track: t });
    } else if (!seenPlaylists.has(t.playlistId)) {
      seenPlaylists.add(t.playlistId);
      items.push({
        type: "playlist",
        playlistId: t.playlistId,
        playlistName: t.playlistName || "Playlist",
        tracks: playlistMap.get(t.playlistId) || [],
      });
    }
  });

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">🎵 Jukebox de Áudio</h3>
        {activeCount > 0 && (
          <button
            onClick={stopAll}
            className="text-xs bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded px-2 py-0.5 flex items-center gap-1 transition-colors"
            title="Parar todas as faixas em execução"
            aria-label="Parar Todos"
          >
            <Square size={12} className="fill-current" />
            Parar Todos ({activeCount})
          </button>
        )}
      </div>

      {/* Input de URL */}
      <div className="flex gap-2 mb-3">
        <input
          type="url"
          placeholder="Cole a URL do YouTube..."
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError(null);
          }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleAdd}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5 flex items-center gap-1"
          aria-label="Adicionar"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Mensagem de erro */}
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {/* Barra de ação de criação de Playlist (quando 2+ faixas selecionadas) */}
      {selectedTrackIds.size >= 2 && (
        <div className="flex items-center gap-2 p-2 bg-purple-950/80 border border-purple-700/60 rounded-md text-xs mb-3 shadow-sm">
          <span className="text-purple-200 font-medium whitespace-nowrap">
            {selectedTrackIds.size} faixas
          </span>
          <input
            type="text"
            placeholder="Nome da Playlist..."
            value={playlistNameInput}
            onChange={(e) => setPlaylistNameInput(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleCreatePlaylist}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap"
            aria-label="Criar Playlist"
          >
            Criar Playlist
          </button>
          <button
            onClick={() => {
              setSelectedTrackIds(new Set());
              setPlaylistNameInput("");
            }}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 rounded px-2 py-1 transition-colors whitespace-nowrap"
            aria-label="Cancelar seleção"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Lista de faixas */}
      {tracks.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma faixa de áudio adicionada. Cole uma URL do YouTube para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            // Renderização da Playlist Unificada
            if (item.type === "playlist") {
              const { playlistId, playlistName, tracks: plTracks } = item;
              const playingIndexInPl = plTracks.findIndex((t) =>
                playingTrackIds ? playingTrackIds.has(t.id) : playingTrackId === t.id,
              );
              const storedIndex = playlistIndices[playlistId] ?? 0;
              const activeIndex =
                playingIndexInPl !== -1
                  ? playingIndexInPl
                  : Math.min(storedIndex, plTracks.length - 1);
              const activeTrack = plTracks[activeIndex] || plTracks[0];

              const isAnyPlaying = plTracks.some((t) =>
                playingTrackIds ? playingTrackIds.has(t.id) : playingTrackId === t.id,
              );
              const isActivePlaying = playingTrackIds
                ? playingTrackIds.has(activeTrack.id)
                : playingTrackId === activeTrack.id;
              const isPlaylistLooping = !!playlistLoops[playlistId];
              const volume = volumeLocal[activeTrack.id] ?? 50;
              const trackProgress = progress[activeTrack.id] || { current: 0, duration: 0 };

              return (
                <div
                  key={playlistId}
                  data-testid={`jukebox-playlist-card-${playlistId}`}
                  className={`relative overflow-hidden rounded-md p-2 flex flex-col gap-1.5 border transition-all ${
                    isAnyPlaying
                      ? "bg-purple-950/70 border-purple-500/80 shadow-md shadow-purple-950/40"
                      : "bg-gray-800/90 border-gray-700/70 hover:border-gray-600"
                  }`}
                >
                  {/* Background da faixa ativa com desfoque */}
                  <div
                    className="absolute inset-0 bg-cover bg-center pointer-events-none transition-transform duration-700 scale-105 filter blur-[2px] opacity-25"
                    style={{
                      backgroundImage: `url(${getYouTubeThumbnailUrl(activeTrack.id, "hq")})`,
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className={`absolute inset-0 pointer-events-none transition-colors ${
                      isAnyPlaying
                        ? "bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-purple-950/75"
                        : "bg-gradient-to-r from-gray-950/95 via-gray-950/90 to-gray-900/85"
                    }`}
                    aria-hidden="true"
                  />

                  {/* Linha 1: Header da Playlist */}
                  <div className="relative z-10 flex items-center justify-between text-xs pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ListMusic size={13} className="text-purple-400 flex-shrink-0" />
                      <span className="font-semibold text-purple-200 truncate">{playlistName}</span>
                      <span className="text-[10px] bg-purple-900/60 border border-purple-700/50 text-purple-200 px-1.5 py-0.2 rounded-full font-mono flex-shrink-0">
                        {activeIndex + 1}/{plTracks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => ungroupPlaylist(playlistId)}
                      className="text-gray-400 hover:text-red-400 p-0.5 rounded transition-colors flex items-center gap-1 text-[11px]"
                      title="Desfazer playlist e separar faixas"
                      aria-label="Desfazer Playlist"
                    >
                      <Unlink size={12} />
                      <span className="text-[10px]">Separar</span>
                    </button>
                  </div>

                  {/* Linha 2: Thumb + Título + Navegação (Anterior / Play / Próximo) */}
                  <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                    <div className="relative w-7 h-7 rounded overflow-hidden flex-shrink-0 border border-gray-700/80 bg-gray-900 shadow">
                      <img
                        src={getYouTubeThumbnailUrl(activeTrack.id, "mq")}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isActivePlaying && (
                        <div className="absolute inset-0 bg-purple-950/50 backdrop-blur-[1px] flex items-center justify-center">
                          <Volume2 size={13} className="text-purple-300 animate-pulse" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <p
                        className={`text-xs truncate font-medium drop-shadow-sm ${
                          isActivePlaying ? "text-purple-200" : "text-white"
                        }`}
                      >
                        {activeTrack.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Botão Anterior */}
                      <button
                        onClick={() => handlePlaylistPrev(playlistId, plTracks)}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                        aria-label="Anterior"
                        title="Faixa anterior"
                      >
                        <SkipBack size={13} />
                      </button>

                      {/* Play/Pause */}
                      <button
                        onClick={() => handlePlaylistTogglePlay(playlistId, plTracks)}
                        className={`p-1 rounded ${
                          isActivePlaying ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"
                        } hover:bg-purple-700 transition-colors`}
                        aria-label={isActivePlaying ? "Pausar" : "Reproduzir"}
                      >
                        {isActivePlaying ? <Pause size={13} /> : <Play size={13} />}
                      </button>

                      {/* Botão Próximo */}
                      <button
                        onClick={() => handlePlaylistNext(playlistId, plTracks)}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                        aria-label="Próximo"
                        title="Próxima faixa"
                      >
                        <SkipForward size={13} />
                      </button>

                      {/* Volume */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(activeTrack.id, Number(e.target.value))}
                        className="w-14 h-1 accent-purple-600 cursor-pointer"
                        aria-label="Volume"
                        title="Volume"
                      />

                      {/* Loop da Playlist (reprodução sequencial com repetição ao fim) */}
                      <button
                        onClick={() => togglePlaylistLoop(playlistId)}
                        className={`p-1 rounded ${
                          isPlaylistLooping
                            ? "text-purple-400 bg-purple-950/50"
                            : "text-gray-400 hover:text-purple-300"
                        } transition-colors`}
                        aria-label="Loop"
                        title={
                          isPlaylistLooping
                            ? "Repetição de playlist ativada (volta à primeira faixa ao terminar)"
                            : "Repetição de playlist desativada"
                        }
                      >
                        <Repeat size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Linha 3: Linha de reprodução da faixa ativa */}
                  <div className="relative z-10 flex items-center gap-1.5 pt-0.5 border-t border-white/5">
                    <span className="text-[10px] font-mono text-gray-400 tabular-nums w-8 text-right select-none">
                      {formatAudioTime(trackProgress.current)}
                    </span>

                    <input
                      type="range"
                      min={0}
                      max={trackProgress.duration > 0 ? trackProgress.duration : 100}
                      step={1}
                      value={trackProgress.current}
                      onChange={(e) => handleSeek(activeTrack.id, Number(e.target.value))}
                      className="flex-1 h-1 bg-gray-700/80 rounded appearance-none cursor-pointer accent-purple-500 hover:h-1.5 transition-all"
                      aria-label="Linha de reprodução"
                    />

                    <span className="text-[10px] font-mono text-gray-400 tabular-nums w-8 select-none">
                      {formatAudioTime(trackProgress.duration)}
                    </span>
                  </div>

                  {/* Players invisíveis para todas as faixas da playlist */}
                  {plTracks.map((t) => {
                    const isTrackPlaying = playingTrackIds
                      ? playingTrackIds.has(t.id)
                      : playingTrackId === t.id;
                    const trackVol = volumeLocal[t.id] ?? 50;

                    return (
                      <YouTubeAudioPlayer
                        key={t.id}
                        videoId={t.id}
                        playing={isTrackPlaying}
                        volume={trackVol}
                        loop={false}
                        seekTime={seekTargets[t.id]}
                        onTimeUpdate={(cur, dur) => handleTimeUpdate(t.id, cur, dur)}
                        onStateChange={(state) => {
                          if (state === "ended") {
                            handleAutoAdvance(playlistId, t.id, plTracks);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              );
            }

            // Renderização do Card de Faixa Solta (Slim Layout)
            const track = item.track;
            const isPlaying = playingTrackIds
              ? playingTrackIds.has(track.id)
              : playingTrackId === track.id;
            const isLooping = loopTrackIds.has(track.id);
            const volume = volumeLocal[track.id] ?? 50;
            const trackProgress = progress[track.id] || { current: 0, duration: 0 };

            return (
              <div
                key={track.id}
                data-testid={`jukebox-track-card-${track.id}`}
                className={`relative overflow-hidden rounded-md p-2 flex flex-col gap-1.5 border transition-all ${
                  isPlaying
                    ? "bg-purple-950/60 border-purple-600/80 shadow-md shadow-purple-950/40"
                    : "bg-gray-800/90 border-gray-700/60 hover:border-gray-600"
                }`}
              >
                {/* Thumbnail de fundo com desfoque e opacidade */}
                <div
                  className="absolute inset-0 bg-cover bg-center pointer-events-none transition-transform duration-700 scale-105 filter blur-[2px] opacity-20"
                  style={{
                    backgroundImage: `url(${getYouTubeThumbnailUrl(track.id, "hq")})`,
                  }}
                  aria-hidden="true"
                />

                <div
                  className={`absolute inset-0 pointer-events-none transition-colors ${
                    isPlaying
                      ? "bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-purple-950/70"
                      : "bg-gradient-to-r from-gray-950/95 via-gray-950/90 to-gray-900/85"
                  }`}
                  aria-hidden="true"
                />

                {/* Linha superior: Checkbox + Mini Thumb + Título + Controles */}
                <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                  {/* Checkbox de seleção para playlist */}
                  <input
                    type="checkbox"
                    checked={selectedTrackIds.has(track.id)}
                    onChange={() => toggleSelectTrack(track.id)}
                    aria-label="Selecionar faixa"
                    title="Selecionar para criar playlist"
                    className="w-3.5 h-3.5 rounded border-gray-700 bg-gray-900 text-purple-600 accent-purple-600 cursor-pointer flex-shrink-0"
                  />

                  {/* Mini thumbnail */}
                  <div className="relative w-7 h-7 rounded overflow-hidden flex-shrink-0 border border-gray-700/80 bg-gray-900 shadow">
                    <img
                      src={getYouTubeThumbnailUrl(track.id, "mq")}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-purple-950/50 backdrop-blur-[1px] flex items-center justify-center">
                        <Volume2 size={13} className="text-purple-300 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Título da faixa */}
                  <div className="flex-1 min-w-0 pr-1">
                    <p
                      className={`text-xs truncate font-medium drop-shadow-sm ${
                        isPlaying ? "text-purple-200" : "text-white"
                      }`}
                    >
                      {track.title}
                    </p>
                  </div>

                  {/* Controles em linha */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Play/Pause */}
                    <button
                      onClick={() => togglePlay(track.id)}
                      className={`p-1 rounded ${
                        isPlaying ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"
                      } hover:bg-purple-700 transition-colors`}
                      aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    </button>

                    {/* Volume slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                      className="w-14 h-1 accent-purple-600 cursor-pointer"
                      aria-label="Volume"
                      title="Volume"
                    />

                    {/* Loop toggle */}
                    <button
                      onClick={() => toggleLoop(track.id)}
                      className={`p-1 rounded ${
                        isLooping
                          ? "text-purple-400 bg-purple-950/50"
                          : "text-gray-400 hover:text-purple-300"
                      } transition-colors`}
                      aria-label="Loop"
                      title="Repetir faixa"
                    >
                      <Repeat size={13} />
                    </button>

                    {/* Remover */}
                    <button
                      onClick={() => removeTrack(track.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors"
                      aria-label="Remover"
                      title="Remover faixa"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Linha de reprodução interativa slim */}
                <div className="relative z-10 flex items-center gap-1.5 pt-0.5 border-t border-white/5">
                  <span className="text-[10px] font-mono text-gray-400 tabular-nums w-8 text-right select-none">
                    {formatAudioTime(trackProgress.current)}
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={trackProgress.duration > 0 ? trackProgress.duration : 100}
                    step={1}
                    value={trackProgress.current}
                    onChange={(e) => handleSeek(track.id, Number(e.target.value))}
                    className="flex-1 h-1 bg-gray-700/80 rounded appearance-none cursor-pointer accent-purple-500 hover:h-1.5 transition-all"
                    aria-label="Linha de reprodução"
                  />

                  <span className="text-[10px] font-mono text-gray-400 tabular-nums w-8 select-none">
                    {formatAudioTime(trackProgress.duration)}
                  </span>
                </div>

                {/* Player invisível */}
                <YouTubeAudioPlayer
                  key={track.id}
                  videoId={track.id}
                  playing={isPlaying}
                  volume={volume}
                  loop={isLooping}
                  seekTime={seekTargets[track.id]}
                  onTimeUpdate={(cur, dur) => handleTimeUpdate(track.id, cur, dur)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
