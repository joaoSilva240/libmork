"use client";

import React, { useState } from "react";
import {
  FileText,
  Clock,
  User,
  Shield,
  Dices,
  PenTool,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Share2,
  Skull,
} from "lucide-react";
import type { LedgerEvent, LedgerEventType } from "@/lib/systems/missing/types";

export interface MissingSessionLedgerProps {
  events: LedgerEvent[];
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function MissingSessionLedger({
  events = [],
  isLoading = false,
  onRefresh,
  className = "",
}: MissingSessionLedgerProps) {
  const [filterType, setFilterType] = useState<
    "all" | "tests" | "erasures" | "investigation" | "threats"
  >("all");

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
        ev.eventType === "EPIPHANY_DECLARED"
      );
    }
    if (filterType === "threats") {
      return (
        ev.eventType === "THREAT_ADDED" ||
        ev.eventType === "THREAT_REDUCED" ||
        ev.eventType === "THREAT_REMOVED"
      );
    }
    return true;
  });

  const formatTimestamp = (isoString: string) => {
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

  const renderEventDetails = (ev: LedgerEvent) => {
    const payload = ev.payload as Record<string, any>;

    switch (ev.eventType) {
      case "TEST_ROLLED":
      case "TEST_FORCED": {
        const isGain = payload.outcome === "gain";
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                  isGain
                    ? "border-emerald-700 bg-emerald-950/60 text-emerald-400"
                    : "border-rose-700 bg-rose-950/60 text-rose-400"
                }`}
              >
                {isGain ? "GANHO (Sucesso)" : "PERDA (Falha)"}
              </span>
              <span className="text-zinc-300 font-bold">
                {ev.eventType === "TEST_FORCED" ? "Teste Forçado" : "Teste Simples"} (
                {payload.type === "common"
                  ? "Comum 1d6"
                  : payload.type === "probable"
                    ? "Provável 2d6"
                    : "Improvável 2d6"}
                )
              </span>
            </div>
            {payload.details && (
              <p className="text-[11px] text-zinc-400 italic">{payload.details}</p>
            )}
            {payload.equipmentLost && (
              <p className="text-[11px] text-rose-400 font-bold">
                ⚠ Equipamento utilizado foi permanentemente destruído.
              </p>
            )}
          </div>
        );
      }

      case "LINE_ERASED":
        return (
          <div>
            <span className="text-zinc-200 font-bold">
              Linha do Registro #{payload.lineIndex} foi permanentemente rasurada.
            </span>
            {payload.reason && (
              <p className="text-[11px] text-zinc-400 italic mt-0.5">
                Motivo: &ldquo;{payload.reason}&rdquo;
              </p>
            )}
          </div>
        );

      case "EQUIPMENT_LOST":
        return (
          <div>
            <span className="text-rose-400 font-bold">
              Equipamento &ldquo;{payload.equipmentName}&rdquo; foi inutilizado/perdido.
            </span>
            {payload.reason && (
              <p className="text-[11px] text-zinc-400 italic mt-0.5">
                Circunstância: {payload.reason}
              </p>
            )}
          </div>
        );

      case "CLUE_CREATED":
        return (
          <div>
            <span className="text-amber-300 font-bold">
              Nova evidência documentada: &ldquo;{payload.title}&rdquo;
            </span>
            {payload.isFalseClue && (
              <span className="ml-2 text-[10px] bg-red-950 border border-red-800 text-red-400 px-1 py-0.5 font-bold uppercase">
                [Pista Falsa]
              </span>
            )}
          </div>
        );

      case "CLUE_DELIVERED":
        return (
          <div>
            <span className="text-zinc-200">
              Pista entregue{" "}
              {payload.targetHabitantId ? "a habitante específico" : "à mesa (pública)"}.
            </span>
          </div>
        );

      case "CONNECTION_MADE":
        return (
          <div>
            <span className="text-sky-300 font-bold">Conexão traçada ({payload.type}): </span>
            <span className="text-zinc-300 text-[11px]">
              {payload.sourceClueId} ➔ {payload.targetClueId}
            </span>
            {payload.explanation && (
              <p className="text-[11px] text-zinc-400 italic mt-0.5">
                &ldquo;{payload.explanation}&rdquo;
              </p>
            )}
          </div>
        );

      case "EPIPHANY_DECLARED":
        return (
          <div className="space-y-1">
            <span className="text-amber-400 font-black uppercase tracking-wider block">
              ★ MOMENTO DE EPIFANIA (Estágio {payload.stage})
            </span>
            <p className="text-[11px] text-zinc-300">
              Efeito escolhido:{" "}
              <span className="font-bold underline text-amber-200">
                {payload.chosenEffect === "tear_false_clue"
                  ? "A Voz rasga uma pista falsa"
                  : payload.chosenEffect === "answer_question"
                    ? "A Voz responde com total honestidade a uma pergunta"
                    : "A Voz entrega uma nova pista"}
              </span>
            </p>
            {payload.notes && (
              <p className="text-[11px] text-zinc-400 italic">
                Anotações: &ldquo;{payload.notes}&rdquo;
              </p>
            )}
          </div>
        );

      case "THREAT_ADDED":
      case "THREAT_REDUCED":
      case "THREAT_REMOVED":
        return (
          <div>
            <span className="text-rose-300 font-bold">Alteração de Ameaça ({ev.eventType}): </span>
            <span className="text-zinc-300 text-[11px]">
              {payload.threatName || "Ameaça da cena"} (Perigo {payload.dangerLevel ?? "?"})
            </span>
          </div>
        );

      default:
        return <span className="text-zinc-400 text-[11px]">Evento: {ev.eventType}</span>;
    }
  };

  return (
    <div
      className={`rounded-lg bg-[#0d0e12] border border-zinc-800 text-zinc-200 font-mono shadow-2xl p-5 sm:p-7 ${className}`}
      data-testid="missing-session-ledger"
    >
      {/* Cabeçalho Datilografado */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-400" />
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">
              BOLETIM DE OCORRÊNCIAS // LIVRO-RAZÃO DA SESSÃO
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-100 mt-0.5">
            Registro de Fatos
          </h1>
          <p className="text-xs text-zinc-400">
            Arquivo cronológico auditável de todas as ações e consequências narrativas.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xs border border-zinc-700 font-bold cursor-pointer"
            data-testid="btn-recarregar-ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-3 mb-5 text-xs">
        <span className="text-[11px] text-zinc-500 uppercase mr-1">Filtro:</span>
        <button
          type="button"
          onClick={() => setFilterType("all")}
          className={`px-2.5 py-1 rounded-xs cursor-pointer ${
            filterType === "all"
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
          data-testid="filtro-ledger-todos"
        >
          Todos ({events.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("tests")}
          className={`px-2.5 py-1 rounded-xs cursor-pointer ${
            filterType === "tests"
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
          data-testid="filtro-ledger-testes"
        >
          Testes & Rolagens
        </button>
        <button
          type="button"
          onClick={() => setFilterType("erasures")}
          className={`px-2.5 py-1 rounded-xs cursor-pointer ${
            filterType === "erasures"
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
          data-testid="filtro-ledger-rasuras"
        >
          Rasuras & Itens
        </button>
        <button
          type="button"
          onClick={() => setFilterType("investigation")}
          className={`px-2.5 py-1 rounded-xs cursor-pointer ${
            filterType === "investigation"
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
          data-testid="filtro-ledger-investigacao"
        >
          Investigação & Epifanias
        </button>
        <button
          type="button"
          onClick={() => setFilterType("threats")}
          className={`px-2.5 py-1 rounded-xs cursor-pointer ${
            filterType === "threats"
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
          data-testid="filtro-ledger-ameacas"
        >
          Ameaças
        </button>
      </div>

      {/* Lista de Registros */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs italic">
          Nenhum registro encontrado para este filtro.
        </div>
      ) : (
        <div className="space-y-3" data-testid="lista-eventos-ledger">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              data-testid={`evento-ledger-${ev.id}`}
              className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xs space-y-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 border-b border-zinc-900 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(ev.timestamp)}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span
                    className={`font-bold uppercase px-1.5 py-0.2 rounded-xs ${
                      ev.actorRole === "voice"
                        ? "bg-red-950/80 text-red-400 border border-red-800"
                        : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {ev.actorRole === "voice" ? "A Voz" : "Redator"}
                  </span>
                </div>
                <span className="uppercase tracking-widest text-[9px] text-zinc-600">
                  {ev.eventType}
                </span>
              </div>

              {/* Detalhes específicos do evento */}
              <div className="text-xs">{renderEventDetails(ev)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
