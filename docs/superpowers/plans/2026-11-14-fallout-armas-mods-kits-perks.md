# Fase 4a.1 — Armas, Mods, Kits e Perks: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar armas funcionais (equipar/atirar/mods), conceder kits iniciais por origem, e impor limites/filtros de perks.

**Architecture:** Tipos estendidos em types.ts, funções puras em rules.ts, mapper atualizado em itemCatalog.ts, kits em origins.ts. UI consome via PATCH existente. Sem novas rotas ou migrations (dados no JSONB items).

**Tech Stack:** TypeScript, React 19, Zod 4, Vitest 2.1.9, @testing-library/react, lucide-react, Tailwind

**Spec:** docs/superpowers/specs/2026-11-14-fallout-armas-mods-kits-perks-design.md

## Global Constraints

- DATABASE_URL é Postgres remoto compartilhado — sem migration nova
- Sem novas rotas API — tudo via PATCH existente
- lucide-react para ícones (Crosshair, Wrench)
- PT-BR em labels e mensagens
- Commit: HUSKY=0 git commit --no-verify, stage by name
- Worktree: C:\Users\kyone\.qoder\worktrees\app\01c570\libmork
- Edit/Write strip trailing newline → printf '\n' >> file após criar

---

### Task 1: Types, Validators e Origins Schema

**Files:**
- Modify: `src/lib/systems/fallout/types.ts:183-256`
- Modify: `src/lib/systems/fallout/validators.ts:78-106`
- Modify: `src/lib/systems/fallout/origins.ts:9-30`

**Interfaces:**
- Consumes: existing FalloutSkillName, FalloutWeaponQuality
- Produces: `FalloutWeaponItem` with `skill`, `stashed`, `installedMods`; `FalloutModItem` interface; `FalloutOriginConfig.startingItems`; `createFalloutCharacterSchema.items`

- [ ] **Step 1: Extend FalloutWeaponItem in types.ts**

Add after `equipped: boolean;` (line 197):

```typescript
  skill: FalloutSkillName;
  stashed: boolean;
  installedMods: string[];
```

Add import of FalloutSkillName at top if not already imported (it is — used in FalloutCharacter).

- [ ] **Step 2: Add FalloutModItem interface and update union**

Replace the generic branch in FalloutItem union (lines 241-256):

```typescript
export interface FalloutModItem {
  id: string;
  name: string;
  type: "mod";
  description?: string;
  quantity: number;
  weight: number;
  costCaps: number;
  stashed: boolean;
  modTarget: "weapon" | "apparel";
  modEffects: {
    damageBonus?: number;
    qualitiesAdd?: FalloutWeaponQuality[];
    qualitiesRemove?: FalloutWeaponQuality[];
    fireRateBonus?: number;
    weightDelta?: number;
  };
}

export type FalloutItem =
  | FalloutWeaponItem
  | FalloutApparelItem
  | FalloutConsumableItem
  | FalloutAmmoItem
  | FalloutModItem
  | {
      id: string;
      name: string;
      type: "perk" | "miscellany";
      description?: string;
      quantity?: number;
      weight: number;
      costCaps: number;
      equipped?: boolean;
      stashed?: boolean;
    };
```

- [ ] **Step 3: Add startingItems to FalloutOriginConfig**

In origins.ts, add to the interface after `fixedCarryWeight?: number;`:

```typescript
  startingItems: Array<{
    sourceKey: string;
    name: string;
    quantity?: number;
  }>;
```

Add `startingItems: []` to every existing origin config (vault_dweller, wastelander, brotherhood_initiate, ghoul, super_mutant, mister_handy, survivor). Task 4 will populate the real kits.

- [ ] **Step 4: Add items field to createFalloutCharacterSchema**

In validators.ts, add after `caps: z.number().int().min(0).default(0),`:

```typescript
  items: z.array(z.any()).default([]),
```

- [ ] **Step 5: Fix compile errors in itemCatalog.ts**

The weapon branch (line 154-168) now needs `skill`, `stashed`, `installedMods`. Add:

```typescript
      skill: "small_guns",
      stashed: false,
      installedMods: [],
```

The generic fallback (line 218-225) now must exclude "mod". Change to:

```typescript
  if (type === "mod") {
    const pack = typeof sd.pack === "string" ? sd.pack : "";
    return {
      ...base,
      type: "mod",
      description: item.description ?? undefined,
      quantity: asNumber(sd.quantity, 1),
      stashed: false,
      modTarget: pack === "weapon_mods" ? "weapon" : "apparel",
      modEffects: {},
    };
  }

  return {
    ...base,
    type: type as "miscellany",
    description: item.description ?? undefined,
    quantity: asNumber(sd.quantity, 1),
    equipped: false,
    stashed: false,
  };
```

- [ ] **Step 6: Fix compile errors in derived.ts and rules.ts**

In derived.ts `migrateLegacyFields`, add migration for weapons:

```typescript
    if (migrated.type === "weapon") {
      if (migrated.skill === undefined) migrated.skill = "small_guns";
      if (migrated.stashed === undefined) migrated.stashed = false;
      if (migrated.installedMods === undefined) migrated.installedMods = [];
    }
```

In rules.ts `createInitialFalloutCharacter`, the base.items is `[]` — no change needed since items come from input now.

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors (fix any remaining type issues in PipBoySheet.tsx if the generic "mod" branch removal breaks something).

- [ ] **Step 8: Commit**

```bash
git add src/lib/systems/fallout/types.ts src/lib/systems/fallout/validators.ts src/lib/systems/fallout/origins.ts src/lib/systems/fallout/itemCatalog.ts src/lib/systems/fallout/derived.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): tipos weapon skill/stashed/installedMods, FalloutModItem, origins startingItems"
```

---

### Task 2: Rules Engine — Perk Limit, Mod Apply/Remove, Starting Items

**Files:**
- Modify: `src/lib/systems/fallout/rules.ts`
- Test: `src/lib/systems/fallout/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `FalloutWeaponItem`, `FalloutModItem`, `FalloutOrigin`, `FALLOUT_ORIGIN_CONFIGS` from origins, `catalogItemToFalloutItem` + `CatalogItem` from itemCatalog
- Produces: `getMaxFalloutPerks(level: number): number`, `applyModToWeapon(weapon, mod): FalloutWeaponItem`, `removeModFromWeapon(weapon, mod): FalloutWeaponItem`, `resolveStartingItems(origin, catalogLookup): FalloutItem[]`

- [ ] **Step 1: Write failing tests**

Append to rules.test.ts:

```typescript
import { getMaxFalloutPerks, applyModToWeapon, removeModFromWeapon, resolveStartingItems } from "../rules";

describe("getMaxFalloutPerks", () => {
  it("nivel 1 e 2 permitem 1 perk", () => {
    expect(getMaxFalloutPerks(1)).toBe(1);
    expect(getMaxFalloutPerks(2)).toBe(1);
  });

  it("nivel 3 e 4 permitem 2 perks", () => {
    expect(getMaxFalloutPerks(3)).toBe(2);
    expect(getMaxFalloutPerks(4)).toBe(2);
  });

  it("nivel 5 permite 3 perks", () => {
    expect(getMaxFalloutPerks(5)).toBe(3);
  });
});

describe("applyModToWeapon / removeModFromWeapon", () => {
  const weapon: any = {
    id: "w1", name: "10mm", type: "weapon", damageDiceRating: 4,
    damageType: "physical", damageEffects: [], qualities: ["reliable"],
    ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close",
    weight: 4, costCaps: 50, equipped: true, skill: "small_guns",
    stashed: false, installedMods: [],
  };
  const mod: any = {
    id: "m1", name: "Long Barrel", type: "mod", quantity: 1,
    weight: 1, costCaps: 20, stashed: false, modTarget: "weapon",
    modEffects: { damageBonus: 1, fireRateBonus: -1, qualitiesAdd: ["accurate"], weightDelta: 1 },
  };

  it("aplica bonus de dano, fire rate, qualities e peso", () => {
    const result = applyModToWeapon(weapon, mod);
    expect(result.damageDiceRating).toBe(5);
    expect(result.fireRate).toBe(1);
    expect(result.qualities).toContain("accurate");
    expect(result.qualities).toContain("reliable");
    expect(result.weight).toBe(5);
    expect(result.installedMods).toEqual(["m1"]);
  });

  it("remove mod reverte efeitos", () => {
    const modded = applyModToWeapon(weapon, mod);
    const result = removeModFromWeapon(modded, mod);
    expect(result.damageDiceRating).toBe(4);
    expect(result.fireRate).toBe(2);
    expect(result.qualities).toEqual(["reliable"]);
    expect(result.weight).toBe(4);
    expect(result.installedMods).toEqual([]);
  });

  it("qualitiesRemove remove qualidade existente", () => {
    const removeMod: any = { ...mod, id: "m2", modEffects: { qualitiesRemove: ["reliable"] } };
    const result = applyModToWeapon(weapon, removeMod);
    expect(result.qualities).not.toContain("reliable");
  });

  it("fireRate nao fica negativo", () => {
    const bigMod: any = { ...mod, modEffects: { fireRateBonus: -10 } };
    const result = applyModToWeapon(weapon, bigMod);
    expect(result.fireRate).toBe(0);
  });
});

describe("resolveStartingItems", () => {
  it("retorna array vazio para mister_handy", () => {
    const items = resolveStartingItems("mister_handy", () => null);
    expect(items).toEqual([]);
  });

  it("usa fallback quando catalogLookup retorna null", () => {
    const items = resolveStartingItems("vault_dweller", () => null);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].name).toBeTruthy();
  });

  it("usa catalogo quando disponivel", () => {
    const fakeCatalog = {
      id: "cat-1", name: "10mm Pistol", description: null,
      qualityDescription: null, imageUrl: null,
      sourceKey: "fallout:weapons:10mm_pistol",
      sourceData: { pack: "weapons", weight: 4, cost: 50, damage: { rating: 4 } },
    };
    const items = resolveStartingItems("vault_dweller", (key) =>
      key === "fallout:weapons:10mm_pistol" ? fakeCatalog : null,
    );
    const pistol = items.find((i) => i.name === "10mm Pistol");
    expect(pistol).toBeTruthy();
    expect(pistol!.type).toBe("weapon");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/systems/fallout/__tests__/rules.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement functions in rules.ts**

Add imports at top:

```typescript
import { FALLOUT_ORIGIN_CONFIGS } from "./origins";
import { catalogItemToFalloutItem, type CatalogItem } from "./itemCatalog";
import type { FalloutModItem, FalloutWeaponItem } from "./types";
```

Add functions:

```typescript
export function getMaxFalloutPerks(level: number): number {
  return Math.ceil(Math.max(1, level) / 2);
}

export function applyModToWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem {
  const fx = mod.modEffects;
  const qualitiesAdd = fx.qualitiesAdd ?? [];
  const qualitiesRemove = new Set(fx.qualitiesRemove ?? []);
  return {
    ...weapon,
    damageDiceRating: weapon.damageDiceRating + (fx.damageBonus ?? 0),
    fireRate: Math.max(0, weapon.fireRate + (fx.fireRateBonus ?? 0)),
    weight: weapon.weight + (fx.weightDelta ?? 0),
    qualities: [...new Set([...weapon.qualities.filter((q) => !qualitiesRemove.has(q)), ...qualitiesAdd])],
    installedMods: [...weapon.installedMods, mod.id],
  };
}

export function removeModFromWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem {
  const fx = mod.modEffects;
  const qualitiesAdd = new Set(fx.qualitiesAdd ?? []);
  const qualitiesRemove = fx.qualitiesRemove ?? [];
  return {
    ...weapon,
    damageDiceRating: weapon.damageDiceRating - (fx.damageBonus ?? 0),
    fireRate: Math.max(0, weapon.fireRate - (fx.fireRateBonus ?? 0)),
    weight: weapon.weight - (fx.weightDelta ?? 0),
    qualities: [...weapon.qualities.filter((q) => !qualitiesAdd.has(q)), ...qualitiesRemove],
    installedMods: weapon.installedMods.filter((id) => id !== mod.id),
  };
}

export function resolveStartingItems(
  origin: FalloutOrigin,
  catalogLookup: (sourceKey: string) => CatalogItem | null,
): FalloutItem[] {
  const config = FALLOUT_ORIGIN_CONFIGS[origin];
  const items: FalloutItem[] = [];
  for (const entry of config.startingItems) {
    const catalogItem = catalogLookup(entry.sourceKey);
    let item: FalloutItem;
    if (catalogItem) {
      item = catalogItemToFalloutItem(catalogItem);
    } else {
      item = {
        id: `starting-${entry.sourceKey}-${Date.now()}`,
        name: entry.name,
        type: "miscellany",
        weight: 0,
        costCaps: 0,
        quantity: entry.quantity ?? 1,
      } as FalloutItem;
    }
    if (entry.quantity && (item.type === "ammo" || item.type === "consumable" || item.type === "mod")) {
      (item as any).quantity = entry.quantity;
    }
    items.push(item);
  }
  return items;
}
```

Note: `FalloutOrigin` import already exists via types. Add it to the type import if needed.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/systems/fallout/__tests__/rules.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/systems/fallout/rules.ts src/lib/systems/fallout/__tests__/rules.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): getMaxFalloutPerks, applyMod/removeMod, resolveStartingItems"
```

---

### Task 3: Item Catalog — Skill Mapping e Mod Effects

**Files:**
- Modify: `src/lib/systems/fallout/itemCatalog.ts:154-226`
- Test: `src/lib/systems/fallout/__tests__/itemCatalog.test.ts`

**Interfaces:**
- Consumes: `FalloutSkillName`, `FalloutModItem` from types (Task 1)
- Produces: weapon items with correct `skill`; mod items with populated `modEffects`

- [ ] **Step 1: Write failing tests**

Append to itemCatalog.test.ts:

```typescript
describe("catalogItemToFalloutItem — weapon skill mapping", () => {
  it("arma de energia recebe energy_weapons", () => {
    const item = catalogItemToFalloutItem(catalogItem({
      sourceData: { pack: "weapons", damage: { rating: 3, damageType: { energy: true } } },
    }));
    if (item.type !== "weapon") throw new Error("esperava arma");
    expect(item.skill).toBe("energy_weapons");
  });

  it("arma corpo a corpo sem ammo recebe melee_weapons", () => {
    const item = catalogItemToFalloutItem(catalogItem({
      sourceData: { pack: "weapons", range: "close", damage: { rating: 3 } },
    }));
    if (item.type !== "weapon") throw new Error("esperava arma");
    expect(item.skill).toBe("melee_weapons");
  });

  it("sourceData.skill explicito tem prioridade", () => {
    const item = catalogItemToFalloutItem(catalogItem({
      sourceData: { pack: "weapons", skill: "big_guns", damage: { rating: 6 } },
    }));
    if (item.type !== "weapon") throw new Error("esperava arma");
    expect(item.skill).toBe("big_guns");
  });
});

describe("catalogItemToFalloutItem — mod effects", () => {
  it("weapon_mods extrai damageBonus e qualitiesAdd", () => {
    const item = catalogItemToFalloutItem(catalogItem({
      sourceData: {
        pack: "weapon_mods",
        damage: { rating: 1 },
        weaponQuality: { accurate: { rank: 1, value: 0 } },
        weight: 1,
      },
    }));
    expect(item.type).toBe("mod");
    if (item.type !== "mod") throw new Error("esperava mod");
    expect(item.modTarget).toBe("weapon");
    expect(item.modEffects.damageBonus).toBe(1);
    expect(item.modEffects.qualitiesAdd).toContain("accurate");
  });

  it("apparel_mods recebe modTarget apparel", () => {
    const item = catalogItemToFalloutItem(catalogItem({
      sourceData: { pack: "apparel_mods" },
    }));
    if (item.type !== "mod") throw new Error("esperava mod");
    expect(item.modTarget).toBe("apparel");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/systems/fallout/__tests__/itemCatalog.test.ts`
Expected: FAIL — skill undefined, modEffects empty.

- [ ] **Step 3: Implement skill mapping in weapon branch**

Add a helper function before `catalogItemToFalloutItem`:

```typescript
const VALID_SKILLS = new Set<string>(FALLOUT_SKILLS);

function pickWeaponSkill(sd: Record<string, unknown>, damageType: FalloutDamageType, qualities: string[], range: string, ammoType: string | undefined): FalloutSkillName {
  if (typeof sd.skill === "string" && VALID_SKILLS.has(sd.skill)) return sd.skill as FalloutSkillName;
  if (damageType === "energy") return "energy_weapons";
  if (qualities.includes("thrown")) return "throwing";
  if (qualities.includes("two_handed") && asNumber(asRecord(sd.damage).rating) >= 5) return "big_guns";
  if (range === "close" && !ammoType) return "melee_weapons";
  return "small_guns";
}
```

Add import of `FALLOUT_SKILLS` and `FalloutSkillName` from types.

In the weapon branch, compute qualities first, then:

```typescript
  if (type === "weapon") {
    const damage = asRecord(sd.damage);
    const damageType = pickDamageType(damage.damageType);
    const qualities = activeKeys(damage.weaponQuality, QUALITY_SET) as FalloutWeaponQuality[];
    const ammoType = typeof sd.ammo === "string" && sd.ammo ? sd.ammo : undefined;
    const range = pickRange(sd.range);
    return {
      ...base,
      type: "weapon",
      damageDiceRating: asNumber(damage.rating),
      damageType,
      damageEffects: activeKeys(damage.damageEffect, EFFECT_SET, DAMAGE_EFFECT_ALIASES) as FalloutDamageEffect[],
      qualities,
      ammoType,
      ammoPerShot: asNumber(sd.ammoPerShot, 1),
      fireRate: asNumber(sd.fireRate),
      range,
      equipped: false,
      skill: pickWeaponSkill(sd, damageType, qualities, range, ammoType),
      stashed: false,
      installedMods: [],
    };
  }
```

- [ ] **Step 4: Implement mod effects extraction**

Replace the mod branch (from Task 1 Step 5):

```typescript
  if (type === "mod") {
    const pack = typeof sd.pack === "string" ? sd.pack : "";
    const damage = asRecord(sd.damage);
    const qualitiesAdd = activeKeys(sd.weaponQuality, QUALITY_SET) as FalloutWeaponQuality[];
    return {
      ...base,
      type: "mod",
      description: item.description ?? undefined,
      quantity: asNumber(sd.quantity, 1),
      stashed: false,
      modTarget: pack === "weapon_mods" ? "weapon" : "apparel",
      modEffects: {
        damageBonus: asNumber(damage.rating) || undefined,
        qualitiesAdd: qualitiesAdd.length > 0 ? qualitiesAdd : undefined,
        fireRateBonus: asNumber(sd.fireRate) || undefined,
        weightDelta: asNumber(sd.weight) || undefined,
      },
    };
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/systems/fallout/__tests__/itemCatalog.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/systems/fallout/itemCatalog.ts src/lib/systems/fallout/__tests__/itemCatalog.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): mapper skill por tipo de arma e modEffects para weapon_mods"
```

---

### Task 4: Origin Kits Data + createInitial Integration

**Files:**
- Modify: `src/lib/systems/fallout/origins.ts`
- Modify: `src/lib/systems/fallout/rules.ts` (createInitialFalloutCharacter)
- Modify: `src/lib/server/fallout-service.ts` (createFalloutCharacterRecord)
- Test: `src/lib/systems/fallout/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `resolveStartingItems` (Task 2), `FALLOUT_ORIGIN_CONFIGS.startingItems` (Task 1)
- Produces: populated kits per origin; `createInitialFalloutCharacter` accepts `startingItems` in input

- [ ] **Step 1: Populate startingItems in origins.ts**

Replace `startingItems: []` in each origin:

```typescript
// vault_dweller
startingItems: [
  { sourceKey: "fallout:apparel:vault_suit", name: "Vault Suit" },
  { sourceKey: "fallout:weapons:10mm_pistol", name: "10mm Pistol" },
  { sourceKey: "fallout:ammunition:10mm_round", name: "10mm Round", quantity: 20 },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
],

// wastelander
startingItems: [
  { sourceKey: "fallout:weapons:pipe_gun", name: "Pipe Gun" },
  { sourceKey: "fallout:ammunition:38_round", name: ".38 Round", quantity: 20 },
  { sourceKey: "fallout:apparel:wastelander_outfit", name: "Wastelander Outfit" },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
],

// brotherhood_initiate
startingItems: [
  { sourceKey: "fallout:apparel:brotherhood_fatigues", name: "Brotherhood Fatigues" },
  { sourceKey: "fallout:weapons:laser_pistol", name: "Laser Pistol" },
  { sourceKey: "fallout:ammunition:energy_cell", name: "Energy Cell", quantity: 20 },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
],

// ghoul
startingItems: [
  { sourceKey: "fallout:apparel:wastelander_outfit", name: "Wastelander Outfit" },
  { sourceKey: "fallout:weapons:pipe_gun", name: "Pipe Gun" },
  { sourceKey: "fallout:ammunition:38_round", name: ".38 Round", quantity: 20 },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
  { sourceKey: "fallout:consumables:radaway", name: "RadAway", quantity: 2 },
],

// super_mutant
startingItems: [
  { sourceKey: "fallout:apparel:super_mutant_armor", name: "Super Mutant Armor" },
  { sourceKey: "fallout:weapons:hunting_rifle", name: "Hunting Rifle" },
  { sourceKey: "fallout:ammunition:308_round", name: ".308 Round", quantity: 20 },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
],

// mister_handy
startingItems: [],

// survivor
startingItems: [
  { sourceKey: "fallout:weapons:pipe_gun", name: "Pipe Gun" },
  { sourceKey: "fallout:ammunition:38_round", name: ".38 Round", quantity: 20 },
  { sourceKey: "fallout:apparel:wastelander_outfit", name: "Wastelander Outfit" },
  { sourceKey: "fallout:consumables:stimpak", name: "Stimpak", quantity: 2 },
],
```

- [ ] **Step 2: Accept items in createInitialFalloutCharacter**

In rules.ts, change the base.items line from `items: [],` to:

```typescript
    items: input.items ?? [],
```

The `CreateFalloutCharacterInput` now has `items` from the validator (Task 1 Step 4).

- [ ] **Step 3: Pass items through in fallout-service.ts**

In `createFalloutCharacterRecord`, the `initial.items` already flows from `createInitialFalloutCharacter(input, ownerId)`. The insert already has `items: initial.items`. No change needed — verify it compiles.

- [ ] **Step 4: Write test for createInitial with items**

Append to rules.test.ts:

```typescript
describe("createInitialFalloutCharacter com startingItems", () => {
  it("inclui items do input no personagem", () => {
    const char = createInitialFalloutCharacter(
      {
        name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
        tagSkills: [], perks: [], caps: 50,
        items: [{ id: "x1", name: "10mm Pistol", type: "weapon", weight: 4, costCaps: 50, damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 2, range: "close", equipped: false, skill: "small_guns", stashed: false, installedMods: [] }],
      } as any,
      "user-1",
    );
    expect(char.items).toHaveLength(1);
    expect(char.items[0].name).toBe("10mm Pistol");
  });
});
```

- [ ] **Step 5: Run tests + tsc**

Run: `npx vitest run src/lib/systems/fallout/__tests__/rules.test.ts && npx tsc --noEmit`
Expected: all PASS, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/systems/fallout/origins.ts src/lib/systems/fallout/rules.ts src/lib/systems/fallout/__tests__/rules.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): kits de equipamento inicial por origem e createInitial aceita items"
```

---

### Task 5: PipBoySheet — Weapon Actions + Mod UI

**Files:**
- Modify: `src/components/systems/fallout/PipBoySheet.tsx`
- Test: `src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`

**Interfaces:**
- Consumes: `applyModToWeapon`, `removeModFromWeapon` (Task 2); `FalloutModItem`, weapon.skill (Task 1); `FALLOUT_SKILL_CONFIGS` (existing)
- Produces: weapon equip/stash/shoot buttons; mod install/remove UI

- [ ] **Step 1: Write failing tests**

Append to PipBoySheet.test.tsx:

```typescript
describe("PipBoySheet INV — acoes de arma", () => {
  function buildCharWithWeapon(overrides: any = {}): any {
    const char = createInitialFalloutCharacter(
      { name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0 },
      "user-1", "char-test",
    );
    char.items = [{
      id: "w-1", name: "10mm Pistol", type: "weapon",
      damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [],
      ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close",
      weight: 4, costCaps: 50, equipped: false, skill: "small_guns",
      stashed: false, installedMods: [],
      ...overrides,
    }];
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("equipar arma chama onUpdateCharacter com equipped:true", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithWeapon()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "w-1", equipped: true })],
    }));
  });

  it("equipar segunda arma desequipa a primeira", () => {
    const onUpdate = vi.fn();
    const char = buildCharWithWeapon({ equipped: true });
    char.items.push({ ...char.items[0], id: "w-2", name: "Laser Pistol", equipped: false });
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-2").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.items.find((i: any) => i.id === "w-1").equipped).toBe(false);
    expect(patch.items.find((i: any) => i.id === "w-2").equipped).toBe(true);
  });

  it("botao Atirar visivel somente quando equipada", () => {
    render(<PipBoySheet character={buildCharWithWeapon({ equipped: true })} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    expect(screen.getByRole("button", { name: /Atirar/ })).toBeTruthy();
  });
});

describe("PipBoySheet INV — mods", () => {
  function buildCharWithMod(): any {
    const char = createInitialFalloutCharacter(
      { name: "Test", origin: "vault_dweller", level: 1, xp: 0,
        attributes: { str: 6, per: 8, end: 7, cha: 5, int: 6, agi: 9, luc: 6 },
        tagSkills: [], perks: [], caps: 0 },
      "user-1", "char-test",
    );
    char.items = [
      { id: "w-1", name: "10mm", type: "weapon", damageDiceRating: 4, damageType: "physical", damageEffects: [], qualities: [], ammoType: "10mm", ammoPerShot: 1, fireRate: 2, range: "close", weight: 4, costCaps: 50, equipped: true, skill: "small_guns", stashed: false, installedMods: [] },
      { id: "m-1", name: "Long Barrel", type: "mod", quantity: 1, weight: 1, costCaps: 20, stashed: false, modTarget: "weapon", modEffects: { damageBonus: 1 } },
    ];
    return char;
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it("instalar mod aplica efeito e remove do inventario", () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithMod()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Instalar Mod/ }));
    fireEvent.click(screen.getByRole("button", { name: /Long Barrel/ }));
    const patch = onUpdate.mock.calls[0][0];
    const weapon = patch.items.find((i: any) => i.id === "w-1");
    expect(weapon.damageDiceRating).toBe(5);
    expect(weapon.installedMods).toContain("m-1");
    expect(patch.items.find((i: any) => i.id === "m-1")).toBeUndefined();
  });

  it("remover mod reverte efeito e devolve ao inventario", () => {
    const onUpdate = vi.fn();
    const char = buildCharWithMod();
    char.items[0].installedMods = ["m-1"];
    char.items[0].damageDiceRating = 5;
    char.items = [char.items[0]];
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    fireEvent.click(screen.getByTestId("item-row-w-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Remover Long Barrel/ }));
    const patch = onUpdate.mock.calls[0][0];
    const weapon = patch.items.find((i: any) => i.id === "w-1");
    expect(weapon.damageDiceRating).toBe(4);
    expect(weapon.installedMods).toEqual([]);
    expect(patch.items.find((i: any) => i.name === "Long Barrel")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`
Expected: FAIL — buttons not found.

- [ ] **Step 3: Implement weapon actions in PipBoySheet.tsx**

Add imports: `Crosshair, Wrench` to lucide block. Add `applyModToWeapon, removeModFromWeapon` to rules import. Add `FalloutModItem` to types import. Add `FALLOUT_SKILL_CONFIGS` (already imported).

Add state: `const [modPickerWeaponId, setModPickerWeaponId] = useState<string | null>(null);`

Add handlers after handleConsumeItem:

```typescript
const handleEquipWeapon = (itemId: string) => {
  if (readOnly || !onUpdateCharacter) return;
  const items = character.items.map((item) => {
    if (item.type !== "weapon") return item;
    if (item.id === itemId) return { ...item, equipped: !item.equipped };
    return { ...item, equipped: false };
  });
  onUpdateCharacter({ items });
};

const handleShootWeapon = (weapon: FalloutWeaponItem) => {
  const cfg = FALLOUT_SKILL_CONFIGS[weapon.skill];
  setRollerInitialAttr(cfg.defaultAttribute);
  setRollerInitialSkill(weapon.skill);
  setIsRollerOpen(true);
};

const handleInstallMod = (weaponId: string, modId: string) => {
  if (readOnly || !onUpdateCharacter) return;
  const weapon = character.items.find((i) => i.id === weaponId && i.type === "weapon") as FalloutWeaponItem | undefined;
  const mod = character.items.find((i) => i.id === modId && i.type === "mod") as FalloutModItem | undefined;
  if (!weapon || !mod) return;
  const updatedWeapon = applyModToWeapon(weapon, mod);
  const remainingMod = mod.quantity > 1 ? { ...mod, quantity: mod.quantity - 1 } : null;
  const items = character.items
    .map((i) => (i.id === weaponId ? updatedWeapon : i))
    .map((i) => (i.id === modId ? remainingMod : i))
    .filter(Boolean) as FalloutItem[];
  onUpdateCharacter({ items });
  setModPickerWeaponId(null);
};

const handleRemoveMod = (weaponId: string, modId: string) => {
  if (readOnly || !onUpdateCharacter) return;
  const weapon = character.items.find((i) => i.id === weaponId && i.type === "weapon") as FalloutWeaponItem | undefined;
  if (!weapon) return;
  const modEntry = character.items.find((i) => i.id === modId && i.type === "mod") as FalloutModItem | undefined;
  const mod: FalloutModItem = modEntry ?? { id: modId, name: modId, type: "mod", quantity: 1, weight: 0, costCaps: 0, stashed: false, modTarget: "weapon", modEffects: {} };
  const updatedWeapon = removeModFromWeapon(weapon, mod);
  const items = character.items.map((i) => (i.id === weaponId ? updatedWeapon : i));
  if (!modEntry) items.push({ ...mod, quantity: 1 });
  onUpdateCharacter({ items });
};
```

In the expanded item section, add weapon actions block (after consumable block, before the remove button):

```typescript
{canEdit && item.type === "weapon" && (
  <div className="flex flex-wrap gap-1.5">
    <button type="button" onClick={() => handleEquipWeapon(item.id)}
      aria-label={item.equipped ? "Desequipar" : "Equipar"}
      className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold cursor-pointer ${item.equipped ? "border-emerald-500 bg-emerald-950 text-emerald-300" : "border-emerald-800 bg-black/50 text-emerald-500 hover:border-emerald-500"}`}>
      {item.equipped ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {item.equipped ? "Desequipar" : "Equipar"}
    </button>
    <button type="button" onClick={() => handleToggleItemField(item.id, "stashed", !item.stashed)}
      aria-label={item.stashed ? "Recuperar" : "Guardar"}
      className="flex items-center gap-1 rounded border border-emerald-800 bg-black/50 px-2 py-1 text-[10px] font-bold text-emerald-500 hover:border-emerald-500 cursor-pointer">
      {item.stashed ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
      {item.stashed ? "Recuperar" : "Guardar"}
    </button>
    {item.equipped && (
      <button type="button" onClick={() => handleShootWeapon(item)}
        aria-label="Atirar"
        className="flex items-center gap-1 rounded border border-amber-500 bg-amber-950 px-2 py-1 text-[10px] font-bold text-amber-300 cursor-pointer">
        <Crosshair className="h-3 w-3" /> Atirar
      </button>
    )}
  </div>
)}
{canEdit && item.type === "weapon" && item.equipped && (
  <div className="space-y-1.5">
    {item.installedMods.length > 0 && (
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase text-emerald-300">Mods Instalados</span>
        {item.installedMods.map((modId) => {
          const modItem = character.items.find((i) => i.id === modId);
          const modName = modItem?.name ?? modId;
          return (
            <div key={modId} className="flex items-center justify-between text-[10px] text-emerald-400">
              <span>{modName}</span>
              <button type="button" onClick={() => handleRemoveMod(item.id, modId)}
                aria-label={`Remover ${modName}`}
                className="text-emerald-600 hover:text-red-400 cursor-pointer"><X className="h-3 w-3" /></button>
            </div>
          );
        })}
      </div>
    )}
    {modPickerWeaponId === item.id ? (
      <div className="space-y-1">
        {character.items.filter((i) => i.type === "mod" && i.modTarget === "weapon" && !i.stashed && !item.installedMods.includes(i.id)).map((mod) => (
          <button key={mod.id} type="button" onClick={() => handleInstallMod(item.id, mod.id)}
            aria-label={`Instalar ${mod.name}`}
            className="flex w-full items-center gap-1 rounded border border-emerald-800 bg-black/50 px-2 py-1 text-[10px] text-emerald-400 hover:border-emerald-500 cursor-pointer">
            <Wrench className="h-3 w-3" /> {mod.name}
          </button>
        ))}
        <button type="button" onClick={() => setModPickerWeaponId(null)}
          className="text-[10px] text-emerald-600 cursor-pointer">Cancelar</button>
      </div>
    ) : (
      <button type="button" onClick={() => setModPickerWeaponId(item.id)}
        aria-label="Instalar Mod"
        className="flex items-center gap-1 rounded border border-emerald-800 bg-black/50 px-2 py-1 text-[10px] font-bold text-emerald-500 hover:border-emerald-500 cursor-pointer">
        <Wrench className="h-3 w-3" /> Instalar Mod
      </button>
    )}
  </div>
)}
```

Note: For the "remover mod" test, the mod is NOT in inventory (already installed). The handler needs to reconstruct mod effects. Store installed mod data in a map or look up from a ref. Simpler approach: store `installedModsData: Record<string, FalloutModItem>` on the weapon? No — spec says `installedMods: string[]`. For removal, we need the mod's effects. Solution: keep the mod item in inventory with quantity 0 and a flag, OR store effects alongside. Simplest: when installing, DON'T remove the mod from items — set quantity to 0 and mark it. But the test expects it removed...

Better approach: store mod effects in a parallel field. Add to FalloutWeaponItem: `installedModsData?: Record<string, FalloutModItem["modEffects"]>`. This is optional and backwards-compatible. On install, save effects. On remove, read from there.

Actually, simplest fix for the test: the test has `char.items = [char.items[0]]` (mod removed from inventory). The handler `handleRemoveMod` already handles `modEntry` being undefined by creating a default mod with empty effects. But then damageDiceRating won't revert. We need to store the effects.

Add to types.ts FalloutWeaponItem: `installedModsData: Record<string, FalloutModItem["modEffects"]>;` (default {}). Update applyModToWeapon to also save: `installedModsData: { ...weapon.installedModsData, [mod.id]: mod.modEffects }`. Update removeModFromWeapon to read from `weapon.installedModsData[mod.id]` instead of `mod.modEffects`.

This changes Task 1 and Task 2 slightly — add the field in Task 1, use it in Task 2. The test for removeModFromWeapon passes the mod directly so it still works. The UI handler uses installedModsData.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/__tests__/PipBoySheet.test.tsx src/lib/systems/fallout/types.ts src/lib/systems/fallout/rules.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): equipar/atirar armas e instalar/remover mods na aba INV"
```

---

### Task 6: Wizard — Perk Limit, Filter, Kit Preview

**Files:**
- Modify: `src/components/systems/fallout/FalloutCharacterWizard.tsx`
- Test: `src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx` (create if not exists)

**Interfaces:**
- Consumes: `getMaxFalloutPerks` (Task 2), `getUnmetPerkRequirements` (existing), `FALLOUT_ORIGIN_CONFIGS.startingItems` (Task 4)
- Produces: enforced perk limit, hidden blocked perks, kit preview in Identity step

- [ ] **Step 1: Write failing tests**

Create or append to wizard test file. The wizard test needs the same SocketContext mock as PipBoySheet. Tests:

```typescript
describe("FalloutCharacterWizard — perk limit e filtro", () => {
  // Setup: render wizard, navigate to Perks step (step 3)
  // Mock useFalloutPerkCatalog to return 2 perks: one with requirements met, one blocked

  it("limita a 1 perk no nivel 1", async () => {
    // Add first perk → succeeds
    // Try add second → button disabled
  });

  it("oculta perks com requisitos nao atendidos por default", () => {
    // Blocked perk not in list
  });

  it("toggle mostrar bloqueadas revela perks com botao desabilitado", () => {
    // Click toggle → blocked perk appears, button disabled
  });
});

describe("FalloutCharacterWizard — kit preview", () => {
  it("mostra itens do kit ao selecionar origem", () => {
    // Select vault_dweller → see "10mm Pistol", "Stimpak ×2"
  });
});
```

Note: Full test code depends on the wizard's step navigation. The wizard uses `currentStep` state and next/prev buttons. Navigate by clicking "Próximo" 3 times to reach Perks step. Mock the catalog hook.

- [ ] **Step 2: Implement perk limit in StepPerks**

In StepPerks, add:

```typescript
const maxPerks = getMaxFalloutPerks(1);
const atLimit = selectedPerks.length >= maxPerks;
```

Update counter: `{selectedPerks.length}/{maxPerks} selecionada(s)`

Disable add button: `disabled={selected || atLimit}`
Disable custom add: `disabled={!customDraft.trim() || selectedNames.has(customDraft.trim()) || atLimit}`

Update info text: "Nível 1: máximo 1 perk. Perk customizado também conta."

Import `getMaxFalloutPerks` from rules.

- [ ] **Step 3: Implement perk filter + toggle in StepPerks**

Add state: `const [showBlocked, setShowBlocked] = useState(false);`

In visiblePerks filter, add:

```typescript
if (!showBlocked) {
  const reqs = getFalloutPerkRequirementText(perk.structuredEffects);
  const unmet = getUnmetPerkRequirements(reqs, data.attributes, 1);
  if (unmet.length > 0) return false;
}
```

Add toggle after attribute filter chips:

```typescript
<label className="flex items-center gap-1.5 text-[10px] text-emerald-500 cursor-pointer">
  <input type="checkbox" checked={showBlocked} onChange={(e) => setShowBlocked(e.target.checked)}
    className="accent-emerald-500" />
  Mostrar perks bloqueadas
</label>
```

Disable add button when unmet: `disabled={selected || atLimit || unmet.length > 0}`

- [ ] **Step 4: Implement kit preview in Identity step**

In the Identity step render (after origin selection), add:

```typescript
{originConfig.startingItems.length > 0 && (
  <div className="rounded border border-emerald-500/30 bg-black/60 p-2 space-y-1">
    <span className="text-[10px] font-bold uppercase text-emerald-300">Kit Inicial</span>
    <ul className="text-[10px] text-emerald-400 space-y-0.5">
      {originConfig.startingItems.map((entry) => (
        <li key={entry.sourceKey}>{entry.name}{entry.quantity ? ` ×${entry.quantity}` : ""}</li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 5: Wire startingItems into handleSubmit**

In handleSubmit, before the fetch, resolve items:

```typescript
const startingItems = resolveStartingItems(wizardData.origin, () => null);
```

Add `items: startingItems` to the JSON body. Import `resolveStartingItems` from rules.

Note: Using `() => null` means fallback items (miscellany). For proper catalog resolution, the wizard would need to fetch the catalog. Since the catalog hook is only in StepPerks, and the Identity step doesn't have it, use fallback for now. The items will be miscellany with correct names — the player can see them in INV. A future improvement can resolve via API at creation time server-side.

- [ ] **Step 6: Run tests + tsc**

Run: `npx vitest run src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/systems/fallout/FalloutCharacterWizard.tsx src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx
HUSKY=0 git commit --no-verify -m "feat(fallout): limite de perks, filtro por requisitos e preview de kit no wizard"
```

---

### Task 7: PerkPickerModal — Limit + Filter

**Files:**
- Modify: `src/components/systems/fallout/PipBoyPerkPickerModal.tsx`
- Test: `src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx` (create if not exists)

**Interfaces:**
- Consumes: `getMaxFalloutPerks` (Task 2), `getUnmetPerkRequirements` (existing)
- Produces: limit banner, hidden blocked perks, toggle

- [ ] **Step 1: Write failing tests**

```typescript
describe("PipBoyPerkPickerModal — limit e filtro", () => {
  it("mostra banner quando limite atingido", () => {
    // character.level=1, perks=["Action Boy"] → banner "Limite de perks atingido (1/1)"
  });

  it("oculta perks bloqueadas por default", () => {
    // perk requiring STR 8, character str=5 → not visible
  });
});
```

- [ ] **Step 2: Implement limit**

Add import: `getMaxFalloutPerks` from rules.

```typescript
const maxPerks = getMaxFalloutPerks(character.level);
const atLimit = ownedNames.size >= maxPerks;
```

Add banner before the list:

```typescript
{atLimit && (
  <div className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
    Limite de perks atingido ({ownedNames.size}/{maxPerks})
  </div>
)}
```

Disable all add buttons: `disabled={owned || atLimit || unmet.length > 0}`

- [ ] **Step 3: Implement filter + toggle**

Add state: `const [showBlocked, setShowBlocked] = useState(false);`

In visiblePerks filter:

```typescript
if (!showBlocked) {
  const reqs = getFalloutPerkRequirementText(perk.structuredEffects);
  const unmet = getUnmetPerkRequirements(reqs, character.attributes, character.level);
  if (unmet.length > 0) return false;
}
```

Add toggle checkbox after attribute chips (same pattern as wizard).

- [ ] **Step 4: Run tests + tsc**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/systems/fallout/PipBoyPerkPickerModal.tsx src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx
HUSKY=0 git commit --no-verify -m "feat(fallout): limite e filtro de perks no modal in-game"
```

---

### Task 8: Final Validation

**Files:**
- No new files; verification only.

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all pass, no regressions.

- [ ] **Step 3: ESLint on changed files**

Run: `npx eslint src/lib/systems/fallout/rules.ts src/lib/systems/fallout/itemCatalog.ts src/lib/systems/fallout/origins.ts src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/FalloutCharacterWizard.tsx src/components/systems/fallout/PipBoyPerkPickerModal.tsx --max-warnings=0`
Expected: 0 errors (pre-existing any warnings acceptable).

- [ ] **Step 4: Git status**

Run: `git status --short && git log --oneline -10`
Expected: clean worktree.

- [ ] **Step 5: Report**

Summary of commits, test count, features delivered.
