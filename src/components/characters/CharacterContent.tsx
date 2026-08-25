"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentType } from "@/lib/validators/content";
import { useSocket } from "@/context/SocketContext";
import { TargetSelectionModal } from "@/components/combat/TargetSelectionModal";
import { DecorativeFrame } from "@/components/ui/DecorativeFrame";
import { Spinner } from "@/components/ui";
import { ToastContainer } from "@/components/ui/Toast";
import type { CombatSessionState, Combatant } from "@/lib/engine";
import { applyHealing, applyResolvedDamage, getExpression, hydrateCombatantMana, rollExpression, spendCombatActions, spendSpell } from "@/lib/engine";

const TYPE_LABELS: Record<ContentType, string> = {
  skills: "Perícias",
  spells: "Magias",
  items: "Itens",
  conditions: "Condições",
};

const TYPE_ORDER: ContentType[] = ["skills", "spells", "items", "conditions"];

type LinkedRow = {
  junction: {
    id: string;
    trained?: boolean;
    quantity?: number;
    permanent?: boolean;
  };
  content: Record<string, unknown>;
};

const SAFE_FORMULA = /^(?:\s*[+-]?\s*(?:\d+[dD]\d+|\d+)\s*)+$/;

function explicitFormula(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const candidate = value.trim();
    return candidate && SAFE_FORMULA.test(candidate) ? candidate : null;
  }
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = explicitFormula(item);
      if (result !== null) return result;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["formula", "expression", "rollExpression", "value", "damage", "amount", "data", "effect", "effects", "result", "system", "sourceData", "translation"]) {
    const result = explicitFormula(record[key]);
    if (result !== null) return result;
  }
  return null;
}

function normalizeActionDamage(content: Record<string, unknown>): string | number | null {
  // Keep this order aligned with the persisted content schema. Narrative text is
  // deliberately never searched as a free-form formula.
  const direct = explicitFormula(content.damage);
  if (direct !== null) return direct;

  const structured = content.structuredEffects ?? content.effects;
  if (structured && typeof structured === "object") {
    const result = explicitFormula(structured);
    if (result !== null) return result;
  }

  const extra = explicitFormula(content.extraEffect);
  if (extra !== null) return extra;
  const description = explicitFormula(content.description);
  if (description !== null) return description;

  for (const source of [content.translation, content.sourceData, content.source]) {
    const result = explicitFormula(source);
    if (result !== null) return result;
  }
  return null;
}

type CharacterContentProps = {
  characterId: string;
  defaultType?: ContentType;
  allowedTypes?: ContentType[];
  isTurnLocked?: boolean;
  campaignId?: string | null;
  combatants?: Combatant[];
  combatState?: CombatSessionState | null;
  onCombatStateChange?: (state: CombatSessionState) => void;
  onPersistActorStatus?: (actor: Combatant, hp: number, mana?: number) => Promise<void>;
  onActorStatusChange?: (actor: Combatant) => void;
  onActionResult?: (result: { title: string; formula: string; result: number; detail: string }) => void;
  characterManaCurrent?: number | null;
  characterManaMax?: number | null;
};

export function CharacterContent({
  characterId,
  defaultType = "skills",
  allowedTypes,
  isTurnLocked = false,
  campaignId,
  combatants = [],
  combatState = null,
  onCombatStateChange,
  onPersistActorStatus,
  onActorStatusChange,
  onActionResult,
  characterManaCurrent,
  characterManaMax,
}: CharacterContentProps) {
  const [activeType, setActiveType] = useState<ContentType>(defaultType);
  const [data, setData] = useState<{ linked: LinkedRow[]; available: Record<string, unknown>[] }>({
    linked: [],
    available: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: "error" | "success" | "info" | "warning" }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const { rollDice, requestDefenseReaction, updateActorStatus } = useSocket();
  const actorSocketId = (actor: Combatant) => actor.characterId ?? actor.npcId ?? actor.id;
  const [selectedActionItem, setSelectedActionItem] = useState<{
    name: string;
    isHealing: boolean;
    rollExpr?: string;
    damageExpr?: string;
    isPhysical: boolean;
    manaCost?: number;
    circle?: number;
    actionCostOverride?: number | null;
  } | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" | "warning" = "error") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const loadContent = useCallback(async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/content/${activeType}`, {
        credentials: "include"
      });
      const result = await response.json();

      if (!response.ok) {
        showToast(result.error || "Erro ao carregar conteúdo");
        return;
      }

      setData(result.data);
    } catch {
      showToast("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [characterId, activeType]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/characters/${characterId}/content/${activeType}`, {
          credentials: "include"
        });
        const result = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          showToast(result.error || "Erro ao carregar conteúdo");
          return;
        }

        setData(result.data);
      } catch {
        if (!cancelled) {
          showToast("Erro de conexão. Tente novamente.");
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
  }, [characterId, activeType]);

  const handleActionClick = (row: LinkedRow) => {
    if (!campaignId || combatants.length === 0) {
      showToast("Nenhum combate ativo: inicie um combate antes de usar esta ação.");
      return;
    }
    const name = String(row.content.name || "Ação");
    const desc = String(row.content.description || "").toLowerCase();
    const isHealing = name.toLowerCase().includes("cura") || name.toLowerCase().includes("poção") || desc.includes("cura") || desc.includes("recupera");
    const exprValue = getExpression(row.content.rollExpression);
    const expr = exprValue === null ? (activeType === "spells" ? "1d20" : undefined) : String(exprValue);
    const damageValue = normalizeActionDamage(row.content);
    const damageExpr = damageValue === null ? undefined : String(damageValue);

    setSelectedActionItem({
      name,
      isHealing,
      rollExpr: expr,
      damageExpr,
      isPhysical: !String(row.content.damageType || "").toLowerCase().match(/magic|mágic|mental|fire|fogo|cold|gelo/),
      manaCost: Number(row.content.manaCost) || undefined,
      circle: Number(row.content.circle) || undefined,
      actionCostOverride: typeof row.content.actionCostOverride === "number" ? row.content.actionCostOverride : null,
    });

  };

  const handleConfirmTarget = (target: Combatant) => {
    if (!selectedActionItem || !combatState || !campaignId) return;
    const attacker = combatState.combatants[combatState.currentTurnIndex];
    if (!attacker || (attacker.id !== characterId && attacker.characterId !== characterId)) {
      showToast("Seu personagem não está no turno atual do combate.");
      return;
    }

    const hydratedCombatState = { ...combatState, combatants: combatState.combatants.map((combatant) => combatant.id === attacker.id ? hydrateCombatantMana(combatant, characterManaCurrent, characterManaMax) : combatant) };
    const isSpell = activeType === "spells";
    const spent = isSpell && selectedActionItem.circle
      ? spendSpell(hydratedCombatState, attacker.id, selectedActionItem.circle, selectedActionItem.manaCost ?? 0, selectedActionItem.actionCostOverride)
      : spendCombatActions(hydratedCombatState, attacker.id, 1);
    if (!spent.success) {
      showToast(spent.message);
      return;
    }
    onCombatStateChange?.(spent.session);
    const updatedAttacker = spent.session.combatants.find((c) => c.id === attacker.id);
    if (updatedAttacker) {
      onActorStatusChange?.(updatedAttacker);
      void onPersistActorStatus?.(updatedAttacker, updatedAttacker.hpCurrent, updatedAttacker.manaCurrent);
    }

    if (selectedActionItem.isHealing) {
      const healed = rollExpression(selectedActionItem.rollExpr, 0);
      const healAmount = Math.max(0, healed.total);
      const currentTarget = spent.session.combatants.find((combatant) => combatant.id === target.id);
      if (!currentTarget) {
        showToast("Alvo não está mais no combate ativo.");
        return;
      }
      const healedTarget = applyHealing(currentTarget, healAmount);
      const healedState = {
        ...spent.session,
        combatants: spent.session.combatants.map((combatant) => combatant.id === healedTarget.id ? healedTarget : combatant),
      };
      onCombatStateChange?.(healedState);
      updateActorStatus({
        campaignId: campaignId!,
        actorId: actorSocketId(healedTarget),
        currentHp: healedTarget.hpCurrent,
        maxHp: healedTarget.hpMax,
      });
      onActorStatusChange?.(healedTarget);
      if (healedTarget.type === "npc") void onPersistActorStatus?.(healedTarget, healedTarget.hpCurrent);

      rollDice({
        campaignId: campaignId!,
        actorId: characterId,
        actorName: "Jogador",
        rollType: `Cura: ${selectedActionItem.name}`,
        formula: healed.formula,
        result: healAmount,
        diceDetail: `Curou +${healAmount} HP em ${target.name}`,
      });
      onActionResult?.({ title: selectedActionItem.name, formula: healed.formula, result: healAmount, detail: `${healed.detail}; Curou +${healAmount} HP em ${target.name}` });
    } else {
      const attack = rollExpression((selectedActionItem.rollExpr || "1d20") as string, 1);
      const damage = rollExpression(selectedActionItem.damageExpr, 0);
      const damageConfigured = !damage.missing && damage.valid;
      const damageNotice = damage.missing
        ? "Dano não configurado (nenhuma fórmula foi encontrada)."
        : damage.valid ? "" : "Fórmula de dano inválida; nenhum dano foi aplicado.";

      const currentTarget = spent.session.combatants.find((combatant) => combatant.id === target.id);
      if (!currentTarget) {
        showToast("Alvo não está mais no combate ativo.");
        return;
      }
      if (currentTarget.type === "npc" && !damage.missing && damage.valid) {
        const resolved = applyResolvedDamage(spent.session, currentTarget.id, Math.max(0, damage.total), attack.total, currentTarget.defenseReaction ?? "dodge", selectedActionItem.isPhysical);
        onCombatStateChange?.(resolved.session);
         const updatedTarget = resolved.session.combatants.find((c) => c.id === currentTarget.id);
          if (updatedTarget) {
            updateActorStatus({
              campaignId,
              actorId: actorSocketId(updatedTarget),
              currentHp: updatedTarget.hpCurrent,
              maxHp: updatedTarget.hpMax,
            });
            onActorStatusChange?.(updatedTarget);
            if (updatedTarget.type === "npc") void onPersistActorStatus?.(updatedTarget, updatedTarget.hpCurrent);
          }
          onActionResult?.({ title: selectedActionItem.name, formula: `${attack.formula} · dano ${damage.formula}`, result: resolved.result.damageTaken, detail: `${attack.detail}; ${damage.detail}; ${resolved.result.details}${damageNotice}` });
      } else if (currentTarget.type !== "npc" && damageConfigured) requestDefenseReaction({
        campaignId,
        id: `react_${Date.now()}`,
        attackerId: attacker.id,
        attackerName: "Jogador",
        targetId: currentTarget.id,
        targetName: currentTarget.name,
        rawDamage: Math.max(0, damage.total),
        attackRoll: attack.total,
        isPhysical: selectedActionItem.isPhysical,
        actionName: selectedActionItem.name,
      });
      if (currentTarget.type !== "npc") onActionResult?.({ title: selectedActionItem.name, formula: `${attack.formula} · dano ${damage.formula}`, result: damageConfigured ? damage.total : 0, detail: `${attack.detail}; ${damageConfigured ? `dano bruto ${damage.total} enviado para reação defensiva.` : "nenhum dano aplicado."} ${damageNotice}` });
      if (currentTarget.type === "npc" && !damageConfigured) onActionResult?.({ title: selectedActionItem.name, formula: attack.formula, result: 0, detail: `${attack.detail}; ${damageNotice}` });

      rollDice({
        campaignId: campaignId!,
        actorId: characterId,
        actorName: "Jogador",
        rollType: `Ataque: ${selectedActionItem.name}`,
        formula: attack.formula,
        result: attack.total,
        diceDetail: `Ataque contra ${target.name}: ${attack.detail}; dano: ${damage.total}`,
      });
    }

    setSelectedActionItem(null);
  };

  const handleUnlink = async (junctionId: string) => {
    setIsBusy(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/content/${activeType}/${junctionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        showToast(result.error || "Erro ao remover vínculo");
        return;
      }

      await loadContent();
    } catch {
      showToast("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePatchJunction = async (junctionId: string, payload: Record<string, unknown>) => {
    try {
      const response = await fetch(
        `/api/characters/${characterId}/content/${activeType}/${junctionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showToast(result.error || "Erro ao atualizar");
        return;
      }

      await loadContent();
    } catch {
      showToast("Erro de conexão. Tente novamente.");
    }
  };

  const displayTypes = allowedTypes ? TYPE_ORDER.filter((t) => allowedTypes.includes(t)) : TYPE_ORDER;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="h-full flex flex-col">
        {isTurnLocked && (
          <div className="mb-2 flex items-center justify-center gap-1.5 rounded-full border border-amber-800/60 bg-amber-950/40 px-3 py-0.5 text-xs font-bold text-amber-300 w-fit mx-auto">
            🔒 <span>Bloqueado (Fora do turno)</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto max-h-[60vh]">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              {activeType === "skills" ? "Todas as Perícias" : `Na ficha (${data.linked.length})`}
            </h4>
            {(() => {
              // Para perícias, exibir todas (linked + available que não estão em linked)
              const displayRows = activeType === "skills"
                ? [
                    ...data.linked,
                    ...data.available
                      .filter((avail) => !data.linked.some((linked) => linked.content.id === avail.id))
                      .map((avail) => ({
                        junction: { id: `available-${avail.id}`, trained: false },
                        content: avail,
                      })),
                  ]
                : data.linked;

              if (displayRows.length === 0) {
                return (
                  <p className="py-4 text-center text-xs text-gray-500 italic">
                    Nenhum item ou elemento vinculado nesta categoria.
                  </p>
                );
              }

              return (
                <div className="space-y-2 mt-auto pb-2">
                  {displayRows.map((row) => {
                    const isLinked = data.linked.some((linked) => linked.content.id === row.content.id);
                    const isAvailableOnly = !isLinked;
                    const isClickable = activeType === "skills" || activeType === "spells" || activeType === "items";

                    return (
                      <div
                        key={row.junction.id}
                        onClick={() => isClickable && !isTurnLocked && !isBusy ? handleActionClick(row) : undefined}
                        className={`flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 p-3 shadow-sm ${
                          isClickable
                            ? "cursor-pointer hover:border-purple-600 hover:bg-purple-950/20 transition-all active:scale-[0.98]" 
                            : ""
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">
                            {row.content.name as string}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {activeType === "skills" && (
                              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={!!row.junction.trained}
                                  disabled={true}
                                  className="h-4 w-4 accent-purple-600 opacity-60 cursor-not-allowed"
                                />
                                <span className={row.junction.trained ? "text-purple-400 font-bold" : "text-gray-400"}>
                                  {row.junction.trained ? "Treinada" : "Não Treinada"}
                                </span>
                              </label>
                            )}
                            {activeType === "items" && "quantity" in row.junction && (
                              <span className="text-[11px] text-gray-400 font-medium">
                                Quantidade: {row.junction.quantity || 1}
                              </span>
                            )}
                            {activeType === "conditions" && "permanent" in row.junction && row.junction.permanent && (
                              <span className="rounded bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-800/60">
                                Permanente
                              </span>
                            )}
                            {activeType === "spells" && (
                              <span className="text-[11px] text-purple-300 font-medium">
                                Círculo {String(row.content.circle)} · {String(row.content.manaCost)} Mana
                              </span>
                            )}
                          </div>
                        </div>
                        {activeType === "conditions" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(row.junction.id);
                              }}
                              disabled={isBusy}
                              className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {selectedActionItem && (
          <TargetSelectionModal
            actionName={selectedActionItem.name}
            isHealing={selectedActionItem.isHealing}
            combatants={combatants}
            myCharacterId={characterId}
            isOpen={Boolean(selectedActionItem)}
            onClose={() => setSelectedActionItem(null)}
            onConfirmTarget={handleConfirmTarget}
          />
        )}

        {displayTypes.length > 1 && (
          <div className="mt-auto flex justify-center items-center gap-2 pt-3 border-t border-gray-800 flex-wrap">
            {displayTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  activeType === type
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
