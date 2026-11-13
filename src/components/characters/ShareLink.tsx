"use client";

import { useEffect, useState } from "react";

type ShareKind = "view" | "acquire";

type ShareLinkData = {
  id: string;
  characterId: string;
  token: string;
  kind: ShareKind;
  revoked: boolean;
  createdAt: string;
  url: string;
};

const KIND_COPY: Record<
  ShareKind,
  { title: string; hint: string; emptyText: string; generateLabel: string }
> = {
  view: {
    title: "Link público (visualização)",
    hint: "Qualquer pessoa pode ver a apresentação off-session do personagem (somente leitura).",
    emptyText: "Nenhum link público ativo. Gere um para compartilhar a visualização.",
    generateLabel: "Gerar link de visualização",
  },
  acquire: {
    title: "Link de aquisição",
    hint: "Jogadores autenticados podem adquirir uma cópia independente deste personagem.",
    emptyText: "Nenhum link de aquisição ativo. Gere um para permitir a clonagem.",
    generateLabel: "Gerar link de aquisição",
  },
};

function ShareLinkSection({ characterId, kind }: { characterId: string; kind: ShareKind }) {
  const [link, setLink] = useState<ShareLinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}/share?kind=${kind}`, {
          credentials: "include",
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
  }, [characterId, kind]);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind }),
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
    if (!window.confirm("Revogar este link? O link atual deixará de funcionar.")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/share?kind=${kind}`, {
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

  const copy = KIND_COPY[kind];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <h4 className="mb-1 text-sm font-semibold text-white">{copy.title}</h4>
      <p className="mb-3 text-xs text-gray-500">{copy.hint}</p>

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
              data-testid={`share-${kind}-input`}
              value={link.url}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              data-testid={`share-${kind}-copy`}
              className="shrink-0 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid={`share-${kind}-regenerate`}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? "Gerando..." : "Regenerar"}
            </button>
            <button
              onClick={handleRevoke}
              data-testid={`share-${kind}-revoke`}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Revogar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-400">{copy.emptyText}</p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid={`share-${kind}-generate`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? "Gerando..." : copy.generateLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function ShareLink({ characterId }: { characterId: string }) {
  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-950/60 p-4">
      <h3 className="mb-3 text-lg font-semibold text-white">Compartilhar Personagem</h3>
      <div className="flex flex-col gap-3">
        <ShareLinkSection characterId={characterId} kind="view" />
        <ShareLinkSection characterId={characterId} kind="acquire" />
      </div>
    </div>
  );
}
