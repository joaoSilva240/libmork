"use client";

import { useState } from "react";
import { Plus, Music, Play, Pause, Repeat, X } from "lucide-react";
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
  const { tracks, playingTrackId, loopTrackIds, addTrack, removeTrack, togglePlay, toggleLoop } =
    useJukebox(campaignId, true);

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

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded p-3 ${className}`}>
      <h3 className="font-semibold text-white mb-2">🎵 Jukebox de Áudio</h3>

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
            const isPlaying = playingTrackId === track.id;
            const isLooping = loopTrackIds.has(track.id);
            const volume = volumeLocal[track.id] ?? 50;

            return (
              <div key={track.id} className="bg-gray-800 rounded p-2 flex items-center gap-2">
                {/* Thumbnail fake */}
                <div className="bg-gray-800 p-2 rounded flex-shrink-0">
                  <Music size={20} className="text-gray-400" />
                </div>

                {/* Título */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{track.title}</p>
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
