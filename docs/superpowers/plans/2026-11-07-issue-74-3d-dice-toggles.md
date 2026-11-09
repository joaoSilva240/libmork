# 3D Dice Toggles in Master Shield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two persistent toggles in the Master Shield campaign settings to control 3D dice rendering between master and players ("Dados 3d nas rolagens dos jogadores" and "Dados 3d nas rolagens do mestre"), and relay rolled dice through WebSockets with client-side role filtering.

**Architecture:**

- Add `dice3d_players_enabled` and `dice3d_master_enabled` boolean columns (default `true`) to the `campaigns` table in Drizzle ORM and update validators/APIs.
- Render two accessible switch toggles in `CampaignSettingsModal` (opened from the master shield `CampaignDetail`).
- Extend `RollDataPayload` in `SocketContext` with `senderRole` and `rolledDice: Dice3DDie[]`, forwarding dice to `showDice3D()` on remote clients when allowed by campaign toggles and role matrix.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM (PostgreSQL), Zod, Socket.io, Vitest, Testing Library.

**Spec:** GitHub Issue #74 — `feat(shield): toggles de dados 3d das rolagens nas configuracoes do escudo do mestre`

## Global Constraints

- Never execute database migrations directly against the shared remote `DATABASE_URL`; verify migrations and schema via code/unit tests and mock queries.
- Adhere strictly to the design system and WCAG AAA contrast patterns (`bg-dominant-deep`, `border-secondary-border`, `text-secondary-pure`, `text-accent-hover`).
- Toggle labels must match the spec verbatim: "Dados 3d nas rolagens dos jogadores" and "Dados 3d nas rolagens do mestre".
- Both toggles default to `true` (enabled).
- Local dice rolls must continue to render instantly via `showDice3D()` without duplicate animations.

---

### Task 1: Database Schema, Types, and Validators for Campaign Dice 3D Toggles

**Files:**

- Modify: `src/lib/db/schema.ts:168-175`
- Create: `drizzle/0023_add_campaign_dice3d_toggles.sql`
- Modify: `src/types/index.ts:140-149`
- Modify: `src/lib/validators/campaign.ts:16-41`
- Test: `src/lib/validators/__tests__/campaign-dice3d.test.ts`

**Interfaces:**

- Consumes: `campaigns` pgTable in `src/lib/db/schema.ts`, `Campaign` type in `src/types/index.ts`.
- Produces: `dice3dPlayersEnabled: boolean` and `dice3dMasterEnabled: boolean` on `campaigns` table, `Campaign` type, and `createCampaignSchema` / `updateCampaignSchema`.

- [ ] **Step 1: Write the failing test for campaign validators**

Create `src/lib/validators/__tests__/campaign-dice3d.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createCampaignSchema, updateCampaignSchema } from "../campaign";

describe("Campaign Dice 3D Validators (Issue #74)", () => {
  it("defaults dice3dPlayersEnabled and dice3dMasterEnabled to true in createCampaignSchema", () => {
    const parsed = createCampaignSchema.parse({
      name: "Campanha dos Dados",
    });

    expect(parsed.dice3dPlayersEnabled).toBe(true);
    expect(parsed.dice3dMasterEnabled).toBe(true);
  });

  it("accepts boolean overrides in createCampaignSchema", () => {
    const parsed = createCampaignSchema.parse({
      name: "Campanha Silenciosa",
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: false,
    });

    expect(parsed.dice3dPlayersEnabled).toBe(false);
    expect(parsed.dice3dMasterEnabled).toBe(false);
  });

  it("allows partial updates of dice 3D toggles in updateCampaignSchema", () => {
    const parsedPlayersOnly = updateCampaignSchema.parse({
      dice3dPlayersEnabled: false,
    });
    expect(parsedPlayersOnly.dice3dPlayersEnabled).toBe(false);
    expect(parsedPlayersOnly.dice3dMasterEnabled).toBeUndefined();

    const parsedMasterOnly = updateCampaignSchema.parse({
      dice3dMasterEnabled: true,
    });
    expect(parsedMasterOnly.dice3dMasterEnabled).toBe(true);
  });

  it("rejects non-boolean values for dice 3D toggles", () => {
    const result = updateCampaignSchema.safeParse({
      dice3dPlayersEnabled: "sim",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validators/__tests__/campaign-dice3d.test.ts`
Expected: FAIL with missing fields or undefined assertions.

- [ ] **Step 3: Update schema, types, migration, and validators**

In `src/lib/db/schema.ts`, add the two columns to `campaigns` table:

```typescript
  dice3dPlayersEnabled: boolean("dice3d_players_enabled").notNull().default(true),
  dice3dMasterEnabled: boolean("dice3d_master_enabled").notNull().default(true),
```

Create `drizzle/0023_add_campaign_dice3d_toggles.sql`:

```sql
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_players_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_master_enabled" boolean DEFAULT true NOT NULL;
```

In `src/types/index.ts`, update `Campaign`:

```typescript
export type Campaign = {
  id: string;
  masterId: string;
  name: string;
  description: string | null;
  rulesEngine: RulesEngine;
  pvpEnabled: boolean;
  difficultyModifierShadowPoints: number;
  coverImageUrl: string | null;
  worldMapUrl: string | null;
  theme?: string | null;
  activeAssetId?: string | null;
  activeAsset?: CampaignAsset | null;
  dice3dPlayersEnabled?: boolean;
  dice3dMasterEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

In `src/lib/validators/campaign.ts`, update `createCampaignSchema` and `updateCampaignSchema`:

```typescript
export const createCampaignSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(200),
  description: z.string().max(5000).optional().nullable(),
  rulesEngine: z.enum(RULES_ENGINES).default("d20_mod"),
  pvpEnabled: z.boolean().default(false),
  difficultyModifierShadowPoints: z.number().int().min(0).default(0),
  coverImageUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  worldMapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  theme: z.string().max(50).optional().default("default-dark"),
  dice3dPlayersEnabled: z.boolean().optional().default(true),
  dice3dMasterEnabled: z.boolean().optional().default(true),
  initialNpcIds: z.array(z.string().uuid()).optional().default([]),
  initialWorldIds: z.array(z.string().uuid()).optional().default([]),
  initialAssets: z.array(initialAssetInputSchema).optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  rulesEngine: z.enum(RULES_ENGINES).optional(),
  pvpEnabled: z.boolean().optional(),
  difficultyModifierShadowPoints: z.number().int().min(0).optional(),
  coverImageUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  worldMapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  theme: z.string().max(50).optional(),
  dice3dPlayersEnabled: z.boolean().optional(),
  dice3dMasterEnabled: z.boolean().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validators/__tests__/campaign-dice3d.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0023_add_campaign_dice3d_toggles.sql src/types/index.ts src/lib/validators/campaign.ts src/lib/validators/__tests__/campaign-dice3d.test.ts
git commit -m "feat(campaigns): adiciona campos de toggles de dados 3d no schema e validadores (#74)"
```

---

### Task 2: API Route Updates for Campaign Dice 3D Settings and Player Details

**Files:**

- Modify: `src/app/api/player/campaigns/[id]/details/route.ts:15-37`
- Modify: `src/app/api/player/campaigns/route.ts:60-76`
- Test: `src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts`

**Interfaces:**

- Consumes: `updateCampaignSchema`, `campaigns` table.
- Produces: `dice3dPlayersEnabled` and `dice3dMasterEnabled` returned in `GET /api/player/campaigns/[id]/details` and `PATCH /api/campaigns/[id]`.

- [ ] **Step 1: Write failing test for PATCH /api/campaigns/[id] with dice 3D toggles**

Create `src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

describe("PATCH /api/campaigns/[id] with Dice 3D Toggles (Issue #74)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates dice3dPlayersEnabled and dice3dMasterEnabled when authorized as master", async () => {
    (requireAuth as any).mockResolvedValue({
      user: { id: "user-master", email: "master@test.com" },
    });

    const mockExisting = {
      id: "camp-1",
      masterId: "user-master",
      name: "Mesa 1",
      dice3dPlayersEnabled: true,
      dice3dMasterEnabled: true,
    };

    const mockUpdated = {
      ...mockExisting,
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: true,
    };

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockExisting]),
        }),
      }),
    });

    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUpdated]),
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/campaigns/camp-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dice3dPlayersEnabled: false,
        dice3dMasterEnabled: true,
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "camp-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.dice3dPlayersEnabled).toBe(false);
    expect(data.data.dice3dMasterEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npx vitest run src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts`
Expected: PASS (because `PATCH /api/campaigns/[id]` already uses `updateCampaignSchema` dynamically, but now verifies the payload and returned shape).

- [ ] **Step 3: Update `src/app/api/player/campaigns/[id]/details/route.ts` to include the toggles**

In `src/app/api/player/campaigns/[id]/details/route.ts`, ensure `dice3dPlayersEnabled` and `dice3dMasterEnabled` are selected so player clients receive the rules:
Lines 16 and 33:

```typescript
      .select({
        id: campaigns.id,
        activeAssetId: campaigns.activeAssetId,
        dice3dPlayersEnabled: campaigns.dice3dPlayersEnabled,
        dice3dMasterEnabled: campaigns.dice3dMasterEnabled,
      })
```

Include them in the returned response JSON.

In `src/app/api/player/campaigns/route.ts`:
Line 69:

```typescript
        theme: campaigns.theme,
        dice3dPlayersEnabled: campaigns.dice3dPlayersEnabled,
        dice3dMasterEnabled: campaigns.dice3dMasterEnabled,
        masterId: users.id,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/player/campaigns/[id]/details/route.ts src/app/api/player/campaigns/route.ts src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts
git commit -m "feat(api): propaga toggles de dados 3d na api de campanhas (#74)"
```

---

### Task 3: Realtime Socket Protocol and Remote 3D Dice Bridge

**Files:**

- Modify: `server.js:160-166`
- Modify: `src/context/SocketContext.tsx:42-58,132-218,220-455`
- Test: `src/context/__tests__/SocketContext.dice3d.test.tsx`

**Interfaces:**

- Consumes: `showDice3D` and `Dice3DDie` from `@/lib/dice3d`.
- Produces: `RollDataPayload` with `senderRole?: "master" | "player"`, `rolledDice?: Dice3DDie[]`, `senderSocketId?: string`; `campaign:dice3d-settings-updated` socket event; automatic trigger of `showDice3D` on remote clients when allowed.

- [ ] **Step 1: Write failing test for SocketContext 3D dice filtering**

Create `src/context/__tests__/SocketContext.dice3d.test.tsx`:

```typescript
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SocketProvider, useSocket } from "../SocketContext";
import * as dice3dModule from "@/lib/dice3d";

vi.mock("@/lib/dice3d", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dice3d")>();
  return {
    ...actual,
    showDice3D: vi.fn(),
  };
});

describe("SocketContext 3D Dice Remote Filtering (Issue #74)", () => {
  let mockSocket: any;
  const handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    handlers["dice-rolled"] = undefined as any;
    handlers["campaign:dice3d-settings-updated"] = undefined as any;

    mockSocket = {
      id: "socket-client-1",
      on: vi.fn((event, cb) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
    };

    vi.spyOn(require("socket.io-client"), "io").mockReturnValue(mockSocket);
  });

  it("triggers showDice3D for master when player rolls and dice3dPlayersEnabled is true", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
        user: { id: "master-1", name: "Mestre" },
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: true,
      });
    });

    // Simulate dice-rolled received from player
    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "char-player-1",
        actorName: "Guerreiro",
        rollType: "ataque",
        formula: "1d20+3",
        result: 18,
        senderRole: "player",
        senderSocketId: "socket-player-99",
        rolledDice: [{ sides: 20, value: 15 }],
      });
    });

    expect(dice3dModule.showDice3D).toHaveBeenCalledWith([{ sides: 20, value: 15 }]);
  });

  it("does NOT trigger showDice3D for master when dice3dPlayersEnabled is false", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: false,
        dice3dMasterEnabled: true,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "char-player-1",
        actorName: "Guerreiro",
        rollType: "ataque",
        formula: "1d20+3",
        result: 18,
        senderRole: "player",
        senderSocketId: "socket-player-99",
        rolledDice: [{ sides: 20, value: 15 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("triggers showDice3D for player when master rolls and dice3dMasterEnabled is true", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "player",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: true,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "npc-boss",
        actorName: "Dragão",
        rollType: "ataque",
        formula: "1d20+8",
        result: 22,
        senderRole: "master",
        senderSocketId: "socket-master-99",
        rolledDice: [{ sides: 20, value: 14 }],
      });
    });

    expect(dice3dModule.showDice3D).toHaveBeenCalledWith([{ sides: 20, value: 14 }]);
  });

  it("does NOT trigger showDice3D for player when master rolls and dice3dMasterEnabled is false", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "player",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: false,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "npc-boss",
        actorName: "Dragão",
        rollType: "ataque",
        formula: "1d20+8",
        result: 22,
        senderRole: "master",
        senderSocketId: "socket-master-99",
        rolledDice: [{ sides: 20, value: 14 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("ignores rolls originating from the same socket to prevent double animation", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "actor-self",
        actorName: "Self",
        formula: "1d20",
        result: 10,
        senderSocketId: "socket-client-1", // same as mockSocket.id
        rolledDice: [{ sides: 20, value: 10 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/__tests__/SocketContext.dice3d.test.tsx`
Expected: FAIL (`setCampaignDice3DSettings` undefined, no handling in socket).

- [ ] **Step 3: Implement SocketContext and server.js changes**

In `server.js:160-166`:

```javascript
// Evento de rolagem de dados em tempo real - RF-041, RF-046
socket.on("roll-dice", (rollData) => {
  if (!rollData) return;
  if (rollData.campaignId) {
    io.to(`campaign:${rollData.campaignId}`).emit("dice-rolled", {
      ...rollData,
      senderSocketId: socket.id,
    });
  }
});

// Configurações de Dados 3D da Campanha (Issue #74)
socket.on("campaign:dice3d-settings-update", (payload) => {
  if (!payload || !payload.campaignId) return;
  io.to(`campaign:${payload.campaignId}`).emit("campaign:dice3d-settings-updated", payload);
});
```

In `src/context/SocketContext.tsx`:
Import `showDice3D, type Dice3DDie` from `@/lib/dice3d`.

Update `RollDataPayload`:

```typescript
export interface RollDataPayload {
  campaignId: string;
  actorId?: string;
  actorName: string;
  rollType: string;
  formula: string;
  result: number;
  diceDetail?: string;
  isManual?: boolean;
  damage?: number;
  damageRoll?: string;
  damageTaken?: number;
  hit?: boolean;
  details?: string;
  actionId?: string;
  timestamp?: string;
  senderRole?: "master" | "player";
  senderSocketId?: string;
  rolledDice?: Dice3DDie[];
}
```

Add to `SocketContextValue`:

```typescript
  setCampaignDice3DSettings: (
    campaignId: string,
    settings: { dice3dPlayersEnabled: boolean; dice3dMasterEnabled: boolean }
  ) => void;
  broadcastCampaignDice3DSettings: (payload: {
    campaignId: string;
    dice3dPlayersEnabled: boolean;
    dice3dMasterEnabled: boolean;
  }) => void;
```

Inside `SocketProvider`:
Maintain state / ref for current role and campaign settings:

```typescript
const currentRoleRef = useRef<"master" | "player">("player");
const campaignDice3DRef = useRef<
  Map<string, { dice3dPlayersEnabled: boolean; dice3dMasterEnabled: boolean }>
>(new Map());
```

When `joinCampaign` is called:

```typescript
if (data.role) {
  currentRoleRef.current = data.role;
}
```

Add socket listener for `campaign:dice3d-settings-updated`:

```typescript
socketInstance.on(
  "campaign:dice3d-settings-updated",
  (payload: {
    campaignId: string;
    dice3dPlayersEnabled: boolean;
    dice3dMasterEnabled: boolean;
  }) => {
    campaignDice3DRef.current.set(payload.campaignId, {
      dice3dPlayersEnabled: payload.dice3dPlayersEnabled,
      dice3dMasterEnabled: payload.dice3dMasterEnabled,
    });
  },
);
```

In `socketInstance.on("dice-rolled")`:

```typescript
socketInstance.on("dice-rolled", (rollData: RollDataPayload) => {
  rollSubscribersRef.current.forEach((handler) => handler(rollData));

  // Issue #74: Remote 3D Dice rendering
  if (
    rollData.rolledDice &&
    rollData.rolledDice.length > 0 &&
    rollData.senderSocketId !== socketInstance.id
  ) {
    const settings = campaignDice3DRef.current.get(rollData.campaignId) ?? {
      dice3dPlayersEnabled: true,
      dice3dMasterEnabled: true,
    };
    const myRole = currentRoleRef.current;
    const senderRole = rollData.senderRole ?? "player";

    if (myRole === "master" && senderRole === "player" && settings.dice3dPlayersEnabled) {
      showDice3D(rollData.rolledDice);
    } else if (myRole === "player" && senderRole === "master" && settings.dice3dMasterEnabled) {
      showDice3D(rollData.rolledDice);
    }
  }
});
```

In `rollDice`:
Attach `senderRole: rollPayload.senderRole ?? currentRoleRef.current`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/context/__tests__/SocketContext.dice3d.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js src/context/SocketContext.tsx src/context/__tests__/SocketContext.dice3d.test.tsx
git commit -m "feat(socket): adiciona suporte a sincronizacao e filtro de dados 3d remotos (#74)"
```

---

### Task 4: Campaign Settings Modal UI Toggles in Master Shield

**Files:**

- Modify: `src/components/campaigns/CampaignSettingsModal.tsx:23-75,257-296`
- Modify: `src/components/campaigns/CampaignDetail.tsx:688-700`
- Test: `src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx`

**Interfaces:**

- Consumes: `campaign.dice3dPlayersEnabled`, `campaign.dice3dMasterEnabled`, `useSocket().broadcastCampaignDice3DSettings`.
- Produces: Two accessible checkbox toggles labeled "Dados 3d nas rolagens dos jogadores" and "Dados 3d nas rolagens do mestre", persisting to DB via PATCH and updating SocketContext.

- [ ] **Step 1: Write failing test for CampaignSettingsModal dice 3D toggles**

Create `src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx`:

```typescript
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignSettingsModal } from "../CampaignSettingsModal";
import type { Campaign } from "@/types";

const mockBroadcast = vi.fn();
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    broadcastCampaignDice3DSettings: mockBroadcast,
    setCampaignDice3DSettings: vi.fn(),
  }),
}));

describe("CampaignSettingsModal 3D Dice Toggles (Issue #74)", () => {
  const mockCampaign: Campaign = {
    id: "camp-123",
    name: "Maldição de Strahd",
    masterId: "user-1",
    description: "Aventura gótica",
    rulesEngine: "d20_mod",
    pvpEnabled: false,
    difficultyModifierShadowPoints: 0,
    coverImageUrl: null,
    worldMapUrl: null,
    dice3dPlayersEnabled: true,
    dice3dMasterEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both 3D dice toggles with exact labels from issue #74", () => {
    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Dados 3d nas rolagens dos jogadores")).toBeInTheDocument();
    expect(screen.getByText("Dados 3d nas rolagens do mestre")).toBeInTheDocument();

    const playersToggle = screen.getByTestId("toggle-dice3d-players") as HTMLInputElement;
    const masterToggle = screen.getByTestId("toggle-dice3d-master") as HTMLInputElement;

    expect(playersToggle.checked).toBe(true);
    expect(masterToggle.checked).toBe(true);
  });

  it("saves toggled values to PATCH and broadcasts via socket", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockCampaign,
          dice3dPlayersEnabled: false,
          dice3dMasterEnabled: true,
        },
      }),
    } as any);

    const handleSaved = vi.fn();

    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={handleSaved}
        onDelete={vi.fn()}
      />
    );

    const playersToggle = screen.getByTestId("toggle-dice3d-players");
    fireEvent.click(playersToggle);

    const saveButton = screen.getByRole("button", { name: /Salvar Alterações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/camp-123",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"dice3dPlayersEnabled":false'),
        })
      );
    });

    expect(mockBroadcast).toHaveBeenCalledWith({
      campaignId: "camp-123",
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx`
Expected: FAIL with "Unable to find text 'Dados 3d nas rolagens dos jogadores'".

- [ ] **Step 3: Implement UI toggles in CampaignSettingsModal**

In `src/components/campaigns/CampaignSettingsModal.tsx`:
Add states:

```typescript
const [dice3dPlayersEnabled, setDice3dPlayersEnabled] = useState(
  campaign.dice3dPlayersEnabled ?? true,
);
const [dice3dMasterEnabled, setDice3dMasterEnabled] = useState(
  campaign.dice3dMasterEnabled ?? true,
);
```

In `handleSave`:
Include `dice3dPlayersEnabled` and `dice3dMasterEnabled` in the body payload sent to `/api/campaigns/${campaign.id}`.
On success:

```typescript
broadcastCampaignDice3DSettings?.({
  campaignId: campaign.id,
  dice3dPlayersEnabled,
  dice3dMasterEnabled,
});
```

In JSX, in the "Regras e Parâmetros da Mesa" section (under PvP toggle):

```tsx
{
  /* Toggle Dados 3D Jogadores */
}
<label className="flex items-center justify-between p-3 rounded-lg border border-secondary-border bg-dominant-deep cursor-pointer group">
  <div>
    <span className="text-xs font-bold text-secondary-pure group-hover:text-accent-hover transition block">
      Dados 3d nas rolagens dos jogadores
    </span>
    <span className="text-[11px] text-secondary-muted block mt-0.5">
      Quando ligado, as rolagens dos jogadores aparecem em 3d para o mestre.
    </span>
  </div>
  <input
    type="checkbox"
    data-testid="toggle-dice3d-players"
    checked={dice3dPlayersEnabled}
    onChange={(e) => setDice3dPlayersEnabled(e.target.checked)}
    className="h-4 w-4 rounded border-secondary-border bg-secondary-card text-accent focus:ring-2 focus:ring-accent cursor-pointer ml-3 shrink-0"
  />
</label>;

{
  /* Toggle Dados 3D Mestre */
}
<label className="flex items-center justify-between p-3 rounded-lg border border-secondary-border bg-dominant-deep cursor-pointer group">
  <div>
    <span className="text-xs font-bold text-secondary-pure group-hover:text-accent-hover transition block">
      Dados 3d nas rolagens do mestre
    </span>
    <span className="text-[11px] text-secondary-muted block mt-0.5">
      Quando ligado, a rolagem do mestre aparece em 3d para o jogador.
    </span>
  </div>
  <input
    type="checkbox"
    data-testid="toggle-dice3d-master"
    checked={dice3dMasterEnabled}
    onChange={(e) => setDice3dMasterEnabled(e.target.checked)}
    className="h-4 w-4 rounded border-secondary-border bg-secondary-card text-accent focus:ring-2 focus:ring-accent cursor-pointer ml-3 shrink-0"
  />
</label>;
```

In `CampaignDetail.tsx`:
When campaign is loaded, also initialize `setCampaignDice3DSettings`:

```typescript
useEffect(() => {
  if (campaign) {
    setCampaignDice3DSettings(campaign.id, {
      dice3dPlayersEnabled: campaign.dice3dPlayersEnabled ?? true,
      dice3dMasterEnabled: campaign.dice3dMasterEnabled ?? true,
    });
  }
}, [
  campaign?.id,
  campaign?.dice3dPlayersEnabled,
  campaign?.dice3dMasterEnabled,
  setCampaignDice3DSettings,
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/CampaignSettingsModal.tsx src/components/campaigns/CampaignDetail.tsx src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx
git commit -m "feat(campaigns): adiciona toggles de dados 3d no modal de configuracoes do escudo (#74)"
```

---

### Task 5: Propagate `rolledDice` and `senderRole` in Rolagem Components

**Files:**

- Modify: `src/components/campaigns/ActorOverlay.tsx:400-420,540-560`
- Modify: `src/components/characters/CharacterDetail.tsx:745-775`
- Modify: `src/components/characters/CharacterContent.tsx:735-760`
- Modify: `src/components/characters/CombatSheet.tsx:225-240,260-275`
- Test: `src/components/campaigns/__tests__/ActorOverlay.dice3d.test.tsx`

**Interfaces:**

- Consumes: `showDice3D`, `d20s`, `rollDice` with `RollDataPayload`.
- Produces: `rolledDice` and `senderRole` populated in `rollDice()` calls.

- [ ] **Step 1: Write failing test verifying ActorOverlay emits rolledDice and senderRole: "master"**

Create `src/components/campaigns/__tests__/ActorOverlay.dice3d.test.tsx`:

```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActorOverlay } from "../ActorOverlay";

const mockRollDice = vi.fn();
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    rollDice: mockRollDice,
    isConnected: true,
  }),
}));

describe("ActorOverlay 3D Dice Emission (Issue #74)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes rolledDice and senderRole: 'master' when rolling from ActorOverlay", () => {
    const mockActor = {
      id: "npc-1",
      name: "Goblin Chefe",
      type: "npc" as const,
      attributes: { forca: 2, destreza: 3, vigor: 1, inteligencia: 0, presenca: -1 },
    };

    render(
      <ActorOverlay
        actor={mockActor as any}
        campaignId="camp-1"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Trigger quick roll or free roll
    const rollButton = screen.queryByTitle(/Rolar d20/i) || screen.queryByRole("button", { name: /Rolar/i });
    if (rollButton) {
      fireEvent.click(rollButton);
      expect(mockRollDice).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "camp-1",
          senderRole: "master",
          rolledDice: expect.any(Array),
        })
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it runs and inspect expectation**

Run: `npx vitest run src/components/campaigns/__tests__/ActorOverlay.dice3d.test.tsx`

- [ ] **Step 3: Update ActorOverlay, CharacterDetail, CharacterContent, and CombatSheet**

In `src/components/campaigns/ActorOverlay.tsx`:
In each `rollDice` invocation:
Add:

```typescript
  senderRole: "master",
  rolledDice: ... // e.g. attack.rolledDice ?? d20s(finalResult)
```

In `src/components/characters/CharacterDetail.tsx`:
In each `rollDice` invocation:
Add:

```typescript
  senderRole: "player",
  rolledDice: d20s(die), // or rollRes
```

In `src/components/characters/CharacterContent.tsx`:
In each `rollDice` invocation:
Add:

```typescript
  senderRole: "player",
  rolledDice: rollResult.rolledDice ?? [],
```

In `src/components/characters/CombatSheet.tsx`:
In each `rollDice` invocation:
Add:

```typescript
  senderRole: "player",
  rolledDice: d20s(d20),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/campaigns/__tests__/ActorOverlay.dice3d.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/ActorOverlay.tsx src/components/characters/CharacterDetail.tsx src/components/characters/CharacterContent.tsx src/components/characters/CombatSheet.tsx src/components/campaigns/__tests__/ActorOverlay.dice3d.test.tsx
git commit -m "feat(dice): envia dados individuais e papel do emissor nas rolagens via socket (#74)"
```

---

### Task 6: Full Verification and Regression Testing

**Files:**

- Existing project test suites

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exit 0 with no errors.

- [ ] **Step 2: Run all relevant test suites**

Run: `npx vitest run src/lib/validators/__tests__/campaign-dice3d.test.ts src/app/api/campaigns/[id]/__tests__/dice3d-route.test.ts src/context/__tests__/SocketContext.dice3d.test.tsx src/components/campaigns/__tests__/CampaignSettingsModal.dice3d.test.tsx src/components/campaigns/__tests__/CampaignSettingsModal.test.tsx`
Expected: All suites PASS.

- [ ] **Step 3: Run git status to ensure working directory cleanliness**

Run: `git status`
Expected: clean working tree.
