# Fase 4a — Inventário Vivo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inventory items mechanically functional — equip apparel recalculates resistances, consuming items heals HP/rads, encumbrance is derived, injuries have 3-slot treatment state, and ammo tracks shots.

**Architecture:** Server-side `recalculateFalloutDerived` runs on every PATCH (service layer). Client-side pure rules (`applyFalloutConsumable`) compute mutations before sending. No new API routes. Legacy sheets self-heal on first write via idempotent migration inside the recalc.

**Tech Stack:** TypeScript, Zod 4, Drizzle ORM (Postgres jsonb + integer columns), React 19, Vitest 2.1.9 + @testing-library/react, lucide-react, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-14-fallout-inventario-vivo-design.md`

## Global Constraints

- DATABASE_URL is shared remote Postgres — NEVER run migrations without explicit user authorization. Write migration SQL but do not execute.
- Work exclusively in the session worktree (`C:\Users\kyone\.qoder\worktrees\app\01c570\libmork`).
- Icons: lucide-react only (never emojis).
- UI: copy existing Pip-Boy theme classes verbatim (emerald/amber/red, font-mono, border-emerald-500/40, bg-black/70).
- Tests: Vitest + @testing-library; no new dependencies.
- Commits: PT-BR without accents, `HUSKY=0 git commit --no-verify`, stage files by name.
- Do NOT merge/push without explicit user request.
- Trailing newline: after Write/Edit, run `printf '\n' >> <file>` and verify with `tail -c 1 <file> | xxd`.
- Run focused tests: `npx vitest run <path> --reporter=verbose`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`.

---

### Task 1: Types, Validators, and DB Schema Foundation

**Files:**
- Modify: `src/lib/systems/fallout/types.ts:126-236`
- Modify: `src/lib/systems/fallout/validators.ts:43-51`
- Modify: `src/lib/db/schema.ts:937` (after carryWeightMax)
- Create: `drizzle/0028_fallout_encumbrance_columns.sql`
- Modify: `src/lib/systems/fallout/assets.ts:26-29`
- Test: `src/lib/systems/fallout/__tests__/validators.test.ts` (create or extend)

**Interfaces:**
- Consumes: nothing (foundation task)
- Produces:
  - `FalloutInjurySlot = 0 | 1 | 2`
  - `FalloutBodyPartStatus = "healthy" | "wounded" | "crippled"`
  - `FalloutBodyPart.injuries: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot]`
  - `FalloutBodyPart.status: FalloutBodyPartStatus`
  - `FalloutApparelItem.stashed: boolean`, `.powered: boolean`
  - `FalloutApparelItem.apparelType` includes `"clothing"`
  - `FalloutAmmoItem` interface (dedicated, with `shotsCurrent`, `shotsMax`, `stashed`)
  - `FalloutCharacter.carryWeightCurrent: number`, `.encumbranceLevel: number`
  - `FalloutItem` union includes `FalloutAmmoItem`
  - `falloutBodyPartSchema` accepts injuries as array OR number (legacy)
  - `getPaperdollPartState(injuries: number | [number, number, number]): PaperdollPartState`

- [ ] **Step 1: Update types.ts — injury slot, body part status, apparel fields, ammo interface, character fields**

In `src/lib/systems/fallout/types.ts`:

After line 124 (`export type FalloutBodyLocation = ...`), add:

```typescript
export type FalloutInjurySlot = 0 | 1 | 2;
export type FalloutBodyPartStatus = "healthy" | "wounded" | "crippled";
```

Replace the `FalloutBodyPart` interface (lines 126-134) with:

```typescript
export interface FalloutBodyPart {
  location: FalloutBodyLocation;
  label: string;
  minRoll: number;
  maxRoll: number;
  injuries: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot];
  status: FalloutBodyPartStatus;
  resistances: FalloutResistances;
}
```

Update `FALLOUT_DEFAULT_BODY_PARTS` Omit (line 138) to:

```typescript
export const FALLOUT_DEFAULT_BODY_PARTS: Record<
  FalloutBodyLocation,
  Omit<FalloutBodyPart, "injuries" | "status" | "resistances">
> = {
```

In `FalloutApparelItem` (line 197-207), change `apparelType` and add fields:

```typescript
export interface FalloutApparelItem {
  id: string;
  name: string;
  type: "apparel";
  apparelType: "outfit" | "armor" | "headgear" | "powerArmor" | "clothing";
  locationsCovered: FalloutBodyLocation[];
  resistances: FalloutResistances;
  weight: number;
  costCaps: number;
  equipped: boolean;
  stashed: boolean;
  powered: boolean;
}
```

After `FalloutConsumableItem` (line 221), add the dedicated ammo interface:

```typescript
export interface FalloutAmmoItem {
  id: string;
  name: string;
  type: "ammo";
  description?: string;
  quantity: number;
  weight: number;
  costCaps: number;
  shotsCurrent: number;
  shotsMax: number;
  stashed: boolean;
}
```

Replace the `FalloutItem` union (lines 223-236) with:

```typescript
export type FalloutItem =
  | FalloutWeaponItem
  | FalloutApparelItem
  | FalloutConsumableItem
  | FalloutAmmoItem
  | {
      id: string;
      name: string;
      type: "perk" | "miscellany" | "mod";
      description?: string;
      quantity?: number;
      weight: number;
      costCaps: number;
      equipped?: boolean;
      stashed?: boolean;
    };
```

In `FalloutCharacter` (after `carryWeightMax` line 278), add:

```typescript
  carryWeightCurrent: number;
  encumbranceLevel: number;
```

- [ ] **Step 2: Update assets.ts — getPaperdollPartState accepts array**

In `src/lib/systems/fallout/assets.ts`, replace lines 26-29:

```typescript
export function getPaperdollPartState(injuries: number | [number, number, number]): PaperdollPartState {
  const count = Array.isArray(injuries) ? Math.max(...injuries) : injuries;
  if (count >= 2) return "crippled";
  if (count > 0) return "wounded";
  return "healthy";
}
```

Note: the threshold changes from `>=3` to `>=2` because slot value 2 means "open injury" (crippled), not count 3.

- [ ] **Step 3: Update validators.ts — body part schema accepts legacy and new format**

In `src/lib/systems/fallout/validators.ts`, replace `falloutBodyPartSchema` (lines 43-51):

```typescript
export const falloutBodyPartSchema = z.object({
  location: falloutBodyLocationSchema,
  label: z.string(),
  minRoll: z.number().int().min(1).max(20),
  maxRoll: z.number().int().min(1).max(20),
  injuries: z.union([
    z.tuple([z.literal(0).or(z.literal(1)).or(z.literal(2)), z.literal(0).or(z.literal(1)).or(z.literal(2)), z.literal(0).or(z.literal(1)).or(z.literal(2))]),
    z.number().int().min(0).max(3),
  ]).default([0, 0, 0]),
  status: z.enum(["healthy", "wounded", "crippled"]).optional(),
  isCrippled: z.boolean().optional(),
  resistances: falloutResistancesSchema,
});
```

- [ ] **Step 4: Add DB columns to schema.ts**

In `src/lib/db/schema.ts`, after line 937 (`carryWeightMax`), add:

```typescript
    carryWeightCurrent: integer("carry_weight_current").notNull().default(0),
    encumbranceLevel: integer("encumbrance_level").notNull().default(0),
```

- [ ] **Step 5: Write migration SQL (DO NOT EXECUTE)**

Create `drizzle/0028_fallout_encumbrance_columns.sql`:

```sql
ALTER TABLE "fallout_characters" ADD COLUMN "carry_weight_current" integer DEFAULT 0 NOT NULL;
ALTER TABLE "fallout_characters" ADD COLUMN "encumbrance_level" integer DEFAULT 0 NOT NULL;
```

- [ ] **Step 6: Fix compile errors in existing code that references old types**

Run `npx tsc --noEmit 2>&1 | head -60` to identify breakages. Expected breaks:
- `rules.ts:initializeFalloutBodyParts` — uses `injuries: 0, isCrippled: false` → change to `injuries: [0, 0, 0], status: "healthy"`
- `PipBoyPaperdoll.tsx:toggleInjury` — uses `current.injuries >= 3` and `isCrippled` → will be rewritten in Task 6, for now make it compile with a temporary adapter
- `PipBoySheet.tsx` — references `part.injuries > 0 || part.isCrippled` → temporary adapter
- Any test fixtures using old shape

For `rules.ts:initializeFalloutBodyParts` (line 246-268), update the part construction:

```typescript
parts[loc] = {
  location: loc,
  label: meta.label,
  minRoll: meta.minRoll,
  maxRoll: meta.maxRoll,
  injuries: [0, 0, 0],
  status: "healthy",
  resistances: { physical: 0, energy: 0, radiation: 0, poison: 0 },
};
```

For `PipBoyPaperdoll.tsx`, temporarily adapt `toggleInjury` to compile (full rewrite in Task 6):

```typescript
const toggleInjury = (location: FalloutBodyLocation) => {
  if (readOnly || !onUpdateBodyPart) return;
  const current = bodyParts[location];
  const maxSlot = Math.max(...current.injuries);
  const next: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot] =
    maxSlot >= 2 ? [0, 0, 0] : [2, 0, 0];
  onUpdateBodyPart(location, { injuries: next, status: maxSlot >= 2 ? "healthy" : "crippled" });
};
```

Update `isInjured` check: `const isInjured = part.status !== "healthy";`
Update dots rendering to use array: `part.injuries[step - 1] > 0` instead of `step <= part.injuries`.
Update `getPaperdollPartState` call: pass `part.injuries` (now accepts array).

For `PipBoySheet.tsx`, find any `part.isCrippled` or `part.injuries > 0` references and replace with `part.status !== "healthy"`.

Add `FalloutInjurySlot` to the import from types in PipBoyPaperdoll.

- [ ] **Step 7: Run tsc and fix remaining errors**

Run: `npx tsc --noEmit`
Expected: 0 errors. Fix any remaining type mismatches in test fixtures (update `injuries: 0` → `injuries: [0,0,0]`, `isCrippled: false` → `status: "healthy"`).

- [ ] **Step 8: Run existing tests to confirm no regressions**

Run: `npx vitest run src/lib/systems/fallout/ src/components/systems/fallout/ --reporter=verbose`
Expected: all existing tests pass (some may need fixture updates from Step 7).

- [ ] **Step 9: Commit**

```bash
git add src/lib/systems/fallout/types.ts src/lib/systems/fallout/validators.ts src/lib/systems/fallout/assets.ts src/lib/db/schema.ts drizzle/0028_fallout_encumbrance_columns.sql src/lib/systems/fallout/rules.ts src/components/systems/fallout/PipBoyPaperdoll.tsx src/components/systems/fallout/PipBoySheet.tsx
git add -u  # catch test fixture updates
HUSKY=0 git commit --no-verify -m "feat(fallout): tipos e schema para inventario vivo — injuries array, ammo, stashed, powered, encumbrance"
```

---

### Task 2: Derived State Engine (`derived.ts`)

**Files:**
- Create: `src/lib/systems/fallout/derived.ts`
- Create: `src/lib/systems/fallout/__tests__/derived.test.ts`

**Interfaces:**
- Consumes: `FalloutCharacter`, `FalloutBodyPart`, `FalloutItem`, `FalloutApparelItem`, `FalloutAmmoItem`, `FalloutInjurySlot`, `FalloutBodyPartStatus`, `FALLOUT_BODY_LOCATIONS` from `./types`; `calculateMaxHp`, `calculateDefense`, `calculateInitiative`, `calculateMeleeDamageBonus`, `calculateCarryWeightMax`, `calculateEncumbranceLevel` from `./rules`
- Produces: `recalculateFalloutDerived(character: FalloutCharacter): FalloutCharacter` — the single entry point used by the service and createInitialFalloutCharacter.

- [ ] **Step 1: Write failing tests for migration**

Create `src/lib/systems/fallout/__tests__/derived.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { recalculateFalloutDerived } from "../derived";
import type { FalloutCharacter, FalloutBodyPart, FalloutItem } from "../types";
import { FALLOUT_BODY_LOCATIONS } from "../types";

function buildCharacter(overrides: Partial<FalloutCharacter> = {}): FalloutCharacter {
  const bodyParts = {} as Record<string, FalloutBodyPart>;
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    bodyParts[loc] = {
      location: loc,
      label: loc,
      minRoll: 1,
      maxRoll: 20,
      injuries: [0, 0, 0],
      status: "healthy",
      resistances: { physical: 0, energy: 0, radiation: 0, poison: 0 },
    };
  }
  return {
    id: "test-char",
    campaignId: null,
    ownerId: "owner",
    name: "Test",
    origin: "vault_dweller",
    level: 1,
    xp: 0,
    attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
    skills: {} as any,
    tagSkills: [],
    hpCurrent: 10,
    hpMax: 10,
    radiation: 0,
    luckPointsCurrent: 5,
    defense: 1,
    initiative: 10,
    meleeDamageBonus: 0,
    carryWeightMax: 200,
    carryWeightCurrent: 0,
    encumbranceLevel: 0,
    caps: 0,
    bodyParts: bodyParts as any,
    items: [],
    perks: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("recalculateFalloutDerived — migracao legada", () => {
  it("converte injuries number para array de slots abertos", () => {
    const char = buildCharacter();
    (char.bodyParts.torso as any).injuries = 2;
    delete (char.bodyParts.torso as any).status;
    (char.bodyParts.torso as any).isCrippled = true;
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.injuries).toEqual([2, 2, 0]);
    expect(result.bodyParts.torso.status).toBe("crippled");
  });

  it("converte injuries 0 para array saudavel", () => {
    const char = buildCharacter();
    (char.bodyParts.head as any).injuries = 0;
    delete (char.bodyParts.head as any).status;
    (char.bodyParts.head as any).isCrippled = false;
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.head.injuries).toEqual([0, 0, 0]);
    expect(result.bodyParts.head.status).toBe("healthy");
  });

  it("preenche stashed/powered ausentes em apparel legado", () => {
    const legacyApparel = {
      id: "a1", name: "Combat Armor", type: "apparel",
      apparelType: "armor", locationsCovered: ["torso"],
      resistances: { physical: 2, energy: 1, radiation: 0, poison: 0 },
      weight: 10, costCaps: 50, equipped: true,
    } as any;
    const char = buildCharacter({ items: [legacyApparel] });
    const result = recalculateFalloutDerived(char);
    const item = result.items[0] as any;
    expect(item.stashed).toBe(false);
    expect(item.powered).toBe(false);
  });

  it("preenche shots ausentes em ammo legado", () => {
    const legacyAmmo = {
      id: "am1", name: "10mm Round", type: "ammo",
      quantity: 20, weight: 0.1, costCaps: 1,
    } as any;
    const char = buildCharacter({ items: [legacyAmmo] });
    const result = recalculateFalloutDerived(char);
    const item = result.items[0] as any;
    expect(item.shotsMax).toBe(1);
    expect(item.shotsCurrent).toBe(1);
    expect(item.stashed).toBe(false);
  });

  it("e idempotente — segunda chamada nao altera o resultado", () => {
    const char = buildCharacter();
    (char.bodyParts.torso as any).injuries = 1;
    delete (char.bodyParts.torso as any).status;
    const first = recalculateFalloutDerived(char);
    const second = recalculateFalloutDerived(first);
    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/systems/fallout/__tests__/derived.test.ts --reporter=verbose`
Expected: FAIL — cannot resolve `../derived`.

- [ ] **Step 3: Write failing tests for resistances**

Append to `derived.test.ts`:

```typescript
describe("recalculateFalloutDerived — resistencias de apparel", () => {
  function apparel(overrides: Partial<any> = {}): any {
    return {
      id: `app-${Math.random().toString(36).slice(2)}`,
      name: "Test Armor",
      type: "apparel",
      apparelType: "armor",
      locationsCovered: ["torso", "armL", "armR", "legL", "legR"],
      resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 },
      weight: 10, costCaps: 50, equipped: true, stashed: false, powered: false,
      ...overrides,
    };
  }

  it("armor equipado aplica resistencias nas localizacoes cobertas", () => {
    const char = buildCharacter({ items: [apparel()] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(3);
    expect(result.bodyParts.torso.resistances.energy).toBe(2);
    expect(result.bodyParts.head.resistances.physical).toBe(0);
  });

  it("powerArmor energizada substitui armor normal", () => {
    const pa = apparel({
      apparelType: "powerArmor", powered: true,
      resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 },
      locationsCovered: ["head", "torso", "armL", "armR", "legL", "legR"],
    });
    const normal = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 } });
    const char = buildCharacter({ items: [normal, pa] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(8);
  });

  it("powerArmor NAO energizada nao aplica resistencias", () => {
    const pa = apparel({
      apparelType: "powerArmor", powered: false,
      resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 },
    });
    const char = buildCharacter({ items: [pa] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("outfit so aplica se nenhum armor/powerArmor cobriu torso/membros", () => {
    const outfit = apparel({
      apparelType: "outfit",
      resistances: { physical: 1, energy: 1, radiation: 0, poison: 0 },
    });
    const armor = apparel();
    const char = buildCharacter({ items: [outfit, armor] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(3);
  });

  it("outfit aplica quando nao ha armor", () => {
    const outfit = apparel({
      apparelType: "outfit",
      resistances: { physical: 1, energy: 1, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [outfit] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(1);
  });

  it("headgear so aplica em head", () => {
    const hat = apparel({
      apparelType: "headgear",
      locationsCovered: ["head"],
      resistances: { physical: 2, energy: 0, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [hat] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.head.resistances.physical).toBe(2);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("clothing faz Math.max com resistencia existente", () => {
    const armor = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 } });
    const cloth = apparel({
      apparelType: "clothing",
      resistances: { physical: 5, energy: 0, radiation: 0, poison: 0 },
    });
    const char = buildCharacter({ items: [armor, cloth] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(5);
    expect(result.bodyParts.torso.resistances.energy).toBe(2);
  });

  it("poison sempre fica 0 (armadura nunca contribui poison)", () => {
    const armor = apparel({ resistances: { physical: 3, energy: 2, radiation: 1, poison: 9 } });
    const char = buildCharacter({ items: [armor] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.poison).toBe(0);
  });

  it("apparel stashed nao aplica resistencias", () => {
    const char = buildCharacter({ items: [apparel({ stashed: true })] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });

  it("apparel nao equipado nao aplica resistencias", () => {
    const char = buildCharacter({ items: [apparel({ equipped: false })] });
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.resistances.physical).toBe(0);
  });
});
```

- [ ] **Step 4: Write failing tests for encumbrance and stat recalculation**

Append to `derived.test.ts`:

```typescript
describe("recalculateFalloutDerived — encumbrance", () => {
  it("calcula peso total de itens nao-stashed", () => {
    const items: FalloutItem[] = [
      { id: "w1", name: "Pistol", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 3, costCaps: 50, equipped: false },
      { id: "c1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 5, quantity: 3, weight: 0.5, costCaps: 25 },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(4.5);
    expect(result.encumbranceLevel).toBe(0);
  });

  it("exclui itens stashed do peso", () => {
    const items: any[] = [
      { id: "w1", name: "Heavy", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 100, costCaps: 50, equipped: false, stashed: true },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(0);
  });

  it("exclui powerArmor energizada do peso", () => {
    const items: any[] = [
      { id: "pa1", name: "T-60", type: "apparel", apparelType: "powerArmor", locationsCovered: ["torso"], resistances: { physical: 8, energy: 6, radiation: 5, poison: 0 }, weight: 80, costCaps: 500, equipped: true, stashed: false, powered: true },
    ];
    const char = buildCharacter({ items });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(0);
  });

  it("calcula encumbranceLevel quando excede capacidade", () => {
    const items: any[] = [
      { id: "w1", name: "Heavy", type: "weapon", damageDiceRating: 2, damageType: "physical", damageEffects: [], qualities: [], ammoPerShot: 1, fireRate: 1, range: "close", weight: 300, costCaps: 50, equipped: false },
    ];
    const char = buildCharacter({ items, carryWeightMax: 200 });
    const result = recalculateFalloutDerived(char);
    expect(result.carryWeightCurrent).toBe(300);
    expect(result.encumbranceLevel).toBe(2);
  });
});

describe("recalculateFalloutDerived — stats derivadas", () => {
  it("recalcula hpMax e cap hpCurrent", () => {
    const char = buildCharacter({
      attributes: { str: 5, per: 5, end: 7, cha: 5, int: 5, agi: 5, luc: 6 },
      level: 3, radiation: 2, hpCurrent: 99,
    });
    const result = recalculateFalloutDerived(char);
    expect(result.hpMax).toBe(15);
    expect(result.hpCurrent).toBe(13);
  });

  it("recalcula defense, initiative, meleeDamageBonus, carryWeightMax", () => {
    const char = buildCharacter({
      attributes: { str: 9, per: 7, end: 5, cha: 5, int: 5, agi: 10, luc: 5 },
    });
    const result = recalculateFalloutDerived(char);
    expect(result.defense).toBe(2);
    expect(result.initiative).toBe(17);
    expect(result.meleeDamageBonus).toBe(2);
    expect(result.carryWeightMax).toBe(240);
  });

  it("deriva bodyParts.status a partir do array de injuries", () => {
    const char = buildCharacter();
    char.bodyParts.torso.injuries = [0, 1, 0];
    char.bodyParts.head.injuries = [2, 0, 0];
    const result = recalculateFalloutDerived(char);
    expect(result.bodyParts.torso.status).toBe("wounded");
    expect(result.bodyParts.head.status).toBe("crippled");
    expect(result.bodyParts.armL.status).toBe("healthy");
  });
});
```

- [ ] **Step 5: Implement derived.ts**

Create `src/lib/systems/fallout/derived.ts`:

```typescript
import {
  FALLOUT_BODY_LOCATIONS,
  type FalloutApparelItem,
  type FalloutBodyLocation,
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
      i.type === "apparel" && i.equipped && !(i as any).stashed,
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/systems/fallout/__tests__/derived.test.ts --reporter=verbose`
Expected: all ~22 tests PASS.

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/systems/fallout/derived.ts src/lib/systems/fallout/__tests__/derived.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): motor de derivadas — migracao, resistencias, encumbrance, stats"
```

---

### Task 3: Consumable Rule + createInitial Delegation

**Files:**
- Modify: `src/lib/systems/fallout/rules.ts:338-374`
- Modify: `src/lib/systems/fallout/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `recalculateFalloutDerived` from `./derived` (Task 2); `FalloutCharacter`, `FalloutConsumableItem` from `./types`
- Produces: `applyFalloutConsumable(character: FalloutCharacter, itemId: string): FalloutCharacter | null`; `createInitialFalloutCharacter` now returns recalculated character with `carryWeightCurrent`, `encumbranceLevel`, `status` fields.

- [ ] **Step 1: Write failing tests for applyFalloutConsumable**

Append to `src/lib/systems/fallout/__tests__/rules.test.ts` (inside the top-level describe or as a new describe):

```typescript
describe("applyFalloutConsumable", () => {
  function charWithConsumable(overrides: any = {}): any {
    return {
      id: "c1", campaignId: null, ownerId: "o", name: "Test", origin: "vault_dweller",
      level: 1, xp: 0,
      attributes: { str: 5, per: 5, end: 5, cha: 5, int: 5, agi: 5, luc: 5 },
      skills: {}, tagSkills: [],
      hpCurrent: 5, hpMax: 10, radiation: 3, luckPointsCurrent: 5,
      defense: 1, initiative: 10, meleeDamageBonus: 0,
      carryWeightMax: 200, carryWeightCurrent: 0, encumbranceLevel: 0, caps: 0,
      bodyParts: {}, items: [
        { id: "item-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, radsCured: 0, quantity: 2, weight: 0.5, costCaps: 25 },
      ],
      perks: [], createdAt: "", updatedAt: "",
      ...overrides,
    };
  }

  it("cura HP capped em hpMax e decrementa quantity", () => {
    const result = applyFalloutConsumable(charWithConsumable(), "item-1");
    expect(result).not.toBeNull();
    expect(result!.hpCurrent).toBe(9);
    expect((result!.items[0] as any).quantity).toBe(1);
  });

  it("cap hpCurrent em hpMax", () => {
    const char = charWithConsumable({ hpCurrent: 9 });
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.hpCurrent).toBe(10);
  });

  it("cura radiacao com floor 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).radsCured = 10;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.radiation).toBe(0);
  });

  it("inflige radiacao", () => {
    const char = charWithConsumable();
    (char.items[0] as any).radsInflicted = 2;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.radiation).toBe(5);
  });

  it("remove item quando quantity chega a 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).quantity = 1;
    const result = applyFalloutConsumable(char, "item-1");
    expect(result!.items).toHaveLength(0);
  });

  it("retorna null para quantity 0", () => {
    const char = charWithConsumable();
    (char.items[0] as any).quantity = 0;
    expect(applyFalloutConsumable(char, "item-1")).toBeNull();
  });

  it("retorna null para item inexistente", () => {
    expect(applyFalloutConsumable(charWithConsumable(), "nope")).toBeNull();
  });

  it("retorna null para item que nao e consumable", () => {
    const char = charWithConsumable();
    char.items = [{ id: "w1", name: "Gun", type: "weapon", weight: 3, costCaps: 50 }];
    expect(applyFalloutConsumable(char, "w1")).toBeNull();
  });
});
```

Add the import at the top of the test file: `import { applyFalloutConsumable } from "../rules";` (alongside existing imports).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/systems/fallout/__tests__/rules.test.ts --reporter=verbose`
Expected: FAIL — `applyFalloutConsumable` is not exported.

- [ ] **Step 3: Implement applyFalloutConsumable in rules.ts**

Add after `normalizeFalloutPerk` / `adjustFalloutPerkRank` section (around line 310):

```typescript
export function applyFalloutConsumable(
  character: FalloutCharacter,
  itemId: string,
): FalloutCharacter | null {
  const index = character.items.findIndex((i) => i.id === itemId);
  if (index === -1) return null;
  const item = character.items[index];
  if (item.type !== "consumable") return null;
  if (item.quantity <= 0) return null;

  const hpCurrent = Math.min(character.hpMax, character.hpCurrent + (item.hpRestored ?? 0));
  const radiation = Math.max(0, character.radiation - (item.radsCured ?? 0)) + (item.radsInflicted ?? 0);
  const newQuantity = item.quantity - 1;

  const items = newQuantity <= 0
    ? character.items.filter((_, i) => i !== index)
    : character.items.map((it, i) => i === index ? { ...it, quantity: newQuantity } : it);

  return { ...character, hpCurrent, radiation, items };
}
```

Add `FalloutCharacter` to the type imports at the top of rules.ts if not already present.

- [ ] **Step 4: Update createInitialFalloutCharacter to delegate to recalculateFalloutDerived**

In `rules.ts`, add import at top:

```typescript
import { recalculateFalloutDerived } from "./derived";
```

Replace the return statement of `createInitialFalloutCharacter` (lines 348-374). Build the base object as before but with the new fields, then delegate:

```typescript
export function createInitialFalloutCharacter(
  input: CreateFalloutCharacterInput,
  ownerId: string,
  id?: string,
): FalloutCharacter {
  const charId = id || `fallout-char-${Date.now()}`;
  const now = new Date().toISOString();

  const base: FalloutCharacter = {
    id: charId,
    campaignId: input.campaignId || null,
    ownerId,
    name: input.name,
    origin: input.origin || "vault_dweller",
    level: input.level || 1,
    xp: input.xp || 0,
    attributes: { ...input.attributes },
    skills: initializeFalloutSkills(input.tagSkills),
    tagSkills: [...(input.tagSkills || [])],
    hpCurrent: 0,
    hpMax: 0,
    radiation: 0,
    luckPointsCurrent: input.attributes.luc,
    defense: 0,
    initiative: 0,
    meleeDamageBonus: 0,
    carryWeightMax: 0,
    carryWeightCurrent: 0,
    encumbranceLevel: 0,
    caps: input.caps || 0,
    bodyParts: initializeFalloutBodyParts(),
    items: [],
    perks: [...(input.perks || [])],
    createdAt: now,
    updatedAt: now,
  };

  const derived = recalculateFalloutDerived(base);
  return { ...derived, hpCurrent: derived.hpMax };
}
```

Note: `hpCurrent` is set to full after recalc (new character starts at max HP).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/systems/fallout/__tests__/rules.test.ts --reporter=verbose`
Expected: all PASS (existing tests for createInitialFalloutCharacter may need assertion updates for new fields — add `carryWeightCurrent: 0, encumbranceLevel: 0` to expected objects if they do deep equality).

- [ ] **Step 6: Run tsc + full Fallout suite**

Run: `npx tsc --noEmit && npx vitest run src/lib/systems/fallout/ --reporter=verbose`
Expected: 0 type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/systems/fallout/rules.ts src/lib/systems/fallout/__tests__/rules.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): applyFalloutConsumable e createInitial delega para derived"
```

---

### Task 4: Item Catalog Mapper Updates

**Files:**
- Modify: `src/lib/systems/fallout/itemCatalog.ts:127-209`
- Modify: `src/lib/systems/fallout/__tests__/itemCatalog.test.ts`

**Interfaces:**
- Consumes: `FalloutAmmoItem`, `FalloutApparelItem` (with `stashed`, `powered`, `clothing`) from `./types` (Task 1)
- Produces: `catalogItemToFalloutItem` returns `FalloutAmmoItem` for ammo (with shots), apparel with `stashed:false, powered:false`, clothing type recognized.

- [ ] **Step 1: Write failing tests**

Append to `src/lib/systems/fallout/__tests__/itemCatalog.test.ts`:

```typescript
describe("catalogItemToFalloutItem — ammo com shots", () => {
  it("popula shotsCurrent e shotsMax a partir de sourceData.shots", () => {
    const entry: CatalogItem = {
      id: "ammo-1", name: "10mm Round", description: null,
      qualityDescription: null, imageUrl: null, sourceKey: null,
      sourceData: { pack: "ammunition", weight: 0.1, cost: 1, quantity: 20, shots: { max: 30, current: 15 } },
    };
    const item = catalogItemToFalloutItem(entry);
    expect(item.type).toBe("ammo");
    expect((item as any).shotsMax).toBe(30);
    expect((item as any).shotsCurrent).toBe(15);
    expect((item as any).stashed).toBe(false);
  });

  it("usa defaults quando shots ausente", () => {
    const entry: CatalogItem = {
      id: "ammo-2", name: "Fusion Core", description: null,
      qualityDescription: null, imageUrl: null, sourceKey: null,
      sourceData: { pack: "ammunition", weight: 2, cost: 100, quantity: 1 },
    };
    const item = catalogItemToFalloutItem(entry);
    expect((item as any).shotsMax).toBe(1);
    expect((item as any).shotsCurrent).toBe(1);
  });
});

describe("catalogItemToFalloutItem — apparel stashed/powered/clothing", () => {
  it("popula stashed:false e powered:false em apparel", () => {
    const entry: CatalogItem = {
      id: "app-1", name: "Combat Armor", description: null,
      qualityDescription: null, imageUrl: null, sourceKey: null,
      sourceData: { pack: "apparel", apparelType: "armor", weight: 10, cost: 50, resistance: { physical: 3 }, location: { torso: true } },
    };
    const item = catalogItemToFalloutItem(entry);
    expect((item as any).stashed).toBe(false);
    expect((item as any).powered).toBe(false);
  });

  it("reconhece clothing como apparelType valido", () => {
    const entry: CatalogItem = {
      id: "app-2", name: "Vault Jumpsuit", description: null,
      qualityDescription: null, imageUrl: null, sourceKey: null,
      sourceData: { pack: "apparel", apparelType: "clothing", weight: 2, cost: 10, resistance: { physical: 1 }, location: { torso: true, armL: true, armR: true, legL: true, legR: true } },
    };
    const item = catalogItemToFalloutItem(entry);
    expect((item as any).apparelType).toBe("clothing");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/systems/fallout/__tests__/itemCatalog.test.ts --reporter=verbose`
Expected: FAIL — ammo has no shots, apparel has no stashed/powered, clothing falls to "armor".

- [ ] **Step 3: Update itemCatalog.ts**

Add `"clothing"` to `APPAREL_TYPES` set (line 127):

```typescript
const APPAREL_TYPES = new Set(["outfit", "armor", "headgear", "powerArmor", "clothing"]);
```

Add `FalloutAmmoItem` to the type imports at top.

In the apparel branch (line 171-188), add `stashed: false, powered: false` to the return:

```typescript
  if (type === "apparel") {
    const resistance = asRecord(sd.resistance);
    const location = asRecord(sd.location);
    return {
      ...base,
      type: "apparel",
      apparelType: pickApparelType(sd.apparelType),
      locationsCovered: FALLOUT_BODY_LOCATIONS.filter(
        (loc) => location[loc] === true,
      ) as FalloutBodyLocation[],
      resistances: {
        physical: asNumber(resistance.physical),
        energy: asNumber(resistance.energy),
        radiation: asNumber(resistance.radiation),
        poison: asNumber(resistance.poison),
      },
      equipped: false,
      stashed: false,
      powered: false,
    };
  }
```

Before the generic return (line 202), add a dedicated ammo branch:

```typescript
  if (type === "ammo") {
    const shots = asRecord(sd.shots);
    const shotsMax = asNumber(shots.max, 1);
    return {
      ...base,
      type: "ammo",
      description: item.description ?? undefined,
      quantity: asNumber(sd.quantity, 1),
      shotsMax,
      shotsCurrent: asNumber(shots.current, shotsMax),
      stashed: false,
    };
  }
```

Update the generic return to exclude "ammo" from the type assertion:

```typescript
  return {
    ...base,
    type: type as "mod" | "miscellany",
    description: item.description ?? undefined,
    quantity: asNumber(sd.quantity, 1),
    equipped: false,
    stashed: false,
  };
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/systems/fallout/__tests__/itemCatalog.test.ts --reporter=verbose`
Expected: all PASS.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/systems/fallout/itemCatalog.ts src/lib/systems/fallout/__tests__/itemCatalog.test.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): mapper popula ammo shots, stashed, powered e clothing"
```

---

### Task 5: Service Integration

**Files:**
- Modify: `src/lib/server/fallout-service.ts:184-238,274-301`

**Interfaces:**
- Consumes: `recalculateFalloutDerived` from `../systems/fallout/derived` (Task 2); `FalloutCharacter` with new fields (Task 1)
- Produces: `updateFalloutCharacterRecord` returns character with recalculated derived fields; `mapDbToFalloutCharacter` includes `carryWeightCurrent`/`encumbranceLevel` with fallback.

- [ ] **Step 1: Add import and recalc to updateFalloutCharacterRecord**

In `src/lib/server/fallout-service.ts`, add to imports:

```typescript
import { recalculateFalloutDerived } from "../systems/fallout/derived";
```

After line 230 (`if (input.perks !== undefined) patch.perks = input.perks;`) and before the `db.update` call (line 232), insert:

```typescript
  const merged = { ...existing, ...patch } as unknown as FalloutCharacter;
  const derived = recalculateFalloutDerived(merged);
  patch.hpMax = derived.hpMax;
  patch.hpCurrent = derived.hpCurrent;
  patch.defense = derived.defense;
  patch.initiative = derived.initiative;
  patch.meleeDamageBonus = derived.meleeDamageBonus;
  patch.carryWeightMax = derived.carryWeightMax;
  patch.carryWeightCurrent = derived.carryWeightCurrent;
  patch.encumbranceLevel = derived.encumbranceLevel;
  patch.bodyParts = derived.bodyParts;
```

- [ ] **Step 2: Update mapDbToFalloutCharacter**

In `mapDbToFalloutCharacter` (line 274-301), after `carryWeightMax: row.carryWeightMax,` add:

```typescript
    carryWeightCurrent: (row as any).carryWeightCurrent ?? 0,
    encumbranceLevel: (row as any).encumbranceLevel ?? 0,
```

The `as any` cast handles pre-migration rows where the column doesn't exist yet. After migration runs, Drizzle will type it properly.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run full Fallout test suite**

Run: `npx vitest run src/lib/systems/fallout/ src/components/systems/fallout/ --reporter=verbose`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/fallout-service.ts
HUSKY=0 git commit --no-verify -m "feat(fallout): servico recalcula derivadas em todo PATCH e mapDb inclui encumbrance"
```

---

### Task 6: Paperdoll Injury Slots UI

**Files:**
- Modify: `src/components/systems/fallout/PipBoyPaperdoll.tsx`
- Create or modify: `src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx`

**Interfaces:**
- Consumes: `FalloutBodyPart` with `injuries: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot]` and `status: FalloutBodyPartStatus` (Task 1); `getPaperdollPartState` accepting array (Task 1); `onUpdateBodyPart(location, patch)` prop (existing)
- Produces: Paperdoll with 3 clickable dots per part cycling 0→2→1→0, status badge, ARIA labels.

- [ ] **Step 1: Write failing tests**

Create `src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipBoyPaperdoll } from "../PipBoyPaperdoll";
import type { FalloutBodyLocation, FalloutBodyPart } from "@/lib/systems/fallout/types";
import { FALLOUT_BODY_LOCATIONS } from "@/lib/systems/fallout/types";

function buildBodyParts(): Record<FalloutBodyLocation, FalloutBodyPart> {
  const parts = {} as any;
  for (const loc of FALLOUT_BODY_LOCATIONS) {
    parts[loc] = {
      location: loc, label: loc, minRoll: 1, maxRoll: 20,
      injuries: [0, 0, 0], status: "healthy",
      resistances: { physical: 0, energy: 0, radiation: 0, poison: 0 },
    };
  }
  return parts;
}

describe("PipBoyPaperdoll — injury slots", () => {
  it("cicla slot 0→2→1→0 ao clicar", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [2, 0, 0] }));
  });

  it("segundo click cicla 2→1", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    parts.torso.injuries = [2, 0, 0];
    parts.torso.status = "crippled";
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [1, 0, 0] }));
  });

  it("terceiro click cicla 1→0", () => {
    const onUpdate = vi.fn();
    const parts = buildBodyParts();
    parts.torso.injuries = [1, 0, 0];
    parts.torso.status = "wounded";
    render(<PipBoyPaperdoll bodyParts={parts} onUpdateBodyPart={onUpdate} />);
    const dot = screen.getByLabelText(/Injúria torso slot 1/);
    fireEvent.click(dot);
    expect(onUpdate).toHaveBeenCalledWith("torso", expect.objectContaining({ injuries: [0, 0, 0] }));
  });

  it("readOnly nao renderiza dots clicaveis", () => {
    const parts = buildBodyParts();
    render(<PipBoyPaperdoll bodyParts={parts} readOnly />);
    const dots = screen.queryAllByRole("button", { name: /Injúria/ });
    expect(dots).toHaveLength(0);
  });

  it("exibe status badge por parte", () => {
    const parts = buildBodyParts();
    parts.head.injuries = [2, 0, 0];
    parts.head.status = "crippled";
    render(<PipBoyPaperdoll bodyParts={parts} />);
    expect(screen.getByText("Aleijado")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx --reporter=verbose`
Expected: FAIL — no aria-label matching "Injúria torso slot 1".

- [ ] **Step 3: Rewrite PipBoyPaperdoll.tsx injury interaction**

Replace the `toggleInjury` function and the dots section in `renderPartCard`. The full component:

```typescript
"use client";

import React from "react";
import type { FalloutBodyLocation, FalloutBodyPart, FalloutInjurySlot } from "@/lib/systems/fallout/types";
import { FALLOUT_BODY_LOCATIONS } from "@/lib/systems/fallout/types";
import {
  getPaperdollImage,
  getPaperdollPartState,
  PIPBOY_GREEN_FILTER,
  type PaperdollActorKind,
} from "@/lib/systems/fallout/assets";
import { Shield, Zap, Skull, Biohazard } from "lucide-react";

interface PipBoyPaperdollProps {
  bodyParts: Record<FalloutBodyLocation, FalloutBodyPart>;
  onUpdateBodyPart?: (location: FalloutBodyLocation, patch: Partial<FalloutBodyPart>) => void;
  readOnly?: boolean;
  className?: string;
  actorKind?: PaperdollActorKind;
}

const SLOT_CYCLE: Record<FalloutInjurySlot, FalloutInjurySlot> = { 0: 2, 2: 1, 1: 0 };
const SLOT_COLORS: Record<FalloutInjurySlot, string> = {
  0: "bg-black/60 border-emerald-900/60",
  1: "bg-amber-500 border-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.8)]",
  2: "bg-red-500 border-red-400 shadow-[0_0_4px_rgba(239,68,68,0.8)]",
};
const SLOT_LABELS: Record<FalloutInjurySlot, string> = { 0: "saudavel", 1: "tratada", 2: "aberta" };
const STATUS_LABELS: Record<string, string> = { healthy: "Íntegro", wounded: "Ferido", crippled: "Aleijado" };
const STATUS_COLORS: Record<string, string> = { healthy: "text-emerald-400", wounded: "text-amber-400", crippled: "text-red-400" };

export function PipBoyPaperdoll({
  bodyParts,
  onUpdateBodyPart,
  readOnly = false,
  className = "",
  actorKind = "character",
}: PipBoyPaperdollProps) {
  const cycleSlot = (location: FalloutBodyLocation, slotIndex: number) => {
    if (readOnly || !onUpdateBodyPart) return;
    const part = bodyParts[location];
    const next = [...part.injuries] as [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot];
    next[slotIndex] = SLOT_CYCLE[next[slotIndex]];
    const max = Math.max(...next);
    const status = max >= 2 ? "crippled" : max === 1 ? "wounded" : "healthy";
    onUpdateBodyPart(location, { injuries: next, status });
  };

  const renderPartCard = (location: FalloutBodyLocation) => {
    const part = bodyParts[location];
    if (!part) return null;
    const isInjured = part.status !== "healthy";

    return (
      <div
        key={location}
        className={`p-2.5 rounded border transition-all ${
          isInjured
            ? "bg-red-950/40 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
            : "bg-emerald-950/20 border-emerald-500/40"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-xs tracking-wider text-emerald-300">{part.label}</span>
          <span className="text-[10px] text-emerald-500/80 font-mono">
            d20: {part.minRoll}-{part.maxRoll}
          </span>
        </div>

        <div className="flex items-center justify-between my-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[part.status] ?? "text-emerald-400"}`}>
            {STATUS_LABELS[part.status] ?? "Íntegro"}
          </span>
          <div className="flex items-center gap-1">
            {part.injuries.map((slot, idx) => (
              readOnly ? (
                <span key={idx} className={`w-2.5 h-2.5 rounded-full border ${SLOT_COLORS[slot]}`} />
              ) : (
                <button
                  key={idx}
                  type="button"
                  role="button"
                  tabIndex={0}
                  aria-label={`Injúria ${part.label} slot ${idx + 1}: ${SLOT_LABELS[slot]}`}
                  onClick={() => cycleSlot(location, idx)}
                  className={`w-2.5 h-2.5 rounded-full border cursor-pointer ${SLOT_COLORS[slot]}`}
                />
              )
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono pt-1.5 border-t border-emerald-800/30 text-emerald-400/90">
          <div className="flex items-center gap-0.5" title="Resistência Física">
            <Shield size={10} className="text-emerald-300 shrink-0" />
            <span>{part.resistances.physical}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência à Energia">
            <Zap size={10} className="text-yellow-400 shrink-0" />
            <span>{part.resistances.energy}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência à Radiação">
            <Biohazard size={10} className="text-amber-400 shrink-0" />
            <span>{part.resistances.radiation}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Resistência a Veneno">
            <Skull size={10} className="text-emerald-400 shrink-0" />
            <span>{part.resistances.poison}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="pipboy-paperdoll"
      className={`bg-black/80 border border-emerald-500/40 rounded-lg p-3 font-mono text-emerald-400 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/30">
        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300">
          Monitor de Membros &amp; Armadura
        </h4>
        <span className="text-[10px] text-emerald-400/70">Tabela de Localização d20</span>
      </div>

      <div
        data-testid="pipboy-paperdoll-figure"
        className="relative mx-auto mb-3 aspect-square w-full max-w-[220px] select-none"
        aria-hidden="true"
      >
        {FALLOUT_BODY_LOCATIONS.map((loc) => {
          const part = bodyParts[loc];
          if (!part) return null;
          const state = getPaperdollPartState(part.injuries);
          return (
            <div
              key={loc}
              className="pointer-events-none absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${getPaperdollImage(actorKind, loc, state)})`,
                backgroundSize: "100% 100%",
                filter: PIPBOY_GREEN_FILTER,
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {FALLOUT_BODY_LOCATIONS.map((loc) => renderPartCard(loc))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx --reporter=verbose`
Expected: all 5 PASS.

- [ ] **Step 5: Run tsc + existing sheet tests (paperdoll is used inside sheet)**

Run: `npx tsc --noEmit && npx vitest run src/components/systems/fallout/__tests__/PipBoySheet.test.tsx --reporter=verbose`
Expected: 0 errors, all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/systems/fallout/PipBoyPaperdoll.tsx src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx
HUSKY=0 git commit --no-verify -m "feat(fallout): paperdoll com 3 slots de injuria clicaveis e status derivado"
```

---

### Task 7: PipBoySheet INV Actions + Encumbrance Display

**Files:**
- Modify: `src/components/systems/fallout/PipBoySheet.tsx:78-142,444-563`
- Modify: `src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`

**Interfaces:**
- Consumes: `applyFalloutConsumable` from `rules` (Task 3); `FalloutApparelItem` with stashed/powered (Task 1); `FalloutAmmoItem` with shots (Task 1); `character.carryWeightCurrent`, `character.encumbranceLevel` (Task 1); `onUpdateCharacter(patch)` prop (existing)
- Produces: INV tab with equip/stash/power toggles, consume button with confirmation, ammo shots display, encumbrance bar.

- [ ] **Step 1: Write failing tests for apparel actions**

Append to `src/components/systems/fallout/__tests__/PipBoySheet.test.tsx` (inside existing describe or new):

```typescript
describe("PipBoySheet INV — acoes de apparel", () => {
  function buildCharWithApparel(apparelOverrides: any = {}): any {
    const char = buildCharacter([]);
    char.items = [{
      id: "app-1", name: "Combat Armor", type: "apparel",
      apparelType: "armor", locationsCovered: ["torso"],
      resistances: { physical: 3, energy: 2, radiation: 1, poison: 0 },
      weight: 10, costCaps: 50, equipped: false, stashed: false, powered: false,
      ...apparelOverrides,
    }];
    return char;
  }

  it("toggle equipar chama onUpdateCharacter com equipped:true", async () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithApparel()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Equipar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", equipped: true })],
    }));
  });

  it("toggle guardar chama onUpdateCharacter com stashed:true", async () => {
    const onUpdate = vi.fn();
    render(<PipBoySheet character={buildCharWithApparel()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", stashed: true })],
    }));
  });

  it("powerArmor mostra botao Energizar somente quando equipado", async () => {
    const onUpdate = vi.fn();
    const char = buildCharWithApparel({ apparelType: "powerArmor", equipped: true });
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Energizar/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: "app-1", powered: true })],
    }));
  });
});
```

Note: `buildCharacter` is the existing test helper in the file. Adapt the helper name to whatever exists (check the file's existing fixture builder).

- [ ] **Step 2: Write failing tests for consume and ammo**

Append:

```typescript
describe("PipBoySheet INV — consumir e ammo", () => {
  it("consumir aplica HP e decrementa quantity", () => {
    const onUpdate = vi.fn();
    const char = buildCharacter([]);
    char.hpCurrent = 5;
    char.hpMax = 10;
    char.items = [{ id: "c-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, quantity: 2, weight: 0.5, costCaps: 25 }];
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-c-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Consumir/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ hpCurrent: 9 }));
  });

  it("consumir ultima unidade pede confirmacao", () => {
    const onUpdate = vi.fn();
    const char = buildCharacter([]);
    char.items = [{ id: "c-1", name: "Stimpak", type: "consumable", category: "med", hpRestored: 4, quantity: 1, weight: 0.5, costCaps: 25 }];
    render(<PipBoySheet character={char} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-c-1").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Consumir/ }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Última unidade/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(onUpdate).toHaveBeenCalled();
  });

  it("ammo mostra shots no accordion", () => {
    const char = buildCharacter([]);
    char.items = [{ id: "am-1", name: "10mm", type: "ammo", quantity: 20, weight: 0.1, costCaps: 1, shotsCurrent: 15, shotsMax: 30, stashed: false }];
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-am-1").querySelector("button")!);
    expect(screen.getByText(/15\/30 cargas/)).toBeTruthy();
  });

  it("readOnly esconde botoes de acao", () => {
    const char = buildCharacter([]);
    char.items = [{ id: "app-1", name: "Armor", type: "apparel", apparelType: "armor", locationsCovered: ["torso"], resistances: { physical: 3, energy: 0, radiation: 0, poison: 0 }, weight: 10, costCaps: 50, equipped: false, stashed: false, powered: false }];
    render(<PipBoySheet character={char} readOnly />);
    fireEvent.click(screen.getByText("INV"));
    fireEvent.click(screen.getByTestId("item-row-app-1").querySelector("button")!);
    expect(screen.queryByRole("button", { name: /Equipar/ })).toBeNull();
  });
});

describe("PipBoySheet INV — encumbrance display", () => {
  it("mostra peso atual e maximo", () => {
    const char = buildCharacter([]);
    char.carryWeightCurrent = 45.5;
    char.carryWeightMax = 200;
    char.encumbranceLevel = 0;
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByText("INV"));
    expect(screen.getByText(/45\.5\/200 lbs/)).toBeTruthy();
  });

  it("mostra badge de sobrecarga quando encumbranceLevel > 0", () => {
    const char = buildCharacter([]);
    char.carryWeightCurrent = 300;
    char.carryWeightMax = 200;
    char.encumbranceLevel = 2;
    render(<PipBoySheet character={char} />);
    fireEvent.click(screen.getByText("INV"));
    expect(screen.getByText(/Sobrecarga 2/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoySheet.test.tsx --reporter=verbose`
Expected: FAIL — buttons not found.

- [ ] **Step 4: Implement INV actions in PipBoySheet.tsx**

Add imports at top:

```typescript
import { applyFalloutConsumable } from "@/lib/systems/fallout/rules";
import { Shield, ShieldOff, Archive, ArchiveRestore, BatteryCharging, BatteryLow, UtensilsCrossed, Pill } from "lucide-react";
```

(Add to existing lucide import block; remove duplicates with existing Shield import.)

Add state for consume confirmation:

```typescript
const [confirmConsumeId, setConfirmConsumeId] = useState<string | null>(null);
```

Add handler functions after `handleRemoveItem`:

```typescript
const handleToggleItemField = (itemId: string, field: string, value: boolean) => {
  if (readOnly || !onUpdateCharacter) return;
  const items = character.items.map((item) =>
    item.id === itemId ? { ...item, [field]: value } : item,
  );
  onUpdateCharacter({ items });
};

const handleConsumeItem = (itemId: string) => {
  if (readOnly || !onUpdateCharacter) return;
  const item = character.items.find((i) => i.id === itemId);
  if (!item || item.type !== "consumable") return;
  if (item.quantity === 1 && confirmConsumeId !== itemId) {
    setConfirmConsumeId(itemId);
    return;
  }
  const result = applyFalloutConsumable(character, itemId);
  if (result) {
    onUpdateCharacter(result);
    setConfirmConsumeId(null);
  }
};
```

In the INV tab header (line 447-477), replace the "Capacidade de Carga Máxima" section with:

```typescript
<div className="flex items-center gap-2">
  <Package size={15} />
  <span>
    Carga:{" "}
    <strong>{character.carryWeightCurrent}/{character.carryWeightMax} lbs</strong>
  </span>
  {character.encumbranceLevel > 0 && (
    <span className="rounded bg-amber-950 border border-amber-700 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
      Sobrecarga {character.encumbranceLevel}
    </span>
  )}
</div>
```

In the expanded item section (after `<PipBoyItemStats item={item} />`, before the remove button), add action buttons:

```typescript
{canEdit && item.type === "apparel" && (
  <div className="flex flex-wrap gap-1.5">
    <button
      type="button"
      onClick={() => handleToggleItemField(item.id, "equipped", !item.equipped)}
      aria-label={item.equipped ? "Desequipar" : "Equipar"}
      className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold cursor-pointer ${
        item.equipped
          ? "border-emerald-500 bg-emerald-950 text-emerald-300"
          : "border-emerald-800 bg-black/50 text-emerald-500 hover:border-emerald-500"
      }`}
    >
      {item.equipped ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {item.equipped ? "Desequipar" : "Equipar"}
    </button>
    <button
      type="button"
      onClick={() => handleToggleItemField(item.id, "stashed", !(item as any).stashed)}
      aria-label={(item as any).stashed ? "Recuperar" : "Guardar"}
      className="flex items-center gap-1 rounded border border-emerald-800 bg-black/50 px-2 py-1 text-[10px] font-bold text-emerald-500 hover:border-emerald-500 cursor-pointer"
    >
      {(item as any).stashed ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
      {(item as any).stashed ? "Recuperar" : "Guardar"}
    </button>
    {item.apparelType === "powerArmor" && item.equipped && (
      <button
        type="button"
        onClick={() => handleToggleItemField(item.id, "powered", !item.powered)}
        aria-label={item.powered ? "Desenergizar" : "Energizar"}
        className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold cursor-pointer ${
          item.powered
            ? "border-amber-500 bg-amber-950 text-amber-300"
            : "border-emerald-800 bg-black/50 text-emerald-500 hover:border-amber-500"
        }`}
      >
        {item.powered ? <BatteryLow className="h-3 w-3" /> : <BatteryCharging className="h-3 w-3" />}
        {item.powered ? "Desenergizar" : "Energizar"}
      </button>
    )}
  </div>
)}
{canEdit && item.type === "consumable" && (
  <div className="flex items-center gap-2">
    {confirmConsumeId === item.id ? (
      <>
        <span className="text-[10px] text-amber-400">Última unidade — consumir?</span>
        <button
          type="button"
          onClick={() => handleConsumeItem(item.id)}
          aria-label="Confirmar"
          className="rounded border border-emerald-500 bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-300 cursor-pointer"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setConfirmConsumeId(null)}
          aria-label="Cancelar"
          className="rounded border border-emerald-800 px-2 py-1 text-[10px] text-emerald-500 cursor-pointer"
        >
          Cancelar
        </button>
      </>
    ) : (
      <button
        type="button"
        onClick={() => handleConsumeItem(item.id)}
        disabled={item.quantity <= 0}
        aria-label="Consumir"
        className="flex items-center gap-1 rounded border border-emerald-500 bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900 disabled:opacity-40 cursor-pointer"
      >
        {item.category === "med" || item.category === "chem" ? <Pill className="h-3 w-3" /> : <UtensilsCrossed className="h-3 w-3" />}
        Consumir
      </button>
    )}
  </div>
)}
```

In `PipBoyItemStats`, add ammo shots display. Replace the generic fallback return (lines 134-141) with:

```typescript
  if (item.type === "ammo") {
    return (
      <div className="space-y-1 text-[11px] text-emerald-400">
        <p className="text-emerald-500">
          {item.shotsCurrent}/{item.shotsMax} cargas • Quantidade: {item.quantity}
        </p>
        {item.description && <p className="leading-relaxed">{item.description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[11px] text-emerald-400">
      {item.description && <p className="leading-relaxed">{item.description}</p>}
      {(item as any).quantity !== undefined && (
        <p className="text-emerald-500">Quantidade: {(item as any).quantity}</p>
      )}
    </div>
  );
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoySheet.test.tsx --reporter=verbose`
Expected: all PASS (existing + new).

- [ ] **Step 6: Run tsc + eslint**

Run: `npx tsc --noEmit && npx eslint src/components/systems/fallout/PipBoySheet.tsx --max-warnings=0`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/__tests__/PipBoySheet.test.tsx
HUSKY=0 git commit --no-verify -m "feat(fallout): acoes de equipar/consumir/ammo e display de encumbrance na aba INV"
```

---

### Task 8: Final Validation

**Files:**
- No new files; verification only.

**Interfaces:**
- Consumes: all previous tasks
- Produces: green full suite, tsc, eslint; confirmation that the branch is ship-ready.

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: all tests pass (179+ files, 1400+ tests). No regressions.

- [ ] **Step 3: ESLint on changed files**

Run: `npx eslint src/lib/systems/fallout/derived.ts src/lib/systems/fallout/rules.ts src/lib/systems/fallout/itemCatalog.ts src/lib/server/fallout-service.ts src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/PipBoyPaperdoll.tsx --max-warnings=0`
Expected: 0 errors (pre-existing no-img-element warning in sheet is acceptable).

- [ ] **Step 4: Verify git status**

Run: `git status --short && git log --oneline -10`
Expected: clean worktree, 7 new commits on top of 074b1ff (spec).

- [ ] **Step 5: Report**

Report to user: task count, test count, commit range, any deferred items. Note that migration `0028_fallout_encumbrance_columns.sql` requires explicit authorization to execute against the shared DB.
