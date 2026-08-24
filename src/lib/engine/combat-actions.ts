import type { CombatSessionState, DefenseReaction } from "./combat";
import { applyHpChange, applyManaChange, getDefenseValue, resolveAttack, spendCombatActions } from "./combat";
import { resolveSpellCost } from "./spells";

export function spendSpell(session: CombatSessionState, attackerId: string, circle: number, manaCost: number, actionCostOverride?: number | null) {
  const attacker = session.combatants.find((c) => c.id === attackerId);
  if (!attacker || attacker.id !== session.combatants[session.currentTurnIndex]?.id) return { session, success: false, message: "Não é o turno deste combatente." };
  if (attacker.manaCurrent == null) return { session, success: false, message: "Mana não está disponível neste combate." };
  const cost = resolveSpellCost(attacker.actionsRemaining, attacker.manaCurrent, circle, manaCost, actionCostOverride);
  if (!cost.valid) return { session, success: false, message: cost.message };
  const manaSession = { ...session, combatants: session.combatants.map((c) => c.id === attackerId ? applyManaChange(c, -manaCost) : c) };
  return spendCombatActions(manaSession, attackerId, cost.actionCost);
}

export function applyResolvedDamage(session: CombatSessionState, targetId: string, rawDamage: number, attackRoll: number, reaction: DefenseReaction, isPhysical: boolean) {
  const target = session.combatants.find((c) => c.id === targetId);
  if (!target) return { session, result: resolveAttack({ rawDamage: 0, reaction, attackRoll, defenseValue: 0, vigor: 0, level: 1, isPhysical }) };
  const result = resolveAttack({ rawDamage: Math.max(0, rawDamage), reaction, attackRoll, defenseValue: getDefenseValue(target.destreza), vigor: target.vigor, level: target.level, isPhysical });
  return { session: { ...session, combatants: session.combatants.map((c) => c.id === targetId ? applyHpChange(c, -result.damageTaken) : c) }, result };
}
