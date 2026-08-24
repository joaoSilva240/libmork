"use client";

import { useEffect, useState } from "react";

type ShareLinkData = {
  id: string;
  characterId: string;
  token: string;
  revoked: boolean;
  createdAt: string;
  url: string;
};

export function ShareLink({ characterId }: { characterId: string }) {
  const [link, setLink] = useState<ShareLinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}/share`, {
          credentials: "include"
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar link");
          return;
        }

        setLink(data.data);
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
  }, [characterId]);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/share`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao gerar link");
        return;
      }

      setLink(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Revogar o link público? O link atual deixará de funcionar.")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/share`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao revogar link");
        return;
      }

      setLink(null);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <p className="text-sm text-gray-500">Carregando link público...</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-3 text-lg font-semibold text-white">Link Público</h3>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {link ? (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={link.url}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Qualquer pessoa com este link pode ver a ficha (somente leitura).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? "Gerando..." : "Regenerar"}
            </button>
            <button
              onClick={handleRevoke}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Revogar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-400">
            Nenhum link público ativo. Gere um para compartilhar a ficha com quem quiser.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? "Gerando..." : "Gerar Link"}
          </button>
        </div>
      )}
    </div>
  );
}
