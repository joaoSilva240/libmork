"use client";

import { useEffect, useState } from "react";
import type { Encounter } from "@/types";
import type { RosterActor } from "@/components/campaigns/ActorOverlay";

type EncounterModalProps = {
  campaignId: string;
  worldId: string;
  actors: RosterActor[];
  onClose: () => void;
  onEncounterStarted: () => void;
};

export function EncounterModal({
  campaignId,
  worldId,
  actors,
  onClose,
  onEncounterStarted,
}: EncounterModalProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>("");
  const [selectedActorIds, setSelectedActorIds] = useState<Set<string>>(
    new Set(actors.map((a) => `${a.kind}:${a.id}`))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/worlds/${worldId}/encounters`);
        const data = await res.json();
        if (res.ok) {
          setEncounters(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedEncounterId(data.data[0].id);
          }
        } else {
          setError(data.error || "Erro ao carregar encontros");
        }
      } catch {
        setError("Erro de conexão");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [campaignId, worldId]);

  const toggleActor = (actorKey: string) => {
    const next = new Set(selectedActorIds);
    if (next.has(actorKey)) {
      next.delete(actorKey);
    } else {
      next.add(actorKey);
    }
    setSelectedActorIds(next);
  };

  const handleStartEncounter = async () => {
    if (!selectedEncounterId) {
      setError("Selecione um encontro");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Ativar o encontro
      const res = await fetch(`/api/campaigns/${campaignId}/encounters/${selectedEncounterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao iniciar encontro");
        setIsSubmitting(false);
        return;
      }

      // 2. Adicionar participantes selecionados
      const promises = Array.from(selectedActorIds).map((key) => {
        const [kind, id] = key.split(":");
        return fetch(`/api/campaigns/${campaignId}/encounters/${selectedEncounterId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorType: kind,
            actorId: id,
          }),
        });
      });

      await Promise.all(promises);

      onEncounterStarted();
      onClose();
    } catch {
      setError("Erro ao registrar participantes do encontro");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Iniciar Encontro (Combate)</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
          </div>
        ) : encounters.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">
            Nenhum encontro cadastrado para este mundo. Crie um encontro clicando no mundo em &quot;Mundos&quot;.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">
                Selecione o Encontro
              </label>
              <select
                value={selectedEncounterId}
                onChange={(e) => setSelectedEncounterId(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-transparent focus:ring-2 focus:ring-purple-600"
              >
                {encounters.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.name} {enc.isActive ? "(Ativo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">
                Participantes do Combate (Jogadores e NPCs)
              </label>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-2">
                {actors.map((actor) => {
                  const key = `${actor.kind}:${actor.id}`;
                  const isChecked = selectedActorIds.has(key);

                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded p-1.5 text-xs text-white hover:bg-gray-900 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleActor(key)}
                        className="h-4 w-4 accent-purple-600"
                      />
                      <span className="font-semibold">{actor.name}</span>
                      <span className="text-gray-400">
                        ({actor.kind === "character" ? "Jogador" : "NPC"})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStartEncounter}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? "Iniciando..." : "⚔️ Iniciar Combate"}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
