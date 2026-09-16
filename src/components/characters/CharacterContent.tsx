"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentType } from "@/lib/validators/content";
import { useSocket, DICE_ROLL_LOADING_DELAY } from "@/context/SocketContext";
import { TargetSelectionModal } from "@/components/combat/TargetSelectionModal";
import { Spinner } from "@/components/ui";
import { SpellFilledIcon, InventoryFilledIcon } from "@/components/ui/Icons";
import { ToastContainer } from "@/components/ui/Toast";
import type { CombatSessionState, Combatant } from "@/lib/engine";
import {
  applyHealing,
  applyResolvedDamage,
  getExpression,
  hydrateCombatantMana,
  normalizeSkillExpression,
  rollExpression,
  spendCombatActions,
  spendSpell,
  getSpellActionCost,
} from "@/lib/engine";

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

export function getContentName(content: Record<string, unknown> | null | undefined, fallback = ""): string {
  if (!content) return fallback;
  const translation = (content.translation && typeof content.translation === "object" ? content.translation : null) as Record<string, unknown> | null;
  if (typeof translation?.name === "string" && translation.name.trim()) {
    return translation.name.trim();
  }
  if (typeof content.name === "string" && content.name.trim()) {
    return content.name.trim();
  }
  return fallback;
}

export function getContentDescription(content: Record<string, unknown> | null | undefined, fallback = ""): string {
  if (!content) return fallback;
  const translation = (content.translation && typeof content.translation === "object" ? content.translation : null) as Record<string, unknown> | null;
  if (typeof translation?.description === "string" && translation.description.trim()) {
    return translation.description.trim();
  }
  const transSystem = (translation?.system && typeof translation.system === "object" ? translation.system : null) as Record<string, unknown> | null;
  const transSysDesc = transSystem?.description && typeof transSystem.description === "object" ? (transSystem.description as Record<string, unknown>).value : null;
  if (typeof transSysDesc === "string" && transSysDesc.trim()) {
    return transSysDesc.trim();
  }
  if (typeof content.description === "string" && content.description.trim()) {
    return content.description.trim();
  }
  const sourceData = (content.sourceData && typeof content.sourceData === "object" ? content.sourceData : null) as Record<string, unknown> | null;
  const sourceSystem = (sourceData?.system && typeof sourceData.system === "object" ? sourceData.system : null) as Record<string, unknown> | null;
  const sourceDesc = sourceSystem?.description && typeof sourceSystem.description === "object" ? (sourceSystem.description as Record<string, unknown>).value : null;
  if (typeof sourceDesc === "string" && sourceDesc.trim()) {
    return sourceDesc.trim();
  }
  return fallback;
}

export function getContentExtraEffect(content: Record<string, unknown> | null | undefined): string | null {
  if (!content) return null;
  const translation = (content.translation && typeof content.translation === "object" ? content.translation : null) as Record<string, unknown> | null;
  if (typeof translation?.extraEffect === "string" && translation.extraEffect.trim()) {
    return translation.extraEffect.trim();
  }
  if (typeof translation?.extra_effect === "string" && translation.extra_effect.trim()) {
    return translation.extra_effect.trim();
  }
  if (typeof content.extraEffect === "string" && content.extraEffect.trim()) {
    return content.extraEffect.trim();
  }
  return null;
}

type CharacterContentProps = {
  characterId: string;
  characterAttributeModifiers?: Record<string, number>;
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
  onStartRolling?: () => void;
  onEndRolling?: () => void;
  characterClassId?: string | null;
  characterLevel?: number;
};

type ClassBenefitItem = {
  id: string;
  level: number;
  name: string;
  description: string;
  hpBonus: number;
  manaBonus: number;
};

export function parseClassBenefits(data: unknown): ClassBenefitItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw: unknown) => {
    const b = (raw || {}) as Record<string, unknown>;
    const ben = (b.benefits || {}) as Record<string, unknown>;
    const translation = (ben.translation && typeof ben.translation === "object"
      ? ben.translation
      : b.translation && typeof b.translation === "object"
      ? b.translation
      : null) as Record<string, unknown> | null;

    let name = "";
    if (Array.isArray(translation?.advantages) && translation.advantages.length > 0) {
      name = translation.advantages.map(String).join(", ");
    } else if (typeof translation?.advantages === "string" && translation.advantages.trim()) {
      name = translation.advantages.trim();
    } else if (typeof translation?.name === "string" && translation.name.trim()) {
      name = translation.name.trim();
    } else if (typeof translation?.description === "string" && translation.description.trim()) {
      name = translation.description.trim().slice(0, 35);
    } else if (Array.isArray(ben.advantages) && ben.advantages.length > 0) {
      name = ben.advantages.map(String).join(", ");
    } else if (typeof ben.advantages === "string" && ben.advantages.trim()) {
      name = ben.advantages.trim();
    } else if (typeof ben.name === "string" && ben.name.trim()) {
      name = ben.name.trim();
    } else if (typeof ben.description === "string" && ben.description.trim()) {
      name = ben.description.trim().slice(0, 35);
    } else {
      name = `Habilidade Nv. ${b.level}`;
    }

    const description =
      typeof translation?.description === "string" && translation.description.trim()
        ? translation.description.trim()
        : typeof ben.description === "string"
        ? ben.description
        : "";

    return {
      id: (typeof b.id === "string" && b.id) || `feat-${b.level}`,
      level: Number(b.level) || 1,
      name,
      description,
      hpBonus: Number(ben.hp_bonus) || 0,
      manaBonus: Number(ben.mana_bonus) || 0,
    };
  }).sort((a: ClassBenefitItem, b: ClassBenefitItem) => a.level - b.level);
}

function ContentImageIcon({
  src,
  type,
  iconClassName,
}: {
  src?: unknown;
  type: ContentType;
  iconClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = typeof src === "string" ? src.trim() : "";

  if (imageUrl && !hasError) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  if (type === "items") {
    return <InventoryFilledIcon className={iconClassName || "h-8 w-8 shrink-0 text-amber-400"} />;
  }

  if (type === "conditions") {
    return <span className={iconClassName || "text-3xl select-none leading-none text-rose-400"}>⚡</span>;
  }

  return <SpellFilledIcon className={iconClassName || "h-8 w-8 shrink-0 text-purple-400"} />;
}

export function CharacterContent({
  characterId,
  characterAttributeModifiers,
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
  onStartRolling,
  onEndRolling,
  characterClassId,
  characterLevel,
}: CharacterContentProps) {
  const isGalleryMode = Boolean(allowedTypes?.includes("items") && allowedTypes?.includes("spells"));
  const [activeType, setActiveType] = useState<ContentType>(defaultType);
  const [classBenefits, setClassBenefits] = useState<ClassBenefitItem[]>([]);
  const [selectedClassBenefit, setSelectedClassBenefit] = useState<ClassBenefitItem | null>(null);
  const [data, setData] = useState<{ linked: LinkedRow[]; available: Record<string, unknown>[] }>({
    linked: [],
    available: [],
  });
  const [galleryData, setGalleryData] = useState<{
    spells: LinkedRow[];
    items: LinkedRow[];
    conditions: LinkedRow[];
  }>({
    spells: [],
    items: [],
    conditions: [],
  });
  const [prevCharacterId, setPrevCharacterId] = useState(characterId);
  const [equippedItemIds, setEquippedItemIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`libmork_equipped_items_${characterId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  if (characterId !== prevCharacterId) {
    setPrevCharacterId(characterId);
    let nextIds: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`libmork_equipped_items_${characterId}`);
        nextIds = stored ? JSON.parse(stored) : [];
      } catch {
        nextIds = [];
      }
    }
    setEquippedItemIds(nextIds);
  }
  const [selectedDetailItem, setSelectedDetailItem] = useState<{
    row: LinkedRow;
    type: "spells" | "items" | "conditions";
  } | null>(null);
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
    isSpell?: boolean;
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
      if (isGalleryMode) {
        const [spellsRes, itemsRes, conditionsRes, benefitsRes] = await Promise.all([
          fetch(`/api/characters/${characterId}/content/spells`, { credentials: "include" }),
          fetch(`/api/characters/${characterId}/content/items`, { credentials: "include" }),
          fetch(`/api/characters/${characterId}/content/conditions`, { credentials: "include" }),
          characterClassId
            ? fetch(`/api/classes/${characterClassId}/benefits`, { credentials: "include" })
            : Promise.resolve(null),
        ]);
        const [spellsJson, itemsJson, conditionsJson, benJson] = await Promise.all([
          spellsRes.json(),
          itemsRes.json(),
          conditionsRes.json(),
          benefitsRes && benefitsRes.ok ? benefitsRes.json() : Promise.resolve(null),
        ]);

        if (!spellsRes.ok || !itemsRes.ok || !conditionsRes.ok) {
          showToast("Erro ao carregar conteúdo");
          return;
        }

        setGalleryData({
          spells: spellsRes.ok && spellsJson.data?.linked ? spellsJson.data.linked : [],
          items: itemsRes.ok && itemsJson.data?.linked ? itemsJson.data.linked : [],
          conditions: conditionsRes.ok && conditionsJson.data?.linked ? conditionsJson.data.linked : [],
        });

        if (characterClassId && benJson?.data) {
          setClassBenefits(parseClassBenefits(benJson.data));
        } else {
          setClassBenefits([]);
        }
      } else {
        const response = await fetch(`/api/characters/${characterId}/content/${activeType}`, {
          credentials: "include",
        });
        const result = await response.json();

        if (!response.ok) {
          showToast(result.error || "Erro ao carregar conteúdo");
          return;
        }

        setData(result.data);
      }
    } catch {
      showToast("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [characterId, activeType, isGalleryMode, characterClassId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        if (isGalleryMode) {
          const [spellsRes, itemsRes, conditionsRes, benefitsRes] = await Promise.all([
            fetch(`/api/characters/${characterId}/content/spells`, { credentials: "include" }),
            fetch(`/api/characters/${characterId}/content/items`, { credentials: "include" }),
            fetch(`/api/characters/${characterId}/content/conditions`, { credentials: "include" }),
            characterClassId
              ? fetch(`/api/classes/${characterClassId}/benefits`, { credentials: "include" })
              : Promise.resolve(null),
          ]);
          const [spellsJson, itemsJson, conditionsJson, benJson] = await Promise.all([
            spellsRes.json(),
            itemsRes.json(),
            conditionsRes.json(),
            benefitsRes && benefitsRes.ok ? benefitsRes.json() : Promise.resolve(null),
          ]);

          if (cancelled) return;

          if (!spellsRes.ok || !itemsRes.ok || !conditionsRes.ok) {
            showToast("Erro ao carregar conteúdo");
            return;
          }

          setGalleryData({
            spells: spellsRes.ok && spellsJson.data?.linked ? spellsJson.data.linked : [],
            items: itemsRes.ok && itemsJson.data?.linked ? itemsJson.data.linked : [],
            conditions: conditionsRes.ok && conditionsJson.data?.linked ? conditionsJson.data.linked : [],
          });

          if (characterClassId && benJson?.data) {
            setClassBenefits(parseClassBenefits(benJson.data));
          } else {
            setClassBenefits([]);
          }
        } else {
          const response = await fetch(`/api/characters/${characterId}/content/${activeType}`, {
            credentials: "include",
          });
          const result = await response.json();

          if (cancelled) return;

          if (!response.ok) {
            showToast(result.error || "Erro ao carregar conteúdo");
            return;
          }

          setData(result.data);
        }
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
  }, [characterId, activeType, isGalleryMode, characterClassId]);

  const handleToggleEquip = (itemId: string) => {
    const isCurrentlyEquipped = equippedItemIds.includes(itemId);

    if (combatState?.active) {
      const attacker = combatState.combatants[combatState.currentTurnIndex];
      if (!attacker || (attacker.id !== characterId && attacker.characterId !== characterId)) {
        showToast("Seu personagem não está no turno atual do combate.");
        return;
      }

      if (attacker.actionsRemaining < 1) {
        showToast("Ações insuficientes (0/1 necessárias).");
        return;
      }

      const hydratedCombatState = {
        ...combatState,
        combatants: combatState.combatants.map((combatant) =>
          combatant.id === attacker.id
            ? hydrateCombatantMana(combatant, characterManaCurrent, characterManaMax)
            : combatant
        ),
      };

      const spent = spendCombatActions(hydratedCombatState, attacker.id, 1);
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

      showToast(isCurrentlyEquipped ? "Item desequipado (-1 ação)" : "Item equipado (-1 ação)", "success");
    } else {
      showToast(isCurrentlyEquipped ? "Item desequipado" : "Item equipado", "success");
    }

    const nextEquipped = isCurrentlyEquipped
      ? equippedItemIds.filter((id) => id !== itemId)
      : [...equippedItemIds, itemId];

    setEquippedItemIds(nextEquipped);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`libmork_equipped_items_${characterId}`, JSON.stringify(nextEquipped));
      } catch {
        // ignore
      }
    }
  };

  const handleFreeRoll = (row: LinkedRow, rowType: ContentType = activeType) => {
    const itemId = String(row.content.id || row.junction.id);
    if (rowType === "items" && !equippedItemIds.includes(itemId)) {
      showToast("Equipe o item antes de usá-lo.");
      return;
    }

    const name = getContentName(row.content, rowType === "spells" ? "Magia" : "Item");
    const rawExpr = getExpression(row.content.rollExpression);
    const expr = rawExpr !== null ? String(rawExpr) : "1d20";
    const rollResult = rollExpression(expr, 1);
    const damageValue = normalizeActionDamage(row.content);
    const damageResult = damageValue !== null ? rollExpression(String(damageValue), 0) : null;

    const hasValidDamage = Boolean(damageResult && !damageResult.missing && damageResult.valid);
    const formula = hasValidDamage
      ? `${rollResult.formula} · dano ${damageResult!.formula}`
      : rollResult.formula;
    const detail = hasValidDamage
      ? `${rollResult.detail}; Dano: ${damageResult!.detail}`
      : rollResult.detail;
    const total = rollResult.total;
    const rollType = `${name} (Livre)`;

    rollDice({
      campaignId: campaignId || "",
      actorId: characterId,
      actorName: "Jogador",
      rollType,
      formula,
      result: total,
      diceDetail: detail,
    });

    onActionResult?.({
      title: rollType,
      formula,
      result: total,
      detail,
    });
  };

  const handleActionClick = (row: LinkedRow, rowType: ContentType = activeType) => {
    if (rowType === "skills") {
      if (isBusy) return;

      onStartRolling?.();
      setIsBusy(true);

      setTimeout(() => {
        const name = getContentName(row.content, "Perícia");
        const rawExpression = getExpression(row.content.rollExpression);
        const expr = normalizeSkillExpression(rawExpression, characterAttributeModifiers ?? {}) ?? "1d20";
        const rollResult = rollExpression(expr, 1);

        if (campaignId) {
          rollDice({
            campaignId,
            actorId: characterId,
            actorName: "Jogador",
            rollType: `Teste de Perícia: ${name}`,
            formula: rollResult.formula,
            result: rollResult.total,
            diceDetail: rollResult.detail,
          });
        }

        onActionResult?.({
          title: `Teste de Perícia: ${name}`,
          formula: rollResult.formula,
          result: rollResult.total,
          detail: rollResult.detail,
        });

        onEndRolling?.();
        setIsBusy(false);
      }, DICE_ROLL_LOADING_DELAY);

      return;
    }

    if (rowType === "items") {
      const itemId = String(row.content.id || row.junction.id);
      if (!equippedItemIds.includes(itemId)) {
        showToast("Equipe o item antes de usá-lo em combate.");
        return;
      }
    }

    if (!campaignId || combatants.length === 0) {
      showToast("Nenhum combate ativo: inicie um combate antes de usar esta ação.");
      return;
    }

    if (isTurnLocked) {
      showToast("Seu personagem não está no turno atual do combate.");
      return;
    }
    const name = getContentName(row.content, "Ação");
    const desc = getContentDescription(row.content).toLowerCase();
    const isHealing = name.toLowerCase().includes("cura") || name.toLowerCase().includes("poção") || desc.includes("cura") || desc.includes("recupera");
    const exprValue = getExpression(row.content.rollExpression);
    const isSpell = rowType === "spells";
    const expr = exprValue === null ? (isSpell ? "1d20" : undefined) : String(exprValue);
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
      isSpell,
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
    const isSpell = selectedActionItem.isSpell ?? (activeType === "spells");
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
      if (currentTarget.type === "npc" && !damageConfigured && damageConfigured) {
        // unreachable guard
      } else if (currentTarget.type === "npc" && !damage.missing && damage.valid) {
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

  const handleUnlink = async (junctionId: string, rowType: ContentType = activeType) => {
    setIsBusy(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/content/${rowType}/${junctionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        showToast(result.error || "Erro ao remover vínculo");
        return;
      }

      setData((prev) => ({
        ...prev,
        linked: prev.linked.filter((row) => row.junction.id !== junctionId),
      }));
      setGalleryData((prev) => ({
        spells: prev.spells.filter((row) => row.junction.id !== junctionId),
        items: prev.items.filter((row) => row.junction.id !== junctionId),
        conditions: prev.conditions.filter((row) => row.junction.id !== junctionId),
      }));

      await loadContent();
    } catch {
      showToast("Erro de conexão. Tente novamente.");
    } finally {
      setIsBusy(false);
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
          <div className="flex-1 flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : isGalleryMode ? (
          <div className="space-y-6 overflow-y-auto pr-1 pb-4">
            {/* Seção 1: Magias */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                🔮 Magias ({galleryData.spells.length})
              </h4>
              {galleryData.spells.length === 0 ? (
                <p className="py-2 text-xs text-gray-500 italic">
                  Nenhuma magia vinculada
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-hide snap-x">
                  {galleryData.spells.map((row) => {
                    const actionCost = Math.min(3, Math.max(1, getSpellActionCost(Number(row.content.circle) || 1, row.content.actionCostOverride != null ? Number(row.content.actionCostOverride) : null)));
                    const spellName = getContentName(row.content, "Magia");
                    return (
                      <div
                        key={row.junction.id}
                        onClick={() => (!isBusy ? setSelectedDetailItem({ row, type: "spells" }) : undefined)}
                        className="w-[28%] min-w-[92px] max-w-[110px] aspect-square shrink-0 rounded-xl border border-purple-900/40 bg-gray-950 p-2 snap-start relative overflow-hidden flex flex-col justify-end items-center text-center group cursor-pointer hover:border-purple-600 hover:bg-purple-950/20 transition-all active:scale-[0.98]"
                      >
                        {/* Background Icon / Image */}
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-60 pointer-events-none overflow-hidden">
                          <ContentImageIcon src={row.content.imageUrl} type="spells" iconClassName="h-16 w-16 text-purple-400/80" />
                        </div>

                        {/* Shadow degradê de baixo para cima */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none" />

                        {/* Bolinhas no canto superior direito: Custo em Ações */}
                        <div
                          className="absolute top-1.5 right-1.5 z-20 flex gap-0.5 items-center rounded-full bg-black/60 px-1 py-0.5 border border-white/10 backdrop-blur-xs"
                          title={`Custo: ${actionCost} ação(ões)`}
                          aria-label={`Custo: ${actionCost} ação(ões)`}
                        >
                          {[1, 2, 3].map((dot) => (
                            <span
                              key={dot}
                              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                dot <= actionCost
                                  ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                  : "bg-gray-700/60"
                              }`}
                            />
                          ))}
                        </div>

                        {/* Detalhes do Card */}
                        <div className="relative z-20 flex flex-col items-center justify-end w-full min-w-0">
                          <p className="text-[11px] font-bold text-white truncate w-full" title={spellName}>
                            {spellName}
                          </p>
                          <span className="mt-0.5 text-[10px] text-purple-300 font-medium truncate w-full leading-tight">
                            Círculo {String(row.content.circle ?? 1)}
                          </span>
                          <span className="text-[9px] text-blue-400 font-semibold truncate w-full leading-tight">
                            {String(row.content.manaCost ?? 0)} Mana
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seção 2: Itens */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                🎒 Itens ({galleryData.items.length})
              </h4>
              {galleryData.items.length === 0 ? (
                <p className="py-2 text-xs text-gray-500 italic">
                  Nenhum item no inventário
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-hide snap-x">
                  {galleryData.items.map((row) => {
                    const itemId = String(row.content.id || row.junction.id);
                    const isEquipped = equippedItemIds.includes(itemId);
                    const qty = row.junction.quantity ?? 1;
                    const actionCost = Math.min(3, Math.max(1, typeof row.content.actionCostOverride === "number" ? row.content.actionCostOverride : 1));
                    const itemName = getContentName(row.content, "Item");
                    return (
                      <div
                        key={row.junction.id}
                        onClick={() => (!isBusy ? setSelectedDetailItem({ row, type: "items" }) : undefined)}
                        className={`w-[28%] min-w-[92px] max-w-[110px] aspect-square shrink-0 rounded-xl border ${
                          isEquipped
                            ? "border-emerald-500/60 ring-1 ring-emerald-500/40 bg-gray-950"
                            : "border-amber-900/40 bg-gray-950"
                        } p-2 snap-start relative overflow-hidden flex flex-col justify-end items-center text-center group cursor-pointer hover:border-amber-600 hover:bg-amber-950/20 transition-all active:scale-[0.98]`}
                      >
                        {/* Background Icon / Image */}
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-60 pointer-events-none overflow-hidden">
                          <ContentImageIcon src={row.content.imageUrl} type="items" iconClassName="h-16 w-16 text-amber-400/80" />
                        </div>

                        {/* Shadow degradê de baixo para cima */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none" />

                        {/* Bolinhas no canto superior direito: Custo em Ações */}
                        <div
                          className="absolute top-1.5 right-1.5 z-20 flex gap-0.5 items-center rounded-full bg-black/60 px-1 py-0.5 border border-white/10 backdrop-blur-xs"
                          title={`Custo: ${actionCost} ação(ões)`}
                          aria-label={`Custo: ${actionCost} ação(ões)`}
                        >
                          {[1, 2, 3].map((dot) => (
                            <span
                              key={dot}
                              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                dot <= actionCost
                                  ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                  : "bg-gray-700/60"
                              }`}
                            />
                          ))}
                        </div>

                        {/* Detalhes do Card */}
                        <div className="relative z-20 flex flex-col items-center justify-end w-full min-w-0">
                          <p className="text-[11px] font-bold text-white truncate w-full" title={itemName}>
                            {itemName}
                          </p>
                          <div className="mt-0.5 flex items-center justify-center gap-1 flex-wrap">
                            {isEquipped && (
                              <span className="rounded bg-emerald-950/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300 border border-emerald-700/60">
                                Equipado
                              </span>
                            )}
                            <span className="rounded bg-amber-950/70 px-1.5 py-0.2 text-[9px] font-medium text-amber-300 border border-amber-800/60">
                              Qtd: {qty}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seção 3: Condições */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                ⚡ Condições ({galleryData.conditions.length})
              </h4>
              {galleryData.conditions.length === 0 ? (
                <p className="py-2 text-xs text-gray-500 italic">
                  Nenhuma condição ativa
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-hide snap-x">
                  {galleryData.conditions.map((row) => {
                    const actionCost = typeof row.content.actionCostOverride === "number" && row.content.actionCostOverride > 0 ? Math.min(3, row.content.actionCostOverride) : null;
                    const conditionName = getContentName(row.content, "Condição");
                    return (
                      <div
                        key={row.junction.id}
                        onClick={() => (!isBusy ? setSelectedDetailItem({ row, type: "conditions" }) : undefined)}
                        className="w-[28%] min-w-[92px] max-w-[110px] aspect-square shrink-0 rounded-xl border border-rose-900/40 bg-gray-950 p-2 snap-start relative overflow-hidden flex flex-col justify-end items-center text-center group cursor-pointer hover:border-rose-600 hover:bg-rose-950/20 transition-all active:scale-[0.98]"
                      >
                        {/* Background Icon / Image */}
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-60 pointer-events-none overflow-hidden">
                          <ContentImageIcon src={row.content.imageUrl} type="conditions" iconClassName="text-4xl text-rose-400/80" />
                        </div>

                        {/* Shadow degradê de baixo para cima */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none" />

                        {/* Bolinhas no canto superior direito (se houver custo de ação configurado) */}
                        {actionCost !== null && (
                          <div
                            className="absolute top-1.5 right-1.5 z-20 flex gap-0.5 items-center rounded-full bg-black/60 px-1 py-0.5 border border-white/10 backdrop-blur-xs"
                            title={`Custo: ${actionCost} ação(ões)`}
                            aria-label={`Custo: ${actionCost} ação(ões)`}
                          >
                            {[1, 2, 3].map((dot) => (
                              <span
                                key={dot}
                                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                  dot <= actionCost
                                    ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                    : "bg-gray-700/60"
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Detalhes do Card */}
                        <div className="relative z-20 flex flex-col items-center justify-end w-full min-w-0">
                          <p className="text-[11px] font-bold text-white truncate w-full" title={conditionName}>
                            {conditionName}
                          </p>
                          {"permanent" in row.junction && row.junction.permanent ? (
                            <span className="mt-0.5 rounded bg-rose-950/80 px-1.5 py-0.2 text-[9px] font-bold text-rose-300 border border-rose-800/60">
                              Permanente
                            </span>
                          ) : (
                            <span className="mt-0.5 rounded bg-gray-900 px-1.5 py-0.2 text-[9px] font-medium text-gray-400 border border-gray-800">
                              Ativa
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUnlink(row.junction.id, "conditions");
                            }}
                            disabled={isBusy}
                            className="mt-1 w-full rounded border border-rose-800/60 bg-rose-950/60 py-0.5 text-[9px] font-semibold text-rose-300 hover:bg-rose-900/80 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seção 4: Habilidades de Classe */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                <span>⭐ Habilidades de Classe</span>
                <span className="text-[10px] text-gray-400 font-normal">
                  ({classBenefits.filter((b) => (characterLevel ?? 1) >= b.level).length}/{classBenefits.length} desbloqueadas)
                </span>
              </h4>
              {classBenefits.length === 0 ? (
                <p className="py-2 text-xs text-gray-500 italic">
                  {characterClassId ? "Nenhuma habilidade cadastrada para esta classe" : "Nenhuma classe vinculada ao personagem"}
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-hide snap-x">
                  {classBenefits.map((feat) => {
                    const isUnlocked = (characterLevel ?? 1) >= feat.level;
                    return (
                      <div
                        key={feat.id}
                        onClick={() => (!isBusy ? setSelectedClassBenefit(feat) : undefined)}
                        className={`w-[28%] min-w-[92px] max-w-[110px] aspect-square shrink-0 rounded-xl p-2 snap-start relative overflow-hidden flex flex-col justify-end items-center text-center group cursor-pointer transition-all active:scale-[0.98] ${
                          isUnlocked
                            ? "border border-indigo-900/40 bg-gray-950 hover:border-indigo-600 hover:bg-indigo-950/20"
                            : "border border-gray-800 bg-gray-950/90 grayscale opacity-60 hover:opacity-80"
                        }`}
                      >
                        {/* Background Icon / Crest */}
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40 pointer-events-none overflow-hidden">
                          <span className="font-dings text-4xl text-indigo-400 select-none">U</span>
                        </div>

                        {/* Shadow degradê */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none" />

                        {/* Ícone estilizado em cima para itens bloqueados */}
                        {!isUnlocked && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none -mt-3">
                            <span className="font-fantasy text-2xl text-amber-400/90 select-none drop-shadow">
                              🔒
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-gray-300 bg-black/80 px-1 rounded mt-0.5 border border-gray-700/60 font-sans">
                              Nv. {feat.level}
                            </span>
                          </div>
                        )}

                        {/* Badge de Nível para Desbloqueados */}
                        {isUnlocked && (
                          <div className="absolute top-1.5 right-1.5 z-20 flex items-center rounded-full bg-indigo-950/80 px-1.5 py-0.2 border border-indigo-700/60 text-[8px] font-bold text-indigo-300">
                            Nv. {feat.level}
                          </div>
                        )}

                        {/* Detalhes do Card */}
                        <div className="relative z-20 flex flex-col items-center justify-end w-full min-w-0">
                          <p className="text-[11px] font-bold text-white truncate w-full" title={feat.name}>
                            {feat.name}
                          </p>
                          <span className={`mt-0.5 text-[9px] font-medium truncate w-full leading-tight ${isUnlocked ? "text-indigo-300" : "text-gray-500"}`}>
                            {isUnlocked ? "Desbloqueada" : `Bloqueada (Nv. ${feat.level})`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`flex-1 flex flex-col ${activeType === "skills" ? "" : "overflow-y-auto max-h-[60vh]"}`}>
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
                <div className="space-y-2 pb-2">
                  {displayRows.map((row) => {
                    const isClickable = activeType === "skills" || activeType === "spells" || activeType === "items";
                    const isLocked = activeType === "skills" ? false : isTurnLocked;
                    const rowName = getContentName(row.content, "Item");

                    return (
                      <div
                        key={row.junction.id}
                        onClick={() => {
                          if (!isClickable || isLocked || isBusy) return;
                          if (activeType === "skills") {
                            handleActionClick(row, "skills");
                          } else {
                            setSelectedDetailItem({ row, type: activeType as "spells" | "items" | "conditions" });
                          }
                        }}
                        className={`flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 p-3 shadow-sm ${
                          isClickable
                            ? "cursor-pointer hover:border-purple-600 hover:bg-purple-950/20 transition-all active:scale-[0.98]" 
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {(activeType === "spells" || activeType === "items") && (
                            <div className="h-8 w-8 shrink-0 rounded-md overflow-hidden flex items-center justify-center bg-gray-900 border border-purple-500/40">
                              <ContentImageIcon src={row.content.imageUrl} type={activeType} iconClassName="h-5 w-5 text-purple-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate" title={rowName}>
                              {rowName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {activeType === "skills" && (
                                row.junction.trained ? (
                                  <span className="rounded bg-purple-950 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/60">
                                    ★ Treinada
                                  </span>
                                ) : (
                                  <span className="rounded bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-800">
                                    Não Treinada
                                  </span>
                                )
                              )}
                              {activeType === "items" && "quantity" in row.junction && (() => {
                                const itemId = String(row.content.id || row.junction.id);
                                const isEquipped = equippedItemIds.includes(itemId);
                                return (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isEquipped && (
                                      <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300 border border-emerald-800/60">
                                        Equipado
                                      </span>
                                    )}
                                    <span className="text-[11px] text-gray-400 font-medium">
                                      Quantidade: {row.junction.quantity || 1}
                                    </span>
                                  </div>
                                );
                              })()}
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
                        </div>
                        {activeType === "conditions" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(row.junction.id, "conditions");
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

        {selectedDetailItem && (() => {
          const { row, type } = selectedDetailItem;
          const detailItemId = String(row.content.id || row.junction.id);
          const isItemEquipped = equippedItemIds.includes(detailItemId);

          const detailActionCost =
            type === "spells"
              ? Math.min(
                  3,
                  Math.max(
                    1,
                    getSpellActionCost(
                      Number(row.content.circle) || 1,
                      row.content.actionCostOverride != null ? Number(row.content.actionCostOverride) : null
                    )
                  )
                )
              : type === "items"
              ? Math.min(
                  3,
                  Math.max(
                    1,
                    typeof row.content.actionCostOverride === "number" ? row.content.actionCostOverride : 1
                  )
                )
              : typeof row.content.actionCostOverride === "number" && row.content.actionCostOverride > 0
              ? Math.min(3, row.content.actionCostOverride)
              : null;

          const testExpr = getExpression(row.content.rollExpression) ?? (type === "spells" ? "1d20" : null);
          const damageValue = normalizeActionDamage(row.content);
          const damageExpr = damageValue !== null ? String(damageValue) : null;
          const name = getContentName(row.content, type === "spells" ? "Magia" : type === "items" ? "Item" : "Condição");
          const description = getContentDescription(row.content);
          const extraEffect = getContentExtraEffect(row.content);
          const categoryLabel = type === "spells" ? "Magia" : type === "items" ? "Item" : "Condição";
          const equipButtonLabel = `${isItemEquipped ? "🛡️ Desequipar" : "🗡️ Equipar"}${combatState?.active ? " (1 ação)" : ""}`;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setSelectedDetailItem(null)}
              role="dialog"
              aria-modal="true"
              aria-label={name}
            >
              <div
                className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-gray-800 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center">
                      <ContentImageIcon
                        src={row.content.imageUrl}
                        type={type}
                        iconClassName={
                          type === "spells"
                            ? "h-6 w-6 text-purple-400"
                            : type === "items"
                            ? "h-6 w-6 text-amber-400"
                            : "text-2xl text-rose-400"
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate" title={name}>
                        {name}
                      </h3>
                      <span className="text-[11px] font-medium text-gray-400">{categoryLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailItem(null)}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Corpo com Scroll */}
                <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
                  {/* Grid de Metadados */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {type === "spells" && (
                      <>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Círculo</span>
                          <span className="text-xs font-bold text-purple-300">
                            Círculo {String(row.content.circle ?? 1)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Custo de Mana</span>
                          <span className="text-xs font-bold text-blue-400">
                            {String(row.content.manaCost ?? 0)} Mana
                          </span>
                        </div>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Custo em Ações</span>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="text-xs font-bold text-amber-400 mr-1">{detailActionCost}</span>
                            <div className="flex gap-0.5 items-center">
                              {[1, 2, 3].map((dot) => (
                                <span
                                  key={dot}
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    dot <= (detailActionCost ?? 0)
                                      ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                      : "bg-gray-700/60"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {type === "items" && (
                      <>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Quantidade</span>
                          <span className="text-xs font-bold text-gray-200">
                            {String(row.junction.quantity ?? 1)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Status</span>
                          <span className={`text-xs font-bold ${isItemEquipped ? "text-emerald-400" : "text-gray-400"}`}>
                            {isItemEquipped ? "Equipado" : "Na mochila"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Custo em Ações</span>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="text-xs font-bold text-amber-400 mr-1">{detailActionCost}</span>
                            <div className="flex gap-0.5 items-center">
                              {[1, 2, 3].map((dot) => (
                                <span
                                  key={dot}
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    dot <= (detailActionCost ?? 0)
                                      ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                      : "bg-gray-700/60"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {type === "conditions" && (
                      <>
                        <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Tipo</span>
                          <span className="text-xs font-bold text-rose-300">
                            {row.junction.permanent ? "Permanente" : "Ativa"}
                          </span>
                        </div>
                        {detailActionCost !== null && (
                          <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Custo em Ações</span>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <span className="text-xs font-bold text-amber-400 mr-1">{detailActionCost}</span>
                              <div className="flex gap-0.5 items-center">
                                {[1, 2, 3].map((dot) => (
                                  <span
                                    key={dot}
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      dot <= detailActionCost
                                        ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                                        : "bg-gray-700/60"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Fórmulas */}
                  {Boolean(testExpr || damageExpr) && (
                    <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Fórmulas</span>
                      <div className="flex flex-wrap gap-4 text-xs">
                        {testExpr && (
                          <div>
                            <span className="text-gray-400">Teste: </span>
                            <span className="font-mono font-semibold text-purple-300">{String(testExpr)}</span>
                          </div>
                        )}
                        {damageExpr && (
                          <div>
                            <span className="text-gray-400">Dano: </span>
                            <span className="font-mono font-semibold text-rose-300">{String(damageExpr)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Descrição */}
                  {Boolean(description) && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Descrição</span>
                      <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-gray-900/40 p-3 border border-gray-800/60">
                        {description}
                      </div>
                    </div>
                  )}

                  {/* Efeito Extra */}
                  {Boolean(extraEffect) && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">Efeito Extra</span>
                      <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-purple-950/20 p-3 border border-purple-800/40">
                        {extraEffect}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé de Ações */}
                <div className="border-t border-gray-800 p-4 flex flex-wrap gap-2 justify-end bg-gray-900/50">
                  {type === "conditions" && (
                    <button
                      type="button"
                      onClick={() => {
                        const jId = row.junction.id;
                        setSelectedDetailItem(null);
                        void handleUnlink(jId, "conditions");
                      }}
                      disabled={isBusy}
                      className="rounded-lg border border-rose-800/80 bg-rose-950/60 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-900 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Remover Condição
                    </button>
                  )}

                  {type === "items" && (
                    <button
                      type="button"
                      onClick={() => handleToggleEquip(detailItemId)}
                      disabled={isBusy}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        isItemEquipped
                          ? "border-emerald-700/80 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 hover:text-white"
                          : "border-amber-700/80 bg-amber-950/60 text-amber-300 hover:bg-amber-900/80 hover:text-white"
                      }`}
                    >
                      {equipButtonLabel}
                    </button>
                  )}

                  {(type === "spells" || type === "items") && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (type === "items" && !isItemEquipped) {
                            showToast("Equipe o item antes de usá-lo.");
                            return;
                          }
                          setSelectedDetailItem(null);
                          handleFreeRoll(row, type);
                        }}
                        disabled={isBusy}
                        className="rounded-lg border border-blue-700/80 bg-blue-950/60 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-900/80 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        🎲 Sem combate
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (type === "items" && !isItemEquipped) {
                            showToast("Equipe o item antes de usá-lo em combate.");
                            return;
                          }
                          setSelectedDetailItem(null);
                          handleActionClick(row, type);
                        }}
                        disabled={isBusy}
                        className="rounded-lg border border-purple-700/80 bg-purple-950/60 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-900/80 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        ⚔️ Em combate
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {selectedClassBenefit && (() => {
          const isUnlocked = (characterLevel ?? 1) >= selectedClassBenefit.level;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setSelectedClassBenefit(null)}
              role="dialog"
              aria-modal="true"
              aria-label={selectedClassBenefit.name}
            >
              <div
                className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-gray-800 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-gray-900 border border-indigo-500/40 flex items-center justify-center">
                      <span className="font-dings text-2xl text-indigo-400 select-none">U</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate" title={selectedClassBenefit.name}>
                        {selectedClassBenefit.name}
                      </h3>
                      <span className="text-[11px] font-medium text-gray-400">
                        Habilidade de Classe · Nível {selectedClassBenefit.level}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClassBenefit(null)}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Corpo com Scroll */}
                <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
                  {/* Status do Desbloqueio */}
                  {isUnlocked ? (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 p-3 flex items-center gap-3">
                      <span className="text-emerald-400 text-lg select-none">✓</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-300">Habilidade Desbloqueada</p>
                        <p className="text-[11px] text-emerald-400/80">
                          Disponível para seu personagem (Nível {characterLevel ?? 1} ≥ {selectedClassBenefit.level}).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-900/80 border border-amber-800/40 p-3 flex items-center gap-3">
                      <span className="font-fantasy text-amber-400 text-lg select-none">🔒</span>
                      <div>
                        <p className="text-xs font-bold text-amber-300">Habilidade Bloqueada</p>
                        <p className="text-[11px] text-gray-400">
                          Requer que o personagem alcance o nível {selectedClassBenefit.level} (Nível atual: {characterLevel ?? 1}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Metadados / Bônus */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Nível Exigido</span>
                      <span className="text-xs font-bold text-indigo-300">Nível {selectedClassBenefit.level}</span>
                    </div>
                    {selectedClassBenefit.hpBonus > 0 && (
                      <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Bônus de HP</span>
                        <span className="text-xs font-bold text-emerald-400">+{selectedClassBenefit.hpBonus} HP</span>
                      </div>
                    )}
                    {selectedClassBenefit.manaBonus > 0 && (
                      <div className="rounded-lg bg-gray-900/80 border border-gray-800/80 p-2 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Bônus de Mana</span>
                        <span className="text-xs font-bold text-blue-400">+{selectedClassBenefit.manaBonus} Mana</span>
                      </div>
                    )}
                  </div>

                  {/* Descrição Completa */}
                  {Boolean(selectedClassBenefit.description) && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Descrição</span>
                      <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-gray-900/40 p-3 border border-gray-800/60">
                        {selectedClassBenefit.description}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="border-t border-gray-800 p-4 flex justify-end bg-gray-900/50">
                  <button
                    type="button"
                    onClick={() => setSelectedClassBenefit(null)}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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

        {!isGalleryMode && displayTypes.length > 1 && (
          <div className="mt-2 flex justify-center items-center gap-2 pt-2 border-t border-gray-800 flex-wrap">
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
