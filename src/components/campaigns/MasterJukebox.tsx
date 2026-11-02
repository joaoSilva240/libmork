"use client";

import { useState } from "react";
import { Plus, Music, Play, Pause, Repeat, X, Square, Volume2 } from "lucide-react";
import { useJukebox } from "@/hooks/useJukebox";
import { YouTubeAudioPlayer } from "@/components/audio/YouTubeAudioPlayer";

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
    stopAll,
    toggleLoop,
  } = useJukebox(campaignId, true);

  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [volumeLocal, setVolumeLocal] = useState<Record<string, number>>({});

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

  const activeCount = playingTrackIds ? playingTrackIds.size : playingTrackId ? 1 : 0;

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

      {/* Lista de faixas */}
      {tracks.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma faixa de áudio adicionada. Cole uma URL do YouTube para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => {
            const isPlaying = playingTrackIds
              ? playingTrackIds.has(track.id)
              : playingTrackId === track.id;
            const isLooping = loopTrackIds.has(track.id);
            const volume = volumeLocal[track.id] ?? 50;

            return (
              <div
                key={track.id}
                className={`rounded p-2 flex items-center gap-2 border transition-colors ${
                  isPlaying
                    ? "bg-purple-950/40 border-purple-800/80"
                    : "bg-gray-800 border-transparent"
                }`}
              >
                {/* Ícone de status */}
                <div
                  className={`p-2 rounded flex-shrink-0 ${isPlaying ? "bg-purple-800 text-purple-200" : "bg-gray-800 text-gray-400"}`}
                >
                  {isPlaying ? (
                    <Volume2 size={20} className="animate-pulse" />
                  ) : (
                    <Music size={20} />
                  )}
                </div>

                {/* Título */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate font-medium ${isPlaying ? "text-purple-200" : "text-white"}`}
                  >
                    {track.title}
                  </p>
                </div>

                {/* Controles em linha */}
                <div className="flex items-center gap-2">
                  {/* Play/Pause */}
                  <button
                    onClick={() => togglePlay(track.id)}
                    className={`p-1.5 rounded ${
                      isPlaying ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"
                    } hover:bg-purple-700`}
                    aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  {/* Volume slider */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                    className="w-16 accent-purple-600"
                    aria-label="Volume"
                  />

                  {/* Loop toggle */}
                  <button
                    onClick={() => toggleLoop(track.id)}
                    className={`p-1.5 rounded ${
                      isLooping ? "text-purple-400" : "text-gray-500"
                    } hover:text-purple-300`}
                    aria-label="Loop"
                  >
                    <Repeat size={16} />
                  </button>

                  {/* Remover */}
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-400"
                    aria-label="Remover"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Player invisível */}
                <YouTubeAudioPlayer
                  key={track.id}
                  videoId={track.id}
                  playing={isPlaying}
                  volume={volume}
                  loop={isLooping}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
