"use client";

import { useState } from "react";

export type RosterCondition = {
  junctionId: string;
  conditionId: string;
  conditionName: string;
  permanent: boolean;
};

export type RosterPlayer = {
  id: string;
  name: string;
  imageUrl: string | null;
  level: number;
  xp: number;
  hitPointsCurrent: number;
  hitPointsMax: number;
  manaPointsCurrent: number;
  manaPointsMax: number;
  conditions: RosterCondition[];
};

export type RosterActor = {
  kind: "character" | "npc";
  id: string;
  name: string;
  imageUrl: string | null;
  level: number;
  xp: number;
  hitPoints: number;
  hitPointsMax: number;
  manaPoints: number;
  manaPointsMax: number;
  npcType?: string;
  xpReward?: number;
  conditions?: RosterCondition[];
};

type ConditionOption = { id: string; name: string };
type Panel = "roll" | "modify" | "xp";

const ROLL_QUICK = ["1d20", "2d20", "1d6", "1d8", "1d10", "1d12", "2d6", "3d6"];
const DELTA_QUICK = [-10, -5, -1, 1, 5, 10];
const XP_QUICK = [10, 25, 50, 100];

type ActorOverlayProps = {
  campaignId: string;
  actor: RosterActor;
  onClose: () => void;
  onChanged: () => void;
};

export function ActorOverlay({ campaignId, actor, onClose, onChanged }: ActorOverlayProps) {
  const [panel, setPanel] = useState<Panel>("roll");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rollExpression, setRollExpression] = useState("1d20");
  const [rollReason, setRollReason] = useState("");
  const [hpDelta, setHpDelta] = useState("");
  const [manaDelta, setManaDelta] = useState("");
  const [modifyReason, setModifyReason] = useState("");
  const [conditionOptions, setConditionOptions] = useState<ConditionOption[]>([]);
  const [conditionsLoaded, setConditionsLoaded] = useState(false);
  const [xpAmount, setXpAmount] = useState("25");
  const [xpReason, setXpReason] = useState("");

  const loadConditions = async () => {
    if (conditionsLoaded || actor.kind !== "character") return;

    try {
      // O endpoint da campanha já retorna global + privado (RF-018)
      const campaignResponse = await fetch(
        `/api/campaigns/${campaignId}/content/conditions`
      );
      const campaignData = await campaignResponse.json();
      const merged: ConditionOption[] = [];

      if (campaignResponse.ok) {
        merged.push(
          ...(campaignData.data as ConditionOption[]).map((condition) => ({
            id: condition.id,
            name: condition.name,
          }))
        );
      }

      setConditionOptions(merged);
    } catch {
      // condições são opcionais no overlay
    } finally {
      setConditionsLoaded(true);
    }
  };

  const switchPanel = (next: Panel) => {
    setPanel(next);
    setError(null);
    setSuccess(null);
    if (next === "modify") {
      void loadConditions();
    }
  };

  const requestRoll = async () => {
    setError(null);
    setSuccess(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorType: actor.kind,
          actorId: actor.id,
          actorName: actor.name,
          rollExpression,
          reason: rollReason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao exigir rolagem");
        return;
      }

      setSuccess(`Rolagem ${rollExpression} exigida de ${actor.name} e registrada no log.`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const actorEndpoint = () =>
    actor.kind === "character"
      ? `/api/campaigns/${campaignId}/roster/characters/${actor.id}`
      : `/api/campaigns/${campaignId}/npcs/${actor.id}/session`;

  const applyModification = async () => {
    const payload: Record<string, unknown> = {};
    const hp = Number(hpDelta);
    const mana = Number(manaDelta);

    if (hpDelta !== "" && !Number.isNaN(hp) && hp !== 0) {
      payload.hpDelta = hp;
    }
    if (manaDelta !== "" && !Number.isNaN(mana) && mana !== 0) {
      payload.manaDelta = mana;
    }
    if (modifyReason) {
      payload.reason = modifyReason;
    }

    if (Object.keys(payload).length === 0) {
      setError("Informe pelo menos uma alteração de HP ou Mana.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsBusy(true);

    try {
      const response = await fetch(actorEndpoint(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao modificar elementos");
        return;
      }

      setHpDelta("");
      setManaDelta("");
      setModifyReason("");
      setSuccess(`Elementos de ${actor.name} atualizados.`);
      onChanged();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleCondition = async (conditionId: string, currentlyApplied: boolean) => {
    setError(null);
    setSuccess(null);
    setIsBusy(true);

    try {
      const response = await fetch(actorEndpoint(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentlyApplied
            ? { conditionsRemove: [conditionId] }
            : { conditionsAdd: [conditionId] }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao alterar condição");
        return;
      }

      onChanged();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const grantXp = async () => {
    const amount = Number(xpAmount);

    if (Number.isNaN(amount) || amount === 0) {
      setError("Informe um valor de XP válido.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsBusy(true);

    try {
      const response = await fetch(actorEndpoint(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpDelta: amount, reason: xpReason || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao adicionar XP");
        return;
      }

      setSuccess(`${amount} XP concedidos a ${actor.name}.`);
      onChanged();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const appliedConditionIds = new Set(
    (actor.conditions ?? []).map((condition) => condition.conditionId)
  );

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          {actor.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={actor.imageUrl}
              alt={actor.name}
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-800 text-xl font-bold text-gray-400">
              {actor.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{actor.name}</p>
            <p className="text-xs text-gray-400">
              Nível {actor.level} · {actor.xp}/100 XP
              {actor.kind === "npc" && actor.npcType === "enemy" && " · Inimigo"}
            </p>
            <p className="text-xs text-gray-500">
              HP {actor.hitPoints}/{actor.hitPointsMax} · Mana {actor.manaPoints}/
              {actor.manaPointsMax}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ["roll", "Exigir rolagem"],
              ["modify", "Modificar elementos"],
              ["xp", "Adicionar XP"],
            ] as [Panel, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchPanel(key)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                panel === key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 rounded-lg border border-green-800 bg-green-900/30 p-2 text-sm text-green-300">
            {success}
          </div>
        )}

        {panel === "roll" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Expressão de rolagem
              </label>
              <input
                type="text"
                value={rollExpression}
                onChange={(e) => setRollExpression(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {ROLL_QUICK.map((roll) => (
                  <button
                    key={roll}
                    onClick={() => setRollExpression(roll)}
                    disabled={isBusy}
                    className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    {roll}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={rollReason}
                onChange={(e) => setRollReason(e.target.value)}
                disabled={isBusy}
                placeholder="Ex.: teste de Força, iniciativa..."
                className={inputClass}
              />
            </div>
            <button
              onClick={requestRoll}
              disabled={isBusy}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isBusy ? "..." : "Exigir rolagem"}
            </button>
          </div>
        )}

        {panel === "modify" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Variação de HP (negativo = dano)
              </label>
              <input
                type="number"
                value={hpDelta}
                onChange={(e) => setHpDelta(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Variação de Mana
              </label>
              <input
                type="number"
                value={manaDelta}
                onChange={(e) => setManaDelta(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {DELTA_QUICK.map((delta) => (
                <button
                  key={delta}
                  onClick={() => setHpDelta(String(delta))}
                  disabled={isBusy}
                  className={`rounded px-2 py-1 text-xs ${
                    delta < 0
                      ? "bg-red-900/50 text-red-300 hover:bg-red-900"
                      : "bg-green-900/50 text-green-300 hover:bg-green-900"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={modifyReason}
                onChange={(e) => setModifyReason(e.target.value)}
                disabled={isBusy}
                placeholder="Ex.: dano de ataque, cura..."
                className={inputClass}
              />
            </div>
            <button
              onClick={applyModification}
              disabled={isBusy}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isBusy ? "..." : "Aplicar"}
            </button>

            {actor.kind === "character" && conditionOptions.length > 0 && (
              <div className="rounded border border-gray-800 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-300">Condições</p>
                <div className="space-y-1">
                  {conditionOptions.map((condition) => {
                    const applied = appliedConditionIds.has(condition.id);
                    return (
                      <label
                        key={condition.id}
                        className="flex items-center gap-2 rounded bg-gray-950 px-2 py-1 text-sm text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={applied}
                          onChange={() => toggleCondition(condition.id, applied)}
                          disabled={isBusy}
                          className="h-3.5 w-3.5 accent-purple-600"
                        />
                        {condition.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {panel === "xp" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Quantidade de XP
              </label>
              <input
                type="number"
                value={xpAmount}
                onChange={(e) => setXpAmount(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {XP_QUICK.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setXpAmount(String(amount))}
                    disabled={isBusy}
                    className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={xpReason}
                onChange={(e) => setXpReason(e.target.value)}
                disabled={isBusy}
                placeholder="Ex.: derrotou o chefe do calabouço..."
                className={inputClass}
              />
            </div>
            <button
              onClick={grantXp}
              disabled={isBusy}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isBusy ? "..." : `Adicionar ${xpAmount || "..."} XP`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
