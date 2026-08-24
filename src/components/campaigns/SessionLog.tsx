"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignLog } from "@/types";

const POLL_INTERVAL_MS = 4000;

type SessionLogProps = {
  campaignId: string;
};

export function SessionLog({ campaignId }: SessionLogProps) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollInputs, setRollInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/logs?limit=100`, {
        credentials: "include"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar logs");
        return;
      }

      setLogs(data.data);
      setError(null);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/logs?limit=100`, {
          credentials: "include"
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar logs");
          return;
        }

        setLogs(data.data);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    timerRef.current = setInterval(() => {
      void loadLogs();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [campaignId, loadLogs]);

  const submitRollResult = async (logId: string) => {
    const raw = rollInputs[logId];
    const result = Number(raw);

    if (raw === "" || Number.isNaN(result)) {
      return;
    }

    setSubmittingId(logId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/rolls/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao registrar resultado");
        return;
      }

      setRollInputs((prev) => ({ ...prev, [logId]: "" }));
      await loadLogs();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmittingId(null);
    }
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const toneFor = (action: string): string => {
    switch (action) {
      case "hp_change":
        return "text-red-300";
      case "mana_change":
        return "text-blue-300";
      case "xp_gain":
      case "level_up":
        return "text-green-300";
      case "roll_request":
      case "roll_result":
        return "text-amber-300";
      case "condition_add":
      case "condition_remove":
        return "text-purple-300";
      case "npc_include":
      case "npc_remove":
        return "text-gray-300";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 p-2">
        <h2 className="text-sm font-bold text-white">Log da Sessão</h2>
      </div>

      <div className="max-h-[70vh] flex-1 space-y-1.5 overflow-y-auto p-2">
        {isLoading && logs.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum evento ainda. Rolagens, dano e XP aparecerão aqui.
          </p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-gray-800 bg-gray-950 p-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${toneFor(log.action)}`}>
                  {log.actorName && log.actorType !== "system" ? (
                    <span className="font-semibold">{log.actorName}: </span>
                  ) : null}
                  {log.description ?? log.action}
                </p>
                <span className="shrink-0 text-[10px] text-gray-600">
                  {formatTime(log.createdAt as unknown as string)}
                </span>
              </div>

              {log.action === "roll_request" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Resultado do dado"
                    value={rollInputs[log.id] ?? ""}
                    onChange={(e) =>
                      setRollInputs((prev) => ({ ...prev, [log.id]: e.target.value }))
                    }
                    disabled={submittingId === log.id}
                    className="w-28 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                  <button
                    onClick={() => submitRollResult(log.id)}
                    disabled={submittingId === log.id}
                    className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {submittingId === log.id ? "..." : "Registrar resultado"}
                  </button>
                </div>
              )}

              {log.action === "roll_result" &&
                typeof (log.payload as { result?: number }).result === "number" && (
                  <p className="mt-1 text-sm font-bold text-amber-300">
                    Resultado: {(log.payload as { result: number }).result}
                  </p>
                )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-gray-800 p-2 text-xs text-red-400">{error}</div>
      )}
    </div>
  );
}
