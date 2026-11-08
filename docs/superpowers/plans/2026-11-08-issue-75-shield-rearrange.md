# Shield Modules Rearrange & Assets Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow dungeon masters to customize their shield workspace by reordering and moving all lateral modules (Jukebox, Assets, Worlds, Characters/NPCs, Connected Players, and Session Log) between the left and right columns via native drag-and-drop and accessibility controls in Master Settings, while adding a visibility toggle for Assets and ensuring the Session Log height auto-adjusts elastically without overflowing the screen.

**Architecture:** Extend `useMasterScreenConfig` with `showAssets: boolean`, `leftColumnOrder: ShieldModuleId[]`, and `rightColumnOrder: ShieldModuleId[]`, persisted in `localStorage`. Provide a responsive, accessible two-column drag-and-drop organizer in `MasterScreenConfigPanel` using Lucide icons. Update `CampaignDetail` to render modules dynamically according to the configured column order with flex containment on both lateral columns so the session log shrinks elastically when sharing a column with other modules.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React icons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-08-issue-75-shield-rearrange-design.md`

## Global Constraints

- Use zero external drag-and-drop libraries; leverage native HTML5 Drag and Drop events (`onDragStart`, `onDragOver`, `onDrop`) coupled with explicit keyboard/button controls (`ArrowUp`, `ArrowDown`, `ArrowLeftRight`) for complete WCAG AAA accessibility.
- All icons must come from `lucide-react` (`GripVertical`, `ArrowUp`, `ArrowDown`, `ArrowLeftRight`, `Music`, `Image`, `MapPin`, `Users`, `UserCheck`, `ScrollText`).
- Colors and tokens must strictly follow the project design system (`bg-dominant-deep`, `border-secondary-border`, `text-secondary-pure`, `text-accent-hover`, `bg-secondary-card`).
- Both `leftColumnOrder` and `rightColumnOrder` must sanitize legacy or corrupted `localStorage` payloads so that all 6 modules exist exactly once between the two columns.
- The Session Log must dynamically auto-adjust its height via `flex-1 min-h-[220px]` within an elastic column (`flex flex-col gap-3 overflow-y-auto min-h-0 h-full`) without breaking screen containment.

---

### Task 1: Hook and Types for Shield Module Ordering & Visibility

**Files:**
- Modify: `src/hooks/useMasterScreenConfig.ts`
- Test: `src/hooks/__tests__/useMasterScreenConfig.test.ts`

**Interfaces:**
- Consumes: `masterScreenConfigKey` in `localStorage`.
- Produces: `ShieldModuleId`, `DEFAULT_SHIELD_LEFT_ORDER`, `DEFAULT_SHIELD_RIGHT_ORDER`, `showAssets`, `leftColumnOrder`, and `rightColumnOrder` on `MasterScreenConfig`.

- [ ] **Step 1: Write failing test for hook defaults and sanitization**

Create `src/hooks/__tests__/useMasterScreenConfig.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useMasterScreenConfig,
  sanitizeMasterScreenConfig,
  DEFAULT_SHIELD_LEFT_ORDER,
  DEFAULT_SHIELD_RIGHT_ORDER,
  masterScreenConfigKey,
} from "../useMasterScreenConfig";

describe("useMasterScreenConfig - Module Ordering & Assets Visibility (Issue #75)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default configuration with showAssets=true and default column orders", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    expect(result.current.config.showAssets).toBe(true);
    expect(result.current.config.leftColumnOrder).toEqual(DEFAULT_SHIELD_LEFT_ORDER);
    expect(result.current.config.rightColumnOrder).toEqual(DEFAULT_SHIELD_RIGHT_ORDER);
  });

  it("sanitizes legacy localStorage data missing order and showAssets", () => {
    const legacyConfig = {
      showRoster: true,
      showSessionLog: true,
      showCanvas: true,
      showMap: true,
      showJukebox: false,
    };

    const sanitized = sanitizeMasterScreenConfig(legacyConfig);
    expect(sanitized.showAssets).toBe(true);
    expect(sanitized.leftColumnOrder).toEqual(DEFAULT_SHIELD_LEFT_ORDER);
    expect(sanitized.rightColumnOrder).toEqual(DEFAULT_SHIELD_RIGHT_ORDER);
  });

  it("recovers missing modules and removes duplicate modules during sanitization", () => {
    const corruptedConfig = {
      leftColumnOrder: ["jukebox", "jukebox"],
      rightColumnOrder: ["sessionLog"],
    };

    const sanitized = sanitizeMasterScreenConfig(corruptedConfig);
    const allModules = [...sanitized.leftColumnOrder, ...sanitized.rightColumnOrder];

    expect(new Set(allModules).size).toBe(6);
    expect(allModules).toContain("worlds");
    expect(allModules).toContain("assets");
    expect(allModules).toContain("jukebox");
    expect(allModules).toContain("charactersNpcs");
    expect(allModules).toContain("players");
    expect(allModules).toContain("sessionLog");
  });

  it("persists column order and showAssets updates to localStorage", () => {
    const { result } = renderHook(() => useMasterScreenConfig());

    act(() => {
      result.current.updateConfig({
        showAssets: false,
        leftColumnOrder: ["worlds"],
        rightColumnOrder: ["jukebox", "assets", "charactersNpcs", "players", "sessionLog"],
      });
    });

    expect(result.current.config.showAssets).toBe(false);
    expect(result.current.config.leftColumnOrder).toEqual(["worlds"]);

    const stored = JSON.parse(localStorage.getItem(masterScreenConfigKey) || "{}");
    expect(stored.showAssets).toBe(false);
    expect(stored.leftColumnOrder).toEqual(["worlds"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useMasterScreenConfig.test.ts`
Expected: FAIL with missing properties on `MasterScreenConfig`.

- [ ] **Step 3: Update `src/hooks/useMasterScreenConfig.ts`**

Update `src/hooks/useMasterScreenConfig.ts`:
```typescript
"use client";

import { useCallback, useState } from "react";

export type ShieldModuleId =
  | "worlds"
  | "assets"
  | "jukebox"
  | "charactersNpcs"
  | "players"
  | "sessionLog";

export const ALL_SHIELD_MODULES: readonly ShieldModuleId[] = [
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
  "sessionLog",
] as const;

export const DEFAULT_SHIELD_LEFT_ORDER: ShieldModuleId[] = [
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
];

export const DEFAULT_SHIELD_RIGHT_ORDER: ShieldModuleId[] = [
  "sessionLog",
];

export type MasterScreenConfig = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox: boolean;
  showDiceRolls: boolean;
  showCharactersNpcs: boolean;
  showPlayers: boolean;
  showAssets: boolean;
  leftColumnOrder: ShieldModuleId[];
  rightColumnOrder: ShieldModuleId[];
  aiApiKey?: string;
  aiApiEndpoint?: string;
  aiModel?: string;
};

export type MasterScreenConfigPayload = MasterScreenConfig & {
  version?: number;
};

export const DEFAULT_MASTER_SCREEN_CONFIG: MasterScreenConfig = {
  showRoster: true,
  showSessionLog: true,
  showCanvas: true,
  showMap: true,
  showJukebox: true,
  showDiceRolls: true,
  showCharactersNpcs: true,
  showPlayers: true,
  showAssets: true,
  leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
  rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
  aiApiKey: "",
  aiApiEndpoint: "",
  aiModel: "",
};

export const masterScreenConfigKey = "libmork:master-screen-config";

function sanitizeColumnOrder(
  leftInput: unknown,
  rightInput: unknown
): { left: ShieldModuleId[]; right: ShieldModuleId[] } {
  const isModuleId = (val: unknown): val is ShieldModuleId =>
    typeof val === "string" && ALL_SHIELD_MODULES.includes(val as ShieldModuleId);

  const rawLeft = Array.isArray(leftInput) ? leftInput.filter(isModuleId) : [];
  const rawRight = Array.isArray(rightInput) ? rightInput.filter(isModuleId) : [];

  const seen = new Set<ShieldModuleId>();
  const cleanLeft: ShieldModuleId[] = [];
  const cleanRight: ShieldModuleId[] = [];

  for (const m of rawLeft) {
    if (!seen.has(m)) {
      seen.add(m);
      cleanLeft.push(m);
    }
  }

  for (const m of rawRight) {
    if (!seen.has(m)) {
      seen.add(m);
      cleanRight.push(m);
    }
  }

  // Any missing modules are appended to their default column
  for (const defaultModule of DEFAULT_SHIELD_LEFT_ORDER) {
    if (!seen.has(defaultModule)) {
      seen.add(defaultModule);
      cleanLeft.push(defaultModule);
    }
  }
  for (const defaultModule of DEFAULT_SHIELD_RIGHT_ORDER) {
    if (!seen.has(defaultModule)) {
      seen.add(defaultModule);
      cleanRight.push(defaultModule);
    }
  }

  return { left: cleanLeft, right: cleanRight };
}

export function sanitizeMasterScreenConfig(value: unknown): MasterScreenConfig {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_MASTER_SCREEN_CONFIG,
      leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
      rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
    };
  }
  const input = value as Record<string, unknown>;
  const { left, right } = sanitizeColumnOrder(input.leftColumnOrder, input.rightColumnOrder);

  return {
    showRoster: typeof input.showRoster === "boolean" ? input.showRoster : true,
    showSessionLog: typeof input.showSessionLog === "boolean" ? input.showSessionLog : true,
    showCanvas: typeof input.showCanvas === "boolean" ? input.showCanvas : true,
    showMap: typeof input.showMap === "boolean" ? input.showMap : true,
    showJukebox: typeof input.showJukebox === "boolean" ? input.showJukebox : true,
    showDiceRolls: typeof input.showDiceRolls === "boolean" ? input.showDiceRolls : true,
    showCharactersNpcs: typeof input.showCharactersNpcs === "boolean" ? input.showCharactersNpcs : true,
    showPlayers: typeof input.showPlayers === "boolean" ? input.showPlayers : true,
    showAssets: typeof input.showAssets === "boolean" ? input.showAssets : true,
    leftColumnOrder: left,
    rightColumnOrder: right,
    aiApiKey: typeof input.aiApiKey === "string" ? input.aiApiKey : "",
    aiApiEndpoint: typeof input.aiApiEndpoint === "string" ? input.aiApiEndpoint : "",
    aiModel: typeof input.aiModel === "string" ? input.aiModel : "",
  };
}

export function useMasterScreenConfig() {
  const [config, setConfig] = useState<MasterScreenConfig>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_MASTER_SCREEN_CONFIG };
    try {
      const stored = window.localStorage.getItem(masterScreenConfigKey);
      return stored ? sanitizeMasterScreenConfig(JSON.parse(stored)) : { ...DEFAULT_MASTER_SCREEN_CONFIG };
    } catch {
      return { ...DEFAULT_MASTER_SCREEN_CONFIG };
    }
  });
  const [isLoaded] = useState(true);

  const updateConfig = useCallback((patch: Partial<MasterScreenConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(masterScreenConfigKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({
      ...DEFAULT_MASTER_SCREEN_CONFIG,
      leftColumnOrder: [...DEFAULT_SHIELD_LEFT_ORDER],
      rightColumnOrder: [...DEFAULT_SHIELD_RIGHT_ORDER],
    });
    try {
      window.localStorage.setItem(
        masterScreenConfigKey,
        JSON.stringify(DEFAULT_MASTER_SCREEN_CONFIG)
      );
    } catch {
      // ignore
    }
  }, []);

  return {
    config,
    isLoaded,
    updateConfig,
    resetConfig,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useMasterScreenConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMasterScreenConfig.ts src/hooks/__tests__/useMasterScreenConfig.test.ts
git commit -m "feat(config): adiciona visibilidade de assets e ordenacao de modulos do escudo (#75)"
```

---

### Task 2: Drag & Drop and Accessible Reordering UI in Config Panel

**Files:**
- Modify: `src/components/campaigns/MasterScreenConfigPanel.tsx`
- Test: `src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx`

**Interfaces:**
- Consumes: `MasterScreenConfig`, `onUpdate`, `onReset`.
- Produces: UI with Assets checkbox toggle and accessible HTML5 drag-and-drop module organizer using `lucide-react` icons.

- [ ] **Step 1: Write failing test for config panel reordering and assets toggle**

Create `src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx`:
```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MasterScreenConfigPanel } from "../MasterScreenConfigPanel";
import { DEFAULT_MASTER_SCREEN_CONFIG } from "@/hooks/useMasterScreenConfig";

describe("MasterScreenConfigPanel - Reordering & Assets Visibility (Issue #75)", () => {
  it("renders Assets & Handouts visibility checkbox and calls onUpdate when clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />
    );

    const assetsCheckbox = screen.getByLabelText(/Assets e Handouts/i);
    expect(assetsCheckbox).toBeInTheDocument();
    expect((assetsCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(assetsCheckbox);
    expect(handleUpdate).toHaveBeenCalledWith({ showAssets: false });
  });

  it("renders both left and right columns with Lucide-styled module cards", () => {
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText("Coluna Esquerda (Gestão)")).toBeInTheDocument();
    expect(screen.getByText("Coluna Direita (Logs)")).toBeInTheDocument();

    expect(screen.getByTestId("module-card-jukebox")).toBeInTheDocument();
    expect(screen.getByTestId("module-card-sessionLog")).toBeInTheDocument();
    expect(screen.getByTestId("module-card-assets")).toBeInTheDocument();
  });

  it("moves module to opposite column when switch-column button is clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />
    );

    const moveJukeboxBtn = screen.getByTestId("btn-move-col-jukebox");
    fireEvent.click(moveJukeboxBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        leftColumnOrder: expect.not.arrayContaining(["jukebox"]),
        rightColumnOrder: expect.arrayContaining(["jukebox"]),
      })
    );
  });

  it("reorders module up and down within column when arrow buttons are clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />
    );

    const moveDownWorldsBtn = screen.getByTestId("btn-move-down-worlds");
    fireEvent.click(moveDownWorldsBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        leftColumnOrder: ["assets", "worlds", "jukebox", "charactersNpcs", "players"],
      })
    );
  });

  it("handles native drag-and-drop between columns", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={DEFAULT_MASTER_SCREEN_CONFIG}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />
    );

    const jukeboxCard = screen.getByTestId("module-card-jukebox");
    const rightColDropZone = screen.getByTestId("dropzone-right");

    fireEvent.dragStart(jukeboxCard);
    fireEvent.dragOver(rightColDropZone);
    fireEvent.drop(rightColDropZone);

    expect(handleUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx`
Expected: FAIL with missing elements.

- [ ] **Step 3: Implement reordering UI in `MasterScreenConfigPanel.tsx`**

Modify `src/components/campaigns/MasterScreenConfigPanel.tsx` to:
1. Import Lucide icons:
   ```tsx
   import {
     GripVertical,
     ArrowUp,
     ArrowDown,
     ArrowLeftRight,
     Music,
     Image,
     MapPin,
     Users,
     UserCheck,
     ScrollText,
   } from "lucide-react";
   import type { ShieldModuleId } from "@/hooks/useMasterScreenConfig";
   ```
2. Add metadata dictionary for module names, descriptions, and icons:
   ```tsx
   const MODULE_META: Record<
     ShieldModuleId,
     { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
   > = {
     worlds: { label: "Mundos & Cenas", icon: MapPin },
     assets: { label: "Assets & Handouts", icon: Image },
     jukebox: { label: "Jukebox de Áudio", icon: Music },
     charactersNpcs: { label: "Personagens & NPCs", icon: Users },
     players: { label: "Jogadores Conectados", icon: UserCheck },
     sessionLog: { label: "Log da Sessão", icon: ScrollText },
   };
   ```
3. Add the `showAssets` checkbox under "Painel de Gestão & Áudio".
4. Add state for `draggedModule: ShieldModuleId | null`.
5. Implement column move (`moveModule(moduleId, targetCol, targetIndex)`), reorder within column (`reorderWithin(col, fromIndex, toIndex)`), and switch column (`switchColumn(moduleId)`).
6. Render the two columns with drag handle, item titles, status badges (`Ativo`/`Oculto` checking the respective `show*` property), and accessibility buttons (`btn-move-up-${m}`, `btn-move-down-${m}`, `btn-move-col-${m}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx src/components/campaigns/__tests__/MasterScreenConfigPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/MasterScreenConfigPanel.tsx src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx
git commit -m "feat(ui): adiciona organizador de colunas e drag-and-drop nas configuracoes (#75)"
```

---

### Task 3: Live Preview Updates for Reordered Columns

**Files:**
- Modify: `src/components/campaigns/MasterScreenPreview.tsx`
- Test: `src/components/campaigns/__tests__/MasterScreenPreview.test.tsx`

**Interfaces:**
- Consumes: `leftColumnOrder`, `rightColumnOrder`, `showAssets` in `MasterScreenPreviewProps`.
- Produces: Live visual representation reflecting items dynamically in column 1 vs column 3.

- [ ] **Step 1: Write failing test for preview reflection**

Create `src/components/campaigns/__tests__/MasterScreenPreview.test.tsx`:
```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MasterScreenPreview } from "../MasterScreenPreview";

describe("MasterScreenPreview Component (Issue #75)", () => {
  it("renders modules in their configured columns", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={true}
        showMap={true}
        showJukebox={true}
        showAssets={true}
        leftColumnOrder={["worlds"]}
        rightColumnOrder={["sessionLog", "jukebox"]}
      />
    );

    const leftCol = screen.getByTestId("preview-left-col");
    const rightCol = screen.getByTestId("preview-right-col");

    expect(leftCol).toHaveTextContent(/Mundos/i);
    expect(rightCol).toHaveTextContent(/Jukebox/i);
    expect(rightCol).toHaveTextContent(/Logs/i);
  });

  it("hides assets when showAssets is false", () => {
    render(
      <MasterScreenPreview
        showRoster={true}
        showSessionLog={true}
        showCanvas={true}
        showMap={true}
        showAssets={false}
        leftColumnOrder={["assets"]}
        rightColumnOrder={["sessionLog"]}
      />
    );

    expect(screen.queryByText(/Assets/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/campaigns/__tests__/MasterScreenPreview.test.tsx`
Expected: FAIL with missing props/elements.

- [ ] **Step 3: Update `MasterScreenPreview.tsx`**

Update `MasterScreenPreview.tsx`:
- Extend `MasterScreenPreviewProps`:
  ```typescript
  type MasterScreenPreviewProps = {
    showRoster: boolean;
    showSessionLog: boolean;
    showCanvas: boolean;
    showMap: boolean;
    showJukebox?: boolean;
    showDiceRolls?: boolean;
    showCharactersNpcs?: boolean;
    showPlayers?: boolean;
    showAssets?: boolean;
    leftColumnOrder?: ShieldModuleId[];
    rightColumnOrder?: ShieldModuleId[];
  };
  ```
- Use `data-testid="preview-left-col"` and `data-testid="preview-right-col"`.
- Dynamically render preview badges based on `leftColumnOrder` and `rightColumnOrder`, filtering out modules whose `show*` flag is `false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/campaigns/__tests__/MasterScreenPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/MasterScreenPreview.tsx src/components/campaigns/__tests__/MasterScreenPreview.test.tsx
git commit -m "feat(preview): reflete ordenacao de colunas no preview do escudo (#75)"
```

---

### Task 4: Dynamic Module Rendering and Auto-Adjusting Log Height in Shield

**Files:**
- Modify: `src/components/campaigns/CampaignDetail.tsx`
- Test: `src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx`

**Interfaces:**
- Consumes: `screenConfig.leftColumnOrder`, `screenConfig.rightColumnOrder`, `screenConfig.showAssets`.
- Produces: Dynamic placement of all 6 modules across left and right columns, with `showAssets` check, separated `CampaignInvites` rendering, and elastic auto-adjustment of `SessionLog` without overflowing.

- [ ] **Step 1: Write failing test for dynamic module placement and height containment**

Create `src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx`:
```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";
import { masterScreenConfigKey } from "@/hooks/useMasterScreenConfig";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: () => <div data-testid="master-roster-mock" />,
}));
vi.mock("@/components/campaigns/ContentOverlay", () => ({ ContentOverlay: () => null }));
vi.mock("@/components/campaigns/WorldOverlay", () => ({ WorldOverlay: () => null }));
vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="master-jukebox-mock" />,
}));
vi.mock("@/components/campaigns/MasterAssetsPanel", () => ({
  MasterAssetsPanel: () => <div data-testid="master-assets-mock" />,
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log-mock" className="flex-1 min-h-0" />,
}));
vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: ({ showCharactersNpcs, showPlayers }: any) => (
    <div data-testid={`campaign-invites-${showCharactersNpcs ? "npcs" : "players"}`} />
  ),
}));
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    subscribeCampaignLogCreated: vi.fn(() => vi.fn()),
    subscribeCampaignLogUpdated: vi.fn(() => vi.fn()),
    subscribeDiceRoll: vi.fn(() => vi.fn()),
    setCampaignDice3DSettings: vi.fn(),
  }),
}));

describe("CampaignDetail Dynamic Column Module Placement (Issue #75)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { id: "camp-1", name: "Campanha Teste", rulesEngine: "d20_mod" },
        }),
      });
    }) as any;
  });

  it("renders Jukebox and Assets in the right column when configured in rightColumnOrder", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showAssets: true,
        showSessionLog: true,
        leftColumnOrder: ["worlds", "charactersNpcs", "players"],
        rightColumnOrder: ["jukebox", "assets", "sessionLog"],
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    const leftCol = screen.getByTestId("shield-left-column");
    const rightCol = screen.getByTestId("shield-right-column");

    expect(leftCol).not.toContainElement(screen.getByTestId("master-jukebox-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-jukebox-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-assets-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("session-log-mock"));
  });

  it("hides MasterAssetsPanel when showAssets is false", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showAssets: false,
        leftColumnOrder: ["assets", "worlds"],
        rightColumnOrder: ["sessionLog"],
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("master-assets-mock")).not.toBeInTheDocument();
  });

  it("maintains flex-1 and min-h-0 on SessionLog container when sharing column with other modules", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showSessionLog: true,
        leftColumnOrder: ["worlds"],
        rightColumnOrder: ["jukebox", "sessionLog"],
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-right-column")).toBeInTheDocument();
    });

    const rightCol = screen.getByTestId("shield-right-column");
    expect(rightCol.className).toContain("overflow-y-auto");
    expect(rightCol.className).toContain("flex-col");
    expect(rightCol.className).toContain("min-h-0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx`
Expected: FAIL with elements still in fixed columns.

- [ ] **Step 3: Refactor `CampaignDetail.tsx` for dynamic modular layout**

In `src/components/campaigns/CampaignDetail.tsx`:
1. Add `data-testid="shield-left-column"` to the left column wrapper and `data-testid="shield-right-column"` to the right column wrapper.
2. Implement a `renderModule(moduleId: ShieldModuleId)` helper inside `CampaignDetail`:
   - Case `"worlds"`: if `screenConfig.showMap`, render the Worlds panel with `ResizeHandle`.
   - Case `"assets"`: if `screenConfig.showAssets`, render `<MasterAssetsPanel campaignId={campaign.id} initialActiveAssetId={campaign.activeAssetId} isCompact={false} />`.
   - Case `"jukebox"`: if `screenConfig.showJukebox`, render `<MasterJukebox campaignId={campaign.id} />`.
   - Case `"charactersNpcs"`: if `screenConfig.showCharactersNpcs`, render `<CampaignInvites key={...} campaignId={campaign.id} showCharactersNpcs={true} showPlayers={false} />`.
   - Case `"players"`: if `screenConfig.showPlayers`, render `<CampaignInvites key={...} campaignId={campaign.id} showCharactersNpcs={false} showPlayers={true} />`.
   - Case `"sessionLog"`: if `screenConfig.showSessionLog`, render the SessionLog card (`flex-1 min-h-[220px]`).
3. In the Left Column JSX:
   ```tsx
   <div
     data-testid="shield-left-column"
     className="relative flex flex-col gap-3 overflow-y-auto min-h-0 h-full min-w-0"
   >
     {screenConfig.leftColumnOrder.map((modId) => (
       <React.Fragment key={`left-${modId}`}>
         {renderModule(modId)}
       </React.Fragment>
     ))}
     <ResizeHandle ... />
   </div>
   ```
4. In the Right Column JSX:
   ```tsx
   {hasRightColumnModules && (
     <div
       data-testid="shield-right-column"
       className="relative flex flex-col gap-3 overflow-y-auto min-h-0 h-full min-w-0"
     >
       {screenConfig.rightColumnOrder.map((modId) => (
         <React.Fragment key={`right-${modId}`}>
           {renderModule(modId)}
         </React.Fragment>
       ))}
       <ResizeHandle ... />
     </div>
   )}
   ```
5. Update `MasterScreenConfigIntegration` test assertions to maintain test health.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx src/components/campaigns/__tests__/CampaignDetail.shieldGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/CampaignDetail.tsx src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx
git commit -m "feat(campaigns): renderiza modulos do escudo dinamicamente com ajuste de altura (#75)"
```

---

### Task 5: End-to-End Type Safety and Regression Suite

**Files:**
- All touched files and existing test suites

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npx tsc --noEmit`
Expected: 0 errors, clean exit.

- [ ] **Step 2: Run all related unit and integration test suites**

Run: `npx vitest run src/hooks/__tests__/useMasterScreenConfig.test.ts src/components/campaigns/__tests__/MasterScreenConfigPanel.reorder.test.tsx src/components/campaigns/__tests__/MasterScreenPreview.test.tsx src/components/campaigns/__tests__/CampaignDetail.moduleLayout.test.tsx src/components/campaigns/__tests__/MasterScreenConfigPanel.test.tsx src/components/campaigns/__tests__/CampaignDetail.shieldGrid.test.tsx`
Expected: All suites PASS.

- [ ] **Step 3: Verify git status is clean**

Run: `git status`
Expected: working tree clean.
