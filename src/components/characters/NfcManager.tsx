"use client";

import { useEffect, useState } from "react";

type NfcTag = {
  id: string;
  characterId: string | null;
  ndefUrl: string;
  active: boolean;
  createdAt: string;
};

export function NfcManager({ characterId }: { characterId: string }) {
  const [tag, setTag] = useState<NfcTag | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}/nfc`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar NFC");
          return;
        }

        setTag(data.data);
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

  const handleAssociate = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/nfc`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao associar NFC");
        return;
      }

      setTag(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Revogar a associação NFC? A etiqueta deixará de funcionar.")) {
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/nfc`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao revogar NFC");
        return;
      }

      setTag(null);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!tag) return;
    try {
      await navigator.clipboard.writeText(tag.ndefUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-3 text-lg font-semibold text-white">NFC</h3>

      {error && (
        <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {tag ? (
        <div>
          <p className="mb-2 text-sm text-gray-400">
            Gravar esta URL NDEF na etiqueta NFC:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={tag.ndefUrl}
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
            Ao encostar o celular na etiqueta, o personagem é desbloqueado
            automaticamente (RF-022).
          </p>
          <div className="mt-3">
            <button
              onClick={handleRevoke}
              disabled={isBusy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Revogar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-400">
            Associe uma etiqueta NFC para desbloquear o personagem com um toque.
          </p>
          <button
            onClick={handleAssociate}
            disabled={isBusy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isBusy ? "Associando..." : "Associar Etiqueta"}
          </button>
        </div>
      )}
    </div>
  );
}
