"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Droplet, Droplets, HeartCrack, HeartPulse, Shield, User } from "lucide-react";
import type { CampaignLog } from "@/types";
import { ResizeHandle, Spinner } from "@/components/ui";
import { useSocket, type RollDataPayload } from "@/context/SocketContext";
import { useResizableLayout } from "@/hooks/useResizableLayout";

type SessionLogProps = {
  campaignId: string;
  showDiceRolls?: boolean;
};

type StreamItem =
  | { kind: "log"; at: number; log: CampaignLog }
  | { kind: "roll"; at: number; roll: RollDataPayload };

type LogFilter = "all" | "impact" | "conditions" | "rolls" | "others";

const FILTER_TABS: { id: LogFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "impact", label: "Dano e Mana" },
  { id: "conditions", label: "Condição" },
  { id: "rolls", label: "Rolagens" },
  { id: "others", label: "Outros" },
];

const timeOf = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

function filterForAction(action: string): Exclude<LogFilter, "all"> {
  if (action === "hp_change" || action === "mana_change") return "impact";
  if (action === "condition_add" || action === "condition_remove") return "conditions";
  if (action === "roll_request" || action === "roll_result") return "rolls";
  return "others";
}

function payloadOf(log: CampaignLog): Record<string, unknown> {
  return (log.payload ?? {}) as Record<string, unknown>;
}

/** Delta de HP/Mana: usa o `delta` gravado ou deduz de `from → to` (valor absoluto). */
function deltaOf(payload: Record<string, unknown>): number | null {
  if (typeof payload.delta === "number") return payload.delta;
  if (typeof payload.from === "number" && typeof payload.to === "number") {
    return payload.to - payload.from;
  }
  return null;
}

function impactOf(log: CampaignLog): { kind: "hp" | "mana"; delta: number } | null {
  if (log.action !== "hp_change" && log.action !== "mana_change") return null;
  const delta = deltaOf(payloadOf(log));
  if (delta === null || delta === 0) return null;
  return { kind: log.action === "hp_change" ? "hp" : "mana", delta };
}

/** Lados do dado em uma expressão de rolagem (`1d20+3` → 20, `2d6` → 6). */
function dieSidesOf(rollExpression: unknown): number | null {
  if (typeof rollExpression !== "string") return null;
  const sides = Number(/d(\d+)/i.exec(rollExpression)?.[1]);
  return Number.isFinite(sides) && sides > 0 ? sides : null;
}

/** Isola o nome da condição da frase, para que ele seja renderizado como chip. */
function splitConditionName(
  description: string,
  conditionName: unknown,
): { before: string; name: string | null; after: string } {
  const known =
    typeof conditionName === "string" && description.includes(conditionName) ? conditionName : null;

  if (known) {
    const index = description.indexOf(known);
    return {
      before: description.slice(0, index),
      name: known,
      after: description.slice(index + known.length),
    };
  }

  const quoted = /"([^"]+)"/.exec(description);
  if (quoted) {
    return {
      before: description.slice(0, quoted.index),
      name: quoted[1],
      after: description.slice(quoted.index + quoted[0].length),
    };
  }

  return { before: description, name: null, after: "" };
}

function ActorAvatar({
  actorType,
  actorName,
  imageUrl,
}: {
  actorType: CampaignLog["actorType"];
  actorName: string | null;
  imageUrl?: string | null;
}) {
  const frame =
    "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-gray-800";

  if (actorType === "system") {
    return (
      <div className={frame} title="Sistema" data-testid="log-avatar-system">
        <Shield className="h-3.5 w-3.5 text-accent" />
      </div>
    );
  }

  if (typeof imageUrl === "string" && imageUrl.length > 0) {
    return (
      <div className={frame} data-testid="log-avatar-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={actorName ?? ""} className="h-full w-full object-cover" />
      </div>
    );
  }

  if (actorName) {
    return (
      <div className={frame} title={actorName} data-testid="log-avatar-initial">
        <span className="text-xs font-bold text-gray-300">{actorName.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={frame} title="Sem autor" data-testid="log-avatar-unknown">
      <User className="h-3.5 w-3.5 text-gray-400" />
    </div>
  );
}

function StatBadge({ kind, delta }: { kind: "hp" | "mana"; delta: number }) {
  const isLoss = delta < 0;
  const Icon = kind === "hp" ? (isLoss ? HeartCrack : HeartPulse) : isLoss ? Droplet : Droplets;

  const tone = isLoss
    ? kind === "hp"
      ? "border-red-700 bg-red-950/80 text-red-300"
      : "border-blue-700 bg-blue-950/80 text-blue-300"
    : "border-emerald-800 bg-emerald-950/60 text-emerald-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tone}`}
      data-testid={`${kind}-badge`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {delta > 0 ? "+" : ""}
      {delta} {kind === "hp" ? "HP" : "MP"}
    </span>
  );
}

function ConditionChip({ name }: { name: string }) {
  return (
    <span
      className="mx-0.5 inline-block rounded-full border border-purple-400/60 bg-purple-950/80 px-2 py-0.5 text-[11px] font-bold text-purple-200"
      data-testid="condition-chip"
    >
      {name}
    </span>
  );
}

/** Silhueta do dado: quadrado arredondado para d6, hexágono facetado para os demais. */
function DieGlyph({ sides, value }: { sides: number | null; value: number | null }) {
  return (
    <div className="relative h-11 w-11 shrink-0 text-amber-400" data-testid="die-glyph">
      <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden="true">
        {sides === 6 ? (
          <rect
            x="6"
            y="6"
            width="32"
            height="32"
            rx="7"
            className="fill-amber-500/10 stroke-current"
            strokeWidth="2"
          />
        ) : (
          <>
            <path
              d="M22 3 39 12.5V31.5L22 41 5 31.5V12.5Z"
              className="fill-amber-500/10 stroke-current"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M22 9 32 27H12Z"
              className="fill-none stroke-current"
              strokeWidth="1"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </>
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-black text-amber-200"
        data-testid="die-value"
      >
        {value ?? "?"}
      </span>
    </div>
  );
}

export function SessionLog({ campaignId, showDiceRolls = true }: SessionLogProps) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [liveRolls, setLiveRolls] = useState<RollDataPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollInputs, setRollInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");

  const {
    subscribeCampaignLogCreated,
    subscribeCampaignLogUpdated,
    broadcastCampaignLogUpdate,
    subscribeDiceRoll,
    isConnected,
  } = useSocket();

  const wasConnectedRef = useRef(isConnected);

  const sessionLogPanel = useResizableLayout({
    storageKey: campaignId ? `libmork:session-log:${campaignId}` : undefined,
    initialHeight: 400,
    minHeight: 200,
    maxHeight: 800,
  });

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/logs?limit=100`, {
        credentials: "include",
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

  // Carregamento REST inicial e subscrições Socket.IO
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();

    const unsubscribeCreated = subscribeCampaignLogCreated((payload) => {
      if (payload.campaignId !== campaignId || !payload.log) return;
      setLogs((prev) => {
        // Deduplicação estrita por id
        if (prev.some((item) => item.id === payload.log.id)) {
          return prev;
        }
        // Insere no início (mais recente) e limita em 100
        return [payload.log, ...prev].slice(0, 100);
      });
    });

    const unsubscribeUpdated = subscribeCampaignLogUpdated((payload) => {
      if (payload.campaignId !== campaignId || !payload.log) return;
      setLogs((prev) => prev.map((item) => (item.id === payload.log.id ? payload.log : item)));
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [campaignId, loadLogs, subscribeCampaignLogCreated, subscribeCampaignLogUpdated]);

  // Reconciliação automática quando isConnected muda de false para true
  useEffect(() => {
    if (!wasConnectedRef.current && isConnected) {
      void loadLogs();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, loadLogs]);

  // Rolagens ao vivo do Socket entram na mesma linha do tempo do log
  useEffect(() => {
    if (!showDiceRolls) return;

    const unsubscribeRoll = subscribeDiceRoll((roll) => {
      if (roll.campaignId !== campaignId) return;
      const stamped = { ...roll, timestamp: roll.timestamp ?? new Date().toISOString() };
      setLiveRolls((prev) => [stamped, ...prev].slice(0, 100));
    });

    return () => unsubscribeRoll();
  }, [campaignId, showDiceRolls, subscribeDiceRoll]);

  const stream = useMemo<StreamItem[]>(() => {
    const items: StreamItem[] = logs.map((log) => ({
      kind: "log",
      at: timeOf(String(log.createdAt)),
      log,
    }));
    if (showDiceRolls) {
      liveRolls.forEach((roll) =>
        items.push({ kind: "roll", at: timeOf(roll.timestamp ?? ""), roll }),
      );
    }
    return items.sort((a, b) => b.at - a.at);
  }, [logs, liveRolls, showDiceRolls]);

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
      setLogs((prev) => prev.map((item) => (item.id === logId ? data.data : item)));
      broadcastCampaignLogUpdate({ campaignId, log: data.data });
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

  const filterCounts = useMemo(() => {
    const counts: Record<LogFilter, number> = {
      all: stream.length,
      impact: 0,
      conditions: 0,
      rolls: 0,
      others: 0,
    };
    for (const item of stream) {
      counts[item.kind === "roll" ? "rolls" : filterForAction(item.log.action)] += 1;
    }
    return counts;
  }, [stream]);

  const visibleStream = useMemo(
    () =>
      filter === "all"
        ? stream
        : stream.filter((item) =>
            item.kind === "roll" ? filter === "rolls" : filterForAction(item.log.action) === filter,
          ),
    [filter, stream],
  );

  const renderLiveRoll = (roll: RollDataPayload, key: string) => (
    <div
      key={key}
      data-testid="session-log-roll"
      className="rounded-lg border border-gray-800 bg-gray-950 p-2"
    >
      <div className="flex items-start gap-2">
        <ActorAvatar actorType="character" actorName={roll.actorName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-amber-300">
              <span className="font-semibold">{roll.actorName}: </span>
              <span className="text-[10px] uppercase tracking-wide text-purple-300">
                {roll.rollType}
              </span>
              {roll.isManual && (
                <span className="ml-1 text-[10px] font-semibold text-amber-400">[Físico]</span>
              )}
            </p>
            <span className="shrink-0 text-[10px] text-gray-600">
              {formatTime(roll.timestamp ?? "")}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <DieGlyph sides={dieSidesOf(roll.formula)} value={roll.result} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400/90">
                {roll.formula}
              </p>
              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-gray-500">
                <span className="flex shrink-0 items-center gap-1 rounded bg-purple-950/70 px-1 text-purple-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
                  ao vivo
                </span>
                {roll.diceDetail && <span className="truncate">{roll.diceDetail}</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogCard = (log: CampaignLog) => {
    const payload = payloadOf(log);
    const impact = impactOf(log);
    const isRoll = log.action === "roll_request" || log.action === "roll_result";
    const description = log.description ?? log.action;
    const condition =
      log.action === "condition_add" || log.action === "condition_remove"
        ? splitConditionName(description, payload.conditionName)
        : null;
    const result = typeof payload.result === "number" ? payload.result : null;
    const imageUrl = payload.actorImageUrl;

    return (
      <div
        key={log.id}
        data-testid="session-log-entry"
        className={`rounded-lg border bg-gray-950 p-2 ${
          impact?.kind === "hp" && impact.delta < 0 ? "border-red-800/80" : "border-gray-800"
        }`}
      >
        <div className="flex items-start gap-2">
          <ActorAvatar
            actorType={log.actorType}
            actorName={log.actorName}
            imageUrl={typeof imageUrl === "string" ? imageUrl : null}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm ${toneFor(log.action)}`}>
                {log.actorName && log.actorType !== "system" ? (
                  <span className="font-semibold">{log.actorName}: </span>
                ) : null}
                {condition?.name ? (
                  <>
                    {condition.before}
                    <ConditionChip name={condition.name} />
                    {condition.after}
                  </>
                ) : (
                  description
                )}
              </p>
              <span className="shrink-0 text-[10px] text-gray-600">
                {formatTime(log.createdAt as unknown as string)}
              </span>
            </div>

            {impact && impact.delta < 0 && (
              <div className="mt-1.5">
                <StatBadge kind={impact.kind} delta={impact.delta} />
              </div>
            )}

            {isRoll && (
              <div className="mt-1.5 flex items-center gap-2">
                <DieGlyph
                  sides={dieSidesOf(payload.rollExpression)}
                  value={log.action === "roll_result" ? result : null}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400/90">
                    {typeof payload.rollExpression === "string"
                      ? payload.rollExpression
                      : "Rolagem"}
                  </p>

                  {log.action === "roll_request" && (
                    <div className="mt-1 flex items-center gap-2">
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
                        onClick={() => void submitRollResult(log.id)}
                        disabled={submittingId === log.id}
                        className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {submittingId === log.id ? "..." : "Registrar resultado"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="relative flex flex-col rounded-lg border border-gray-800 bg-gray-900 overflow-hidden"
      style={{ height: `${sessionLogPanel.height}px` }}
    >
      <div className="shrink-0 border-b border-gray-800">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Log da Sessão</h2>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
              title={isConnected ? "Conectado via WebSocket" : "Desconectado do WebSocket"}
            />
          </div>
          <button
            onClick={() => void loadLogs()}
            disabled={isLoading}
            aria-label="Recarregar logs"
            title="Recarregar logs"
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50 transition-colors"
          >
            <span className={isLoading ? "inline-block animate-spin" : "inline-block"}>⟳</span>
          </button>
        </div>

        {/* Filtros por categoria, no padrão de abas do Boletim de Ocorrências */}
        <div className="flex items-center gap-1 overflow-x-auto px-2 pb-2 text-[10px]">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 cursor-pointer rounded px-2 py-0.5 transition-colors ${
                filter === tab.id
                  ? "bg-accent font-bold text-white"
                  : "border border-gray-800 bg-gray-800/60 text-gray-400 hover:text-white"
              }`}
              data-testid={`filter-${tab.id}`}
            >
              {tab.label} ({filterCounts[tab.id]})
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[70vh] flex-1 space-y-1.5 overflow-y-auto p-2">
        {isLoading && stream.length === 0 ? (
          <div className="flex items-center justify-center min-h-[150px]">
            <Spinner size="md" />
          </div>
        ) : stream.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum evento ainda. Rolagens, dano e XP aparecerão aqui.
          </p>
        ) : visibleStream.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento neste filtro.</p>
        ) : (
          visibleStream.map((item, idx) =>
            item.kind === "roll"
              ? renderLiveRoll(item.roll, `roll-${item.at}-${idx}`)
              : renderLogCard(item.log),
          )
        )}
      </div>

      {error && <div className="border-t border-gray-800 p-2 text-xs text-red-400">{error}</div>}

      <ResizeHandle
        direction="vertical"
        onResize={(_, dy) => sessionLogPanel.handleResize(0, dy)}
        title="Redimensionar log da sessão"
        data-testid="resize-session-log"
      />
    </div>
  );
}
