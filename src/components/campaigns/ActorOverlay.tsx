"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/context/SocketContext";

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

export type ContentCategory = "items" | "spells" | "abilities" | "skills";

export type ManagedContentItem = {
  id: string;
  junctionId?: string;
  name: string;
  category: ContentCategory;
  description?: string | null;
};

type ConditionOption = { id: string; name: string };
type Panel = "roll" | "modify" | "xp" | "inventory";

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
  const { updateActorStatus, rollDice } = useSocket();
  const [panel, setPanel] = useState<Panel>("inventory");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rollExpression, setRollExpression] = useState("1d20");
  const [rollReason, setRollReason] = useState("");
  const [rollMode, setRollMode] = useState<"digital" | "manual">("digital");
  const [manualValue, setManualValue] = useState("");
  const [hpDelta, setHpDelta] = useState("");
  const [manaDelta, setManaDelta] = useState("");
  const [modifyReason, setModifyReason] = useState("");
  const [conditionOptions, setConditionOptions] = useState<ConditionOption[]>([]);
  const [conditionsLoaded, setConditionsLoaded] = useState(false);
  const [xpAmount, setXpAmount] = useState("25");
  const [xpReason, setXpReason] = useState("");

  // Conteúdos da campanha e inventário do personagem
  const [managedContents, setManagedContents] = useState<ManagedContentItem[]>([]);
  const [contentSearch, setContentSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | "all">("all");
  const [inventoryItems, setInventoryItems] = useState<ManagedContentItem[]>([]);

  // Carregar Conteúdos Gerenciados da Campanha e Inventário da Ficha do DB
  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        const categories: ContentCategory[] = ["items", "spells", "abilities", "skills"];
        
        // 1. Conteúdos da campanha
        const managedPromises = categories.map((cat) =>
          fetch(`/api/campaigns/${campaignId}/content/${cat}`).then((r) => r.json())
        );

        // 2. Inventário do personagem do DB se for character
        const inventoryPromises = actor.kind === "character"
          ? categories.map((cat) => fetch(`/api/characters/${actor.id}/content/${cat}`).then((r) => r.json()))
          : [];

        const [managedResults, inventoryResults] = await Promise.all([
          Promise.all(managedPromises),
          Promise.all(inventoryPromises),
        ]);

        if (cancelled) return;

        // Processar Conteúdos da Campanha
        const allManaged: ManagedContentItem[] = [];
        categories.forEach((cat, idx) => {
          const resData = managedResults[idx];
          if (resData && resData.success && Array.isArray(resData.data)) {
            resData.data.forEach((item: { id: string; name: string; description?: string | null }) => {
              allManaged.push({
                id: item.id,
                name: item.name,
                category: cat,
                description: item.description ?? null,
              });
            });
          }
        });
        setManagedContents(allManaged);

        // Processar Inventário Vinculado no DB
        if (actor.kind === "character") {
          const allInventory: ManagedContentItem[] = [];
          categories.forEach((cat, idx) => {
            const resData = inventoryResults[idx];
            if (resData && resData.success && resData.data?.linked) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              resData.data.linked.forEach((linkItem: any) => {
                allInventory.push({
                  id: linkItem.content.id,
                  junctionId: linkItem.junction.id,
                  name: linkItem.content.name,
                  category: cat,
                  description: linkItem.content.description ?? null,
                });
              });
            }
          });
          setInventoryItems(allInventory);
        }
      } catch {
        // Erro silencioso em conteúdos opcionais
      }
    };

    void loadAll();

    return () => {
      cancelled = true;
    };
  }, [campaignId, actor.id, actor.kind]);

  const handleAddToInventory = async (item: ManagedContentItem) => {
    if (inventoryItems.some((i) => i.id === item.id && i.category === item.category)) {
      return;
    }

    if (actor.kind === "character") {
      try {
        const response = await fetch(`/api/characters/${actor.id}/content/${item.category}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: item.id }),
        });

        const data = await response.json();

        if (response.ok && data.data) {
          const newItem: ManagedContentItem = {
            ...item,
            junctionId: data.data.id,
          };
          setInventoryItems((prev) => [...prev, newItem]);
          onChanged();
          return;
        }
      } catch {
        setError("Erro ao vincular item ao banco de dados.");
        return;
      }
    }

    setInventoryItems((prev) => [...prev, item]);
  };

  const handleRemoveFromInventory = async (itemId: string, category: ContentCategory, junctionId?: string) => {
    if (actor.kind === "character" && junctionId) {
      try {
        await fetch(`/api/characters/${actor.id}/content/${category}/${junctionId}`, {
          method: "DELETE",
        });
        onChanged();
      } catch {
        setError("Erro ao desvincular item no banco de dados.");
      }
    }

    setInventoryItems((prev) => prev.filter((i) => !(i.id === itemId && i.category === category)));
  };

  const handleDropToInventory = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const item: ManagedContentItem = JSON.parse(dataStr);
      if (item && item.id && item.category) {
        handleAddToInventory(item);
      }
    } catch {}
  };

  const loadConditions = async () => {
    if (conditionsLoaded || actor.kind !== "character") return;

    try {
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
      let finalResult = 0;
      let detailText = "";
      const isManual = rollMode === "manual";

      if (isManual) {
        const val = Number(manualValue);
        if (Number.isNaN(val) || manualValue.trim() === "") {
          setError("Informe um resultado válido para o dado físico.");
          setIsBusy(false);
          return;
        }
        finalResult = val;
        detailText = `Resultado informado manualmente: ${val}`;
      } else {
        const match = rollExpression.trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
        if (match) {
          const count = parseInt(match[1], 10);
          const sides = parseInt(match[2], 10);
          const sign = match[3] === "-" ? -1 : 1;
          const mod = match[4] ? parseInt(match[4], 10) * sign : 0;
          let sum = 0;
          const rolls: number[] = [];
          for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * sides) + 1;
            rolls.push(r);
            sum += r;
          }
          finalResult = sum + mod;
          detailText = `Rolou [${rolls.join(", ")}]${mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ""} = ${finalResult}`;
        } else {
          finalResult = Math.floor(Math.random() * 20) + 1;
          detailText = `Rolou [${finalResult}]`;
        }
      }

      // Notificar via WebSocket em tempo real (RF-041, RF-046)
      rollDice({
        campaignId,
        actorId: actor.id,
        actorName: actor.name,
        rollType: rollReason || "Rolagem",
        formula: rollExpression,
        result: finalResult,
        diceDetail: detailText,
        isManual,
      });

      // Gravar no backend de logs
      await fetch(`/api/campaigns/${campaignId}/rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorType: actor.kind,
          actorId: actor.id,
          actorName: actor.name,
          rollExpression,
          result: finalResult,
          reason: rollReason || undefined,
          isManual,
        }),
      });

      setSuccess(
        `Rolagem (${isManual ? "Manual" : "Digital"}) concluída: ${finalResult} (${detailText})`
      );
    } catch {
      setError("Erro ao executar rolagem. Tente novamente.");
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
      
      // Notificar a sala por WebSocket (RF-025, RF-049)
      updateActorStatus({
        campaignId,
        actorId: actor.id,
        currentHp: actor.hitPoints + (hp || 0),
        currentMana: actor.manaPoints + (mana || 0),
      });

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

      // Notificar sala por WebSocket (RF-025, RF-049)
      updateActorStatus({
        campaignId,
        actorId: actor.id,
      });

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

      // Notificar sala por WebSocket
      updateActorStatus({
        campaignId,
        actorId: actor.id,
        currentXp: actor.xp + amount,
      });

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

  const categoryLabel = (cat: ContentCategory) => {
    switch (cat) {
      case "items":
        return "⚔️ Item";
      case "spells":
        return "✨ Magia";
      case "abilities":
        return "🥋 Habilidade";
      case "skills":
        return "📖 Perícia";
    }
  };

  const filteredContents = managedContents.filter((item) => {
    const matchCat = selectedCategory === "all" || item.category === selectedCategory;
    const matchName = item.name.toLowerCase().includes(contentSearch.toLowerCase());
    return matchCat && matchName;
  });

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-gray-800 bg-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Personagem */}
        <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            {actor.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={actor.imageUrl}
                alt={actor.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-400">
                {actor.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white">{actor.name}</h2>
              <div className="flex gap-2 text-xs text-gray-400">
                <span>Nível {actor.level}</span>
                <span>•</span>
                <span>HP {actor.hitPoints}/{actor.hitPointsMax}</span>
                <span>•</span>
                <span>Mana {actor.manaPoints}/{actor.manaPointsMax}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Corpo principal com 2 colunas */}
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Coluna Esquerda: Ações & Inventário do Personagem */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Abas */}
            <div className="mb-3 flex gap-1 border-b border-gray-800 pb-2">
              {(
                [
                  ["inventory", "🎒 Inventário"],
                  ["roll", "🎲 Rolagem"],
                  ["modify", "⚡ Modificar"],
                  ["xp", "⭐ XP"],
                ] as [Panel, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => switchPanel(key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
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
              <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-2 rounded-lg border border-green-800 bg-green-900/30 p-2 text-xs text-green-300">
                {success}
              </div>
            )}

            {/* Conteúdo da Aba Inventário */}
            {panel === "inventory" && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropToInventory}
                className="flex flex-1 flex-col overflow-hidden rounded-lg border-2 border-dashed border-gray-800 bg-gray-950 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Recursos & Inventário ({inventoryItems.length})
                  </h3>
                  <span className="text-[10px] text-gray-500">
                    Arraste do painel ao lado ou use o botão +
                  </span>
                </div>

                {inventoryItems.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
                    <span className="mb-1 text-2xl">🎒</span>
                    Inventário vazio.
                    <br />
                    Arraste itens, magias, habilidades ou perícias do painel da direita para este personagem.
                  </div>
                ) : (
                  <div className="flex-1 space-y-1.5 overflow-y-auto">
                    {inventoryItems.map((item) => (
                      <div
                        key={`${item.category}-${item.id}`}
                        className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="ml-2 text-[10px] text-gray-400">
                            {categoryLabel(item.category)}
                          </span>
                          {item.description && (
                            <p className="mt-0.5 truncate text-[10px] text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveFromInventory(item.id, item.category, item.junctionId)}
                          className="ml-2 rounded text-gray-500 hover:text-red-400"
                          title="Remover do personagem"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo das outras abas */}
            {panel === "roll" && (
              <div className="space-y-3 overflow-y-auto pr-1">
                {/* Seletor de Modo: Digital RNG vs Rolagem Assistida (Manual) (RF-041, RF-046) */}
                <div className="flex rounded-lg bg-gray-950 p-1 border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setRollMode("digital")}
                    className={`flex-1 rounded-md py-1 text-xs font-semibold ${
                      rollMode === "digital"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    ⚡ Digital (RNG)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRollMode("manual")}
                    className={`flex-1 rounded-md py-1 text-xs font-semibold ${
                      rollMode === "manual"
                        ? "bg-amber-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🎲 Assistida (Dado Físico)
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-300">
                    Expressão de rolagem / Fórmula
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

                {rollMode === "manual" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-amber-400">
                      Resultado do Dado Físico (Preenchimento Manual)
                    </label>
                    <input
                      type="number"
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      disabled={isBusy}
                      placeholder="Ex.: 17"
                      className="w-full rounded-lg border border-amber-600/60 bg-gray-950 px-3 py-2 text-sm text-amber-300 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-300">
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={rollReason}
                    onChange={(e) => setRollReason(e.target.value)}
                    disabled={isBusy}
                    placeholder="Ex.: teste de Força, ataque..."
                    className={inputClass}
                  />
                </div>

                <button
                  onClick={requestRoll}
                  disabled={isBusy}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    rollMode === "manual" ? "bg-amber-600 hover:bg-amber-700" : "bg-purple-600 hover:bg-purple-700"
                  }`}
                >
                  {isBusy ? "..." : rollMode === "manual" ? "Enviar Resultado Físico" : "Rolar Dados (Digital)"}
                </button>
              </div>
            )}

            {panel === "modify" && (
              <div className="space-y-2 overflow-y-auto pr-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-300">
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
                  <label className="mb-1 block text-xs font-medium text-gray-300">
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
                  <label className="mb-1 block text-xs font-medium text-gray-300">
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
                  <div className="rounded border border-gray-800 p-2">
                    <p className="mb-1.5 text-xs font-semibold text-gray-300">Condições</p>
                    <div className="space-y-1">
                      {conditionOptions.map((condition) => {
                        const applied = appliedConditionIds.has(condition.id);
                        return (
                          <label
                            key={condition.id}
                            className="flex items-center gap-2 rounded bg-gray-950 px-2 py-1 text-xs text-gray-300"
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
              <div className="space-y-2 overflow-y-auto pr-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-300">
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
                  <label className="mb-1 block text-xs font-medium text-gray-300">
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

          {/* Coluna Direita: Conteúdos Gerenciados da Campanha (Drag & Drop Source) */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Conteúdos da Campanha ({filteredContents.length})
              </h3>
            </div>

            <div className="mb-2 space-y-1.5">
              <input
                type="text"
                placeholder="Buscar item, magia, habilidade..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1 text-xs text-white"
              />

              <div className="flex gap-1 overflow-x-auto text-[10px]">
                {(
                  [
                    ["all", "Todos"],
                    ["items", "Itens"],
                    ["spells", "Magias"],
                    ["abilities", "Habilidades"],
                    ["skills", "Perícias"],
                  ] as const
                ).map(([cat, label]) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded px-2 py-0.5 font-semibold ${
                      selectedCategory === cat
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredContents.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500">
                Nenhum conteúdo cadastrado ou ativado na campanha.
              </p>
            ) : (
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {filteredContents.map((item) => (
                  <div
                    key={`${item.category}-${item.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(item));
                    }}
                    className="group flex cursor-grab items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-2 transition-colors hover:border-purple-600 hover:bg-gray-800 active:cursor-grabbing"
                    title="Arraste para o Inventário ou clique no +"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-gray-500 group-hover:text-purple-400">⠿</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{item.name}</p>
                        <p className="text-[10px] text-gray-400">{categoryLabel(item.category)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddToInventory(item)}
                      className="shrink-0 rounded bg-purple-600/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-purple-600"
                      title="Adicionar ao inventário"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
