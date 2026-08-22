"use client";

import { useCallback, useEffect, useState } from "react";

type LinkedCharacter = {
  linkId: string;
  characterId: string;
  name: string;
  level: number;
  imageUrl: string | null;
  approvalStatus: string;
  origin: string;
  sessionsPlayed: number;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const ORIGIN_LABELS: Record<string, string> = {
  player_created: "criado pelo jogador",
  master_distributed: "distribuída pelo mestre",
  invited: "entrou por convite",
};

export function CampaignCharacters({ campaignId }: { campaignId: string }) {
  const [characters, setCharacters] = useState<LinkedCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar personagens");
        return;
      }

      setCharacters(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/characters`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar personagens");
          return;
        }

        setCharacters(data.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleApprove = async (linkId: string, status: "approved" | "rejected" | "pending") => {
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao atualizar aprovação");
        return;
      }

      await loadCharacters();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleRemove = async (linkId: string) => {
    if (!window.confirm("Remover este personagem da campanha?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/characters/${linkId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao remover personagem");
        return;
      }

      await loadCharacters();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-3 text-lg font-semibold text-white">
        Personagens na Campanha
      </h3>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
        </div>
      ) : characters.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum personagem vinculado. Compartilhe o convite com seus jogadores.
        </p>
      ) : (
        <div className="space-y-3">
          {characters.map((character) => (
            <div
              key={character.linkId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3"
            >
              <div className="flex items-center gap-3">
                {character.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.imageUrl}
                    alt={character.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 font-bold text-gray-400">
                    {character.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{character.name}</p>
                  <p className="text-xs text-gray-400">
                    Nível {character.level} · {ORIGIN_LABELS[character.origin] ?? character.origin}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    character.approvalStatus === "approved"
                      ? "bg-green-900/50 text-green-300"
                      : character.approvalStatus === "rejected"
                        ? "bg-red-900/50 text-red-300"
                        : "bg-yellow-900/50 text-yellow-300"
                  }`}
                >
                  {STATUS_LABELS[character.approvalStatus] ?? character.approvalStatus}
                </span>

                {character.approvalStatus !== "approved" && (
                  <button
                    onClick={() => handleApprove(character.linkId, "approved")}
                    className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Aprovar
                  </button>
                )}
                {character.approvalStatus !== "rejected" && (
                  <button
                    onClick={() => handleApprove(character.linkId, "rejected")}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Rejeitar
                  </button>
                )}
                <button
                  onClick={() => handleRemove(character.linkId)}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
