"use client";

import { useEffect, useState } from "react";

type InviteData = {
  id: string;
  campaignId: string;
  token: string;
  revoked: boolean;
  createdAt: string;
  url: string;
};

export function CampaignInvites({ campaignId }: { campaignId: string }) {
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/invites`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar convites");
          return;
        }

        setInvites(data.data.filter((invite: InviteData) => !invite.revoked));
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

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/invites`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao gerar convite");
        return;
      }

      setInvites((prev) => [...prev, data.data]);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!window.confirm("Revogar este convite? O link deixará de funcionar.")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/invites/${inviteId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao revogar convite");
        return;
      }

      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleCopy = async (invite: InviteData) => {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedToken(invite.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Convites de Jogadores</h3>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isGenerating ? "Gerando..." : "+ Novo Convite"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando convites...</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum convite ativo. Gere um link e envie aos seus jogadores.
        </p>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 p-3"
            >
              <input
                type="text"
                readOnly
                value={invite.url}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => handleCopy(invite)}
                className="shrink-0 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700"
              >
                {copiedToken === invite.token ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => handleRevoke(invite.id)}
                className="shrink-0 text-xs text-red-400 hover:text-red-300"
              >
                Revogar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
