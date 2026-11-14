import {
  FALLOUT_BODY_LOCATIONS,
  type FalloutApparelItem,
  type FalloutBodyPart,
  type FalloutBodyPartStatus,
  type FalloutCharacter,
  type FalloutInjurySlot,
  type FalloutItem,
} from "./types";
import {
  calculateMaxHp,
  calculateDefense,
  calculateInitiative,
  calculateMeleeDamageBonus,
  calculateCarryWeightMax,
  calculateEncumbranceLevel,
} from "./rules";

function migrateLegacyFields(char: FalloutCharacter): FalloutCharacter {
  const bodyParts = { ...char.bodyParts };
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    const part = bodyParts[loc] as any;
    if (!part) continue;
    if (typeof part.injuries === "number") {
      const count = Math.min(3, Math.max(0, part.injuries));
      part.injuries = [
        count > 0 ? 2 : 0,
        count > 1 ? 2 : 0,
        count > 2 ? 2 : 0,
      ] as [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot];
    }
    if (!Array.isArray(part.injuries)) {
      part.injuries = [0, 0, 0];
    }
    delete part.isCrippled;
    bodyParts[loc] = { ...part } as FalloutBodyPart;
  }

  const items = char.items.map((item: any) => {
    const migrated = { ...item };
    if (migrated.stashed === undefined) migrated.stashed = false;
    if (migrated.type === "apparel" && migrated.powered === undefined) migrated.powered = false;
    if (migrated.type === "ammo") {
      if (migrated.shotsMax === undefined) migrated.shotsMax = 1;
      if (migrated.shotsCurrent === undefined) migrated.shotsCurrent = migrated.shotsMax;
    }
    return migrated as FalloutItem;
  });

  return { ...char, bodyParts: bodyParts as FalloutCharacter["bodyParts"], items };
}

function recomputeBodyResistances(char: FalloutCharacter): FalloutCharacter {
  const bodyParts = { ...char.bodyParts };
  const equippedApparel = char.items.filter(
    (i): i is FalloutApparelItem =>
      i.type === "apparel" && i.equipped && !i.stashed,
  );

  for (const loc of FALLOUT_BODY_LOCATIONS) {
    const covering = equippedApparel.filter((a) => a.locationsCovered.includes(loc));
    let res = { physical: 0, energy: 0, radiation: 0, poison: 0 };

    const poweredPA = covering.find((a) => a.apparelType === "powerArmor" && a.powered);
    const armor = covering.find((a) => a.apparelType === "armor");
    const outfit = covering.find((a) => a.apparelType === "outfit");
    const headgear = covering.find((a) => a.apparelType === "headgear");
    const clothing = covering.filter((a) => a.apparelType === "clothing");

    if (poweredPA) {
      res = { ...poweredPA.resistances };
    } else if (armor) {
      res = { ...armor.resistances };
    } else if (loc === "head" && headgear) {
      res = { ...headgear.resistances };
    } else if (outfit && loc !== "head") {
      res = { ...outfit.resistances };
    }

    for (const c of clothing) {
      res.physical = Math.max(res.physical, c.resistances.physical);
      res.energy = Math.max(res.energy, c.resistances.energy);
      res.radiation = Math.max(res.radiation, c.resistances.radiation);
    }

    res.poison = 0;
    bodyParts[loc] = { ...bodyParts[loc], resistances: res };
  }

  return { ...char, bodyParts: bodyParts as FalloutCharacter["bodyParts"] };
}

function statusFromInjuries(injuries: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot]): FalloutBodyPartStatus {
  const max = Math.max(...injuries);
  if (max >= 2) return "crippled";
  if (max === 1) return "wounded";
  return "healthy";
}

function recomputeBodyStatus(char: FalloutCharacter): FalloutCharacter {
  const bodyParts = { ...char.bodyParts };
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    const part = bodyParts[loc];
    if (!part) continue;
    bodyParts[loc] = { ...part, status: statusFromInjuries(part.injuries) };
  }
  return { ...char, bodyParts: bodyParts as FalloutCharacter["bodyParts"] };
}

function recomputeEncumbrance(char: FalloutCharacter): FalloutCharacter {
  let total = 0;
  for (const item of char.items) {
    if ((item as any).stashed) continue;
    if (item.type === "apparel" && item.apparelType === "powerArmor" && item.powered) continue;
    const qty = (item as any).quantity ?? 1;
    total += item.weight * qty;
  }
  const carryWeightCurrent = Math.round(total * 100) / 100;
  const encumbranceLevel = calculateEncumbranceLevel(carryWeightCurrent, char.carryWeightMax);
  return { ...char, carryWeightCurrent, encumbranceLevel };
}

export function recalculateFalloutDerived(character: FalloutCharacter): FalloutCharacter {
  let char = migrateLegacyFields(character);
  char = recomputeBodyResistances(char);
  char = recomputeBodyStatus(char);

  const { end, luc, per, agi, str } = char.attributes;
  const hpMax = calculateMaxHp(end, luc, char.level);
  const effectiveMax = Math.max(0, hpMax - Math.max(0, char.radiation));
  const hpCurrent = Math.min(char.hpCurrent, effectiveMax);
  const defense = calculateDefense(agi);
  const initiative = calculateInitiative(per, agi);
  const meleeDamageBonus = calculateMeleeDamageBonus(str);
  const carryWeightMax = calculateCarryWeightMax(str);

  char = { ...char, hpMax, hpCurrent, defense, initiative, meleeDamageBonus, carryWeightMax };
  char = recomputeEncumbrance(char);
  return char;
}
