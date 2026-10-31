"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  PenTool,
  Sparkles,
  Link2,
  Trash2,
  HelpCircle,
} from "lucide-react";
import type { LedgerEvent } from "@/lib/systems/missing/types";
import { useSocket } from "@/context/SocketContext";
import { ResizeHandle } from "@/components/ui";
import { useResizableLayout } from "@/hooks/useResizableLayout";

export interface MissingSessionLogProps {
  campaignId: string;
  className?: string;
}

export function MissingSessionLog({ campaignId, className = "" }: MissingSessionLogProps) {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<
    "all" | "tests" | "erasures" | "investigation"
  >("all");

  const { isConnected, subscribeCampaignLogCreated, subscribeCampaignLogUpdated } = useSocket();
  const wasConnectedRef = useRef(isConnected);

  const missingSessionLogPanel = useResizableLayout({
    storageKey: campaignId ? `libmork:missing-session-log:${campaignId}` : undefined,
    initialHeight: 400,
    minHeight: 200,
    maxHeight: 800,
  });

  const fetchLedger = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/systems/missing/campaigns/${campaignId}/ledger`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setEvents(data.data as LedgerEvent[]);
        setError(null);
      } else {
        setError(data.error || "Erro ao carregar livro-razão");
      }
    } catch {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [campaignId]);

  // Carregamento inicial e polling suave a cada 5 segundos
  useEffect(() => {
    void fetchLedger();

    const intervalId = setInterval(() => {
      void fetchLedger();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchLedger]);

  // Escuta WebSocket
  useEffect(() => {
    const unsubCreated =
      typeof subscribeCampaignLogCreated === "function"
        ? subscribeCampaignLogCreated((payload) => {
            if (payload.campaignId === campaignId) {
              void fetchLedger();
            }
          })
        : () => {};

    const unsubUpdated =
      typeof subscribeCampaignLogUpdated === "function"
        ? subscribeCampaignLogUpdated((payload) => {
            if (payload.campaignId === campaignId) {
              void fetchLedger();
            }
          })
        : () => {};

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, [campaignId, fetchLedger, subscribeCampaignLogCreated, subscribeCampaignLogUpdated]);

  // Reconexão Socket
  useEffect(() => {
    if (!wasConnectedRef.current && isConnected) {
      void fetchLedger();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, fetchLedger]);

  const filteredEvents = events.filter((ev) => {
    if (filterType === "all") return true;
    if (filterType === "tests") {
      return ev.eventType === "TEST_ROLLED" || ev.eventType === "TEST_FORCED";
    }
    if (filterType === "erasures") {
      return ev.eventType === "LINE_ERASED" || ev.eventType === "EQUIPMENT_LOST";
    }
    if (filterType === "investigation") {
      return (
        ev.eventType === "CLUE_CREATED" ||
        ev.eventType === "CLUE_DELIVERED" ||
        ev.eventType === "CONNECTION_MADE" ||
        ev.eventType === "EPIPHANY_DECLARED" ||
        ev.eventType === "THREAT_ADDED" ||
        ev.eventType === "THREAT_REDUCED" ||
        ev.eventType === "THREAT_REMOVED"
      );
    }
    return true;
  });

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });
  }, [filteredEvents]);

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const renderEventContent = (ev: LedgerEvent) => {
    const payload = (ev.payload || {}) as Record<string, any>;

    switch (ev.eventType) {
      case "TEST_ROLLED":
      case "TEST_FORCED": {
        const isGain = payload.outcome === "gain";
        const habitantName = payload.habitantName || "Habitante";
        const testTypeLabel =
          payload.type === "common"
            ? "Comum (1d6)"
            : payload.type === "probable"
              ? "Provável (2d6)"
              : "Improvável (2d6)";

        return (
          <div className="space-y-1.5" data-testid={`log-test-${ev.id}`}>
            {/* Linha do Habitante e Status */}
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-zinc-800/80 pb-1">
              <span className="font-bold text-zinc-100 uppercase tracking-wide text-[11px]">
                {habitantName}
              </span>
              <span
                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                  isGain
                    ? "border-emerald-700 bg-emerald-950/80 text-emerald-300"
                    : "border-rose-700 bg-rose-950/80 text-rose-300"
                }`}
              >
                {isGain ? "GANHO (Sucesso)" : "PERDA (Falha)"}
              </span>
            </div>

            {/* Tipo de Teste e Total Efetivo */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">
                {ev.eventType === "TEST_FORCED" ? "Teste Forçado" : "Teste"}: {testTypeLabel}
              </span>
              {typeof payload.effectiveTotal === "number" && (
                <span className="font-bold text-amber-300 bg-zinc-900 px-1 rounded border border-zinc-800">
                  Total: {payload.effectiveTotal}
                </span>
              )}
            </div>

            {/* Dados Rolados */}
            {Array.isArray(payload.dice) && payload.dice.length > 0 && (
              <p className="text-[10px] text-zinc-400">
                Dados rolados: <span className="font-semibold text-zinc-200">[{payload.dice.join(", ")}]</span>
                {payload.forcedDie && (
                  <span> + Dado Forçado: <strong className="text-amber-400">[{payload.forcedDie}]</strong></span>
                )}
              </p>
            )}

            {/* O que foi utilizado */}
            <div className="space-y-0.5 pt-0.5 text-[11px]">
              {payload.quotedLine && (
                <p className="text-amber-200/90 italic bg-amber-950/20 border-l-2 border-amber-600 pl-1.5 py-0.5">
                  Memória invocada: &ldquo;{payload.quotedLine}&rdquo;
                </p>
              )}

              {Boolean(payload.supportGains || payload.supportBonus) && (
                <p className="text-sky-300 font-medium">
                  Apoio recebido: +{payload.supportGains || payload.supportBonus}
                </p>
              )}

              {payload.equipmentName && (
                <p className="text-rose-300 font-medium">
                  Equipamento arriscado: &ldquo;{payload.equipmentName}&rdquo;
                </p>
              )}
            </div>

            {/* Equipamento Destruído / Perdido */}
            {payload.equipmentLost && (
              <div className="rounded bg-rose-950/90 border border-rose-800 px-2 py-1 text-[10px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
                <span>EQUIPAMENTO DESTRUÍDO</span>
              </div>
            )}

            {/* Detalhes / Rasuras causadas */}
            {payload.erasuresCount > 0 && !isGain && (
              <p className="text-[10px] text-rose-400/90 font-semibold">
                ⚠ Rasuras provocadas pelo horror: {payload.erasuresCount}
              </p>
            )}

            {payload.details && (
              <p className="text-[10px] text-zinc-500 italic">{payload.details}</p>
            )}
          </div>
        );
      }

      case "LINE_ERASED": {
        const habitantName = payload.habitantName || "Habitante";
        const lineIdx = typeof payload.lineIndex === "number" ? payload.lineIndex + 1 : "?";

        return (
          <div className="space-y-1" data-testid={`log-erase-${ev.id}`}>
            <div className="flex items-center gap-1.5 text-zinc-200">
              <PenTool className="h-3 w-3 text-rose-400 shrink-0" />
              <span className="font-bold text-[11px]">
                Linha #{lineIdx} rasurada no registro de {habitantName}
              </span>
            </div>

            {payload.lineText && (
              <p className="text-[11px] text-zinc-500 line-through italic pl-4">
                &ldquo;{payload.lineText}&rdquo;
              </p>
            )}

            {payload.reason && (
              <p className="text-[10px] text-zinc-400 pl-4">
                Motivo: &ldquo;{payload.reason}&rdquo;
              </p>
            )}

            {payload.disappeared && (
              <div className="mt-1 inline-block rounded bg-rose-950 border border-rose-800 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-300 tracking-wider">
                SUJEITO DESAPARECIDO NO HORROR
              </div>
            )}
          </div>
        );
      }

      case "EQUIPMENT_LOST": {
        const eqName = payload.equipmentName || "Item";

        return (
          <div className="space-y-1" data-testid={`log-lost-${ev.id}`}>
            <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
              <Trash2 className="h-3 w-3 text-rose-400 shrink-0" />
              <span>Equipamento &ldquo;{eqName}&rdquo; inutilizado permanentemente</span>
            </div>

            {payload.reason && (
              <p className="text-[10px] text-zinc-400 pl-4 italic">
                Motivo: {payload.reason}
              </p>
            )}
          </div>
        );
      }

      case "CLUE_CREATED":
        return (
          <div className="space-y-0.5" data-testid={`log-clue-${ev.id}`}>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300 text-[11px]">
                Nova evidência: &ldquo;{payload.title}&rdquo;
              </span>
              {payload.isFalseClue && (
                <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-800 px-1 py-0.2 rounded uppercase font-bold">
                  [Pista Falsa]
                </span>
              )}
            </div>
            {payload.description && (
              <p className="text-[10px] text-zinc-400 pl-4 line-clamp-2">{payload.description}</p>
            )}
          </div>
        );

      case "CLUE_DELIVERED":
        return (
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
            <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
            <span>
              Pista entregue {payload.targetHabitantId ? "a habitante específico" : "à mesa pública"}.
            </span>
          </div>
        );

      case "CONNECTION_MADE":
        return (
          <div className="space-y-0.5 text-[11px]">
            <div className="flex items-center gap-1.5 text-sky-300 font-bold">
              <Link2 className="h-3 w-3 text-sky-400 shrink-0" />
              <span>Conexão traçada ({payload.type || "hipótese"})</span>
            </div>
            {payload.explanation && (
              <p className="text-[10px] text-zinc-400 italic pl-4">
                &ldquo;{payload.explanation}&rdquo;
              </p>
            )}
          </div>
        );

      case "EPIPHANY_DECLARED":
        return (
          <div className="space-y-1 bg-amber-950/20 border border-amber-900/50 p-1.5 rounded">
            <span className="text-amber-400 font-black uppercase text-[10px] tracking-wider block">
              ★ MOMENTO DE EPIFANIA
            </span>
            <p className="text-[11px] text-zinc-200">
              Efeito:{" "}
              <span className="font-bold text-amber-200">
                {payload.chosenEffect === "tear_false_clue"
                  ? "A Voz rasga uma pista falsa"
                  : payload.chosenEffect === "answer_question"
                    ? "A Voz responde com total honestidade a uma pergunta"
                    : "A Voz entrega uma nova pista"}
              </span>
            </p>
            {payload.notes && (
              <p className="text-[10px] text-zinc-400 italic">
                Nota: &ldquo;{payload.notes}&rdquo;
              </p>
            )}
          </div>
        );

      case "THREAT_ADDED":
      case "THREAT_REDUCED":
      case "THREAT_REMOVED":
        return (
          <div className="text-[11px] text-zinc-300 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
            <span>
              Ameaça ({ev.eventType === "THREAT_ADDED" ? "+Nova" : "Alterada"}):{" "}
              <strong>{payload.threatName || "Ameaça"}</strong> (Perigo {payload.dangerLevel ?? "?"})
            </span>
          </div>
        );

      default:
        return (
          <div className="text-[10px] text-zinc-400">
            Registro: {ev.eventType}
          </div>
        );
    }
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0d10] font-mono text-zinc-200 shadow-xl ${className}`}
      style={{ height: `${missingSessionLogPanel.height}px` }}
      data-testid="missing-session-log"
    >
      {/* Cabeçalho de Dossiê */}
      <div className="border-b border-zinc-800/90 bg-zinc-950/90 p-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-100 truncate">
                BOLETIM DE OCORRÊNCIAS
              </h2>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest truncate">
              // DIÁRIO DE INVESTIGAÇÃO
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
              title={isConnected ? "Ao vivo via WebSocket" : "Sincronizando via Polling"}
            />
            <button
              type="button"
              onClick={() => void fetchLedger(true)}
              disabled={isLoading || isRefreshing}
              aria-label="Recarregar livro-razão"
              title="Recarregar livro-razão"
              className="rounded border border-zinc-800 bg-zinc-900 p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
              data-testid="btn-refresh-missing-log"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading || isRefreshing ? "animate-spin text-rose-400" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Filtros em abas compactas */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto text-[10px] scrollbar-hide">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
              filterType === "all"
                ? "bg-rose-950 text-rose-300 font-bold border border-rose-800"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
            }`}
          >
            Todos ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("tests")}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
              filterType === "tests"
                ? "bg-rose-950 text-rose-300 font-bold border border-rose-800"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
            }`}
          >
            Testes
          </button>
          <button
            type="button"
            onClick={() => setFilterType("erasures")}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
              filterType === "erasures"
                ? "bg-rose-950 text-rose-300 font-bold border border-rose-800"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
            }`}
          >
            Rasuras
          </button>
          <button
            type="button"
            onClick={() => setFilterType("investigation")}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
              filterType === "investigation"
                ? "bg-rose-950 text-rose-300 font-bold border border-rose-800"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
            }`}
          >
            Pistas
          </button>
        </div>
      </div>

      {/* Lista de Registros */}
      <div
        className="flex-1 min-h-0 space-y-2 overflow-y-auto p-2"
        data-testid="missing-session-log-list"
      >
        {error && (
          <div className="rounded border border-rose-900/60 bg-rose-950/30 p-2 text-[11px] text-rose-400">
            {error}
          </div>
        )}

        {isLoading && events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
            <RefreshCw className="h-4 w-4 animate-spin text-rose-400 mr-2" />
            <span>Consultando arquivos...</span>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center p-3 text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded">
            <FileText className="h-5 w-5 mb-1 text-zinc-600" />
            <p>Nenhuma ocorrência registrada neste arquivo.</p>
          </div>
        ) : (
          sortedEvents.map((ev) => (
            <div
              key={ev.id}
              className="rounded border border-zinc-800/80 bg-zinc-950/90 p-2 shadow-xs transition-colors hover:border-zinc-700"
            >
              {renderEventContent(ev)}
              <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-600 pt-1 border-t border-zinc-900">
                <span className="uppercase tracking-wider">
                  {ev.actorRole === "voice" ? "[A VOZ]" : "[ESCRITOR]"}
                </span>
                <span>{formatTime(ev.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <ResizeHandle
        direction="vertical"
        onResize={(_, dy) => missingSessionLogPanel.handleResize(0, dy)}
        title="Redimensionar boletim de ocorrências"
        data-testid="resize-missing-session-log"
      />
    </div>
  );
}
