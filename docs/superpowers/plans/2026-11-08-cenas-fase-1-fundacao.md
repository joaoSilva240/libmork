# Cenas do Mestre — Fase 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundação da mecânica de Cenas do escudo do mestre: colunas no banco, rota `PATCH /scene` com log de sessão, relay socket, módulo declarativo `sceneConfig`, hook `useCampaignScene` e `SceneBar` no header — sem efeitos de comportamento ainda (são a Fase 2).

**Architecture:** Estado da cena ativa mora em `campaigns.active_scene` (precedente: `active_asset_id`), persistido via REST e propagado pela sala Socket.IO `campaign:{id}` (padrão do #62). `src/lib/scenes/sceneConfig.ts` é a fonte declarativa única (metadados + matriz cena→módulos) que a Fase 2 consumirá; `useCampaignScene` centraliza leitura/salva/subscribe; `SceneBar` é a UI do header. A cena ativa NÃO altera visibilidade de carrossel/estabelecimentos/jukebox nesta fase.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM 0.45 + PostgreSQL, Socket.IO 4 (server custom em `server.js`), Vitest 2 + @testing-library/react (jsdom, globals), Tailwind 4, lucide-react.

**Spec:** issue #86 — https://github.com/joaoSilva240/libmork/issues/86 (seção "Fases de implementação" → Fase 1). Não há arquivo de spec separado; a issue é o documento de design.

## Global Constraints

- Branch de trabalho: `feature/issue-86-scenes-foundation` (criada a partir do HEAD atual `3f1938a`), no worktree da sessão `C:\Users\kyone\.qoder\worktrees\app\bfd239\libmork`. Nunca usar worktrees paralelos em Documents/Dev; nunca tocar no repo principal.
- Commits: Conventional Commits com descrição em PT-BR (ex.: `feat(scenes): ...`), um commit por tarefa. Não fazer push sem pedido explícito.
- Valores de cena: `combat | interlude | stealth | investigation | escape`; `NULL` = modo Livre (neutro).
- Sem novas dependências.
- Ícones: somente lucide-react (proibido emoji em componente de interface).
- Migração: arquivo SQL idempotente escrito à mão em `drizzle/` (estilo 0021/0022) + aplicação local via `npm run db:push` (requer `.env.local` com `DATABASE_URL`). Não usar `db:generate` (não há `drizzle/meta/_journal.json`).
- Testes: Vitest; arquivos em `__tests__/` ao lado da fonte; rotas de API testadas com `vi.mock` de `@/lib/db`, `@/lib/auth/session`, `@/lib/auth/campaign-access`, `@/lib/logger` (padrão de `src/app/api/campaigns/[id]/assets/__tests__/route.test.ts`).
- Campanhas `missing_zero`: barra de cenas não renderiza (gate no `CampaignDetail`, que já calcula `isMissing`).

## File Structure

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modify | `src/lib/db/schema.ts` | colunas `campaigns.active_scene` e `campaign_audio_tracks.scene` |
| Create | `drizzle/0023_add_scene_columns.sql` | migração SQL idempotente das duas colunas |
| Modify | `src/types/index.ts` | `Campaign.activeScene?: string \| null` |
| Create | `src/lib/scenes/sceneConfig.ts` | tipos, metadados por cena (label/ícone/cores), matriz declarativa cena→módulos, validadores |
| Create | `src/lib/scenes/__tests__/sceneConfig.test.ts` | unit tests do módulo puro |
| Create | `src/app/api/campaigns/[id]/scene/route.ts` | `PATCH` persiste cena + insere log `scene_change` |
| Create | `src/app/api/campaigns/[id]/scene/__tests__/route.test.ts` | unit tests da rota (401/403/400/200/log) |
| Modify | `server.js` | relay `scene-changed` para a sala `campaign:{id}` |
| Create | `src/hooks/useCampaignScene.ts` | estado + PATCH + emit + subscribe socket, rollback em falha |
| Create | `src/hooks/__tests__/useCampaignScene.test.ts` | unit tests do hook com socket fake |
| Create | `src/components/campaigns/SceneBar.tsx` | 5 botões + label "Cena:", toggle para Livre |
| Create | `src/components/campaigns/__tests__/SceneBar.test.tsx` | unit tests do componente |
| Modify | `src/components/campaigns/CampaignDetail.tsx` | integra hook, renderiza SceneBar no header, accent da cena no header, `data-testid="shield-header"` |
| Create | `src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx` | teste de integração (barra presente/ausente, clique → PATCH) |

---

### Task 1: Colunas de dados (schema + migração SQL + tipo Campaign)

**Files:**
- Modify: `src/lib/db/schema.ts` (tabela `campaigns`, após `activeAssetId` ~linha 172; tabela `campaignAudioTracks`, após `playlistName` ~linha 218)
- Create: `drizzle/0023_add_scene_columns.sql`
- Modify: `src/types/index.ts` (type `Campaign`, ~linha 146, após `activeAsset`)
- Test: `src/lib/db/__tests__/schema.sceneColumns.test.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces: `campaigns.activeScene` / `campaignAudioTracks.scene` (drizzle columns, `varchar(20)` nullable); `Campaign.activeScene?: string | null`.

- [ ] **Step 1: Criar a branch e commitar o plano**

```bash
git checkout -b feature/issue-86-scenes-foundation
git add docs/superpowers/plans/2026-11-08-cenas-fase-1-fundacao.md
git commit -m "docs(plans): plano de implementacao da fase 1 de cenas (issue #86)"
```

- [ ] **Step 2: Escrever o teste falho**

Criar `src/lib/db/__tests__/schema.sceneColumns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { campaigns, campaignAudioTracks } from "../schema";

describe("schema — colunas de cena (issue #86, Fase 1)", () => {
  it("campaigns expõe active_scene como varchar nullable", () => {
    const col = getTableConfig(campaigns).columns.find((c) => c.name === "active_scene");
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(false);
    expect(col?.type).toBe("string");
  });

  it("campaign_audio_tracks expõe scene como varchar nullable", () => {
    const col = getTableConfig(campaignAudioTracks).columns.find((c) => c.name === "scene");
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(false);
    expect(col?.type).toBe("string");
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar falha**

Run: `npx vitest run src/lib/db/__tests__/schema.sceneColumns.test.ts`
Expected: FAIL — `expect(col).toBeDefined()` falha (colunas não existem).

- [ ] **Step 4: Adicionar as colunas ao schema**

Em `src/lib/db/schema.ts`, na tabela `campaigns`, inserir após o bloco de `activeAssetId` (linha ~172, antes de `createdAt`):

```ts
  /** Cena ativa do escudo do mestre (issue #86). null = modo Livre. */
  activeScene: varchar("active_scene", { length: 20 }),
```

Na tabela `campaign_audio_tracks`, inserir após `playlistName` (linha ~218):

```ts
    scene: varchar("scene", { length: 20 }), // cena de destino; null = faixa geral (issue #86)
```

- [ ] **Step 5: Criar a migração SQL idempotente**

Criar `drizzle/0023_add_scene_columns.sql` (estilo dos arquivos 0021/0022):

```sql
-- Migration 0023: Colunas de cena nas campanhas e trilhas da jukebox (Issue #86 — Fase 1)

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "active_scene" varchar(20);

ALTER TABLE "campaign_audio_tracks" ADD COLUMN IF NOT EXISTS "scene" varchar(20);
```

- [ ] **Step 6: Estender o type Campaign**

Em `src/types/index.ts`, no type `Campaign`, inserir após `activeAsset?: CampaignAsset | null;` (linha ~146):

```ts
  activeScene?: string | null;
```

- [ ] **Step 7: Rodar o teste e confirmar passagem**

Run: `npx vitest run src/lib/db/__tests__/schema.sceneColumns.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 9: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/__tests__/schema.sceneColumns.test.ts drizzle/0023_add_scene_columns.sql src/types/index.ts
git commit -m "feat(scenes): colunas active_scene e scene no schema com migracao 0023"
```

---

### Task 2: Módulo declarativo de cenas (`sceneConfig.ts`)

**Files:**
- Create: `src/lib/scenes/sceneConfig.ts`
- Test: `src/lib/scenes/__tests__/sceneConfig.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro; Task 1 não é necessário para rodar, mas os valores de cena são os mesmos).
- Produces: `SCENE_VALUES`, `SceneType`, `ActiveScene`, `SceneMeta`, `SceneModuleState`, `SCENES: Record<SceneType, SceneMeta>`, `SCENE_ORDER: SceneType[]`, `SCENE_MATRIX: Record<SceneType, SceneModuleState>`, `NEUTRAL_MODULES: SceneModuleState`, `modulesForScene(scene: ActiveScene): SceneModuleState`, `isSceneValue(v: unknown): v is SceneType`, `sanitizeActiveScene(v: unknown): ActiveScene`. (A matriz é consumida de verdade na Fase 2; aqui só é declarada e testada.)

- [ ] **Step 1: Escrever o teste falho**

Criar `src/lib/scenes/__tests__/sceneConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SCENE_VALUES,
  SCENE_ORDER,
  SCENES,
  SCENE_MATRIX,
  NEUTRAL_MODULES,
  modulesForScene,
  isSceneValue,
  sanitizeActiveScene,
} from "../sceneConfig";

describe("sceneConfig (issue #86, Fase 1)", () => {
  it("SCENE_ORDER cobre exatamente SCENE_VALUES, na ordem do header", () => {
    expect(SCENE_ORDER).toEqual(["combat", "interlude", "stealth", "investigation", "escape"]);
    expect([...SCENE_VALUES].sort()).toEqual([...SCENE_ORDER].sort());
  });

  it("toda cena tem meta completo (label PT-BR, icon, cores) e linha na matriz", () => {
    for (const value of SCENE_ORDER) {
      const meta = SCENES[value];
      expect(meta.value).toBe(value);
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon).toBeTruthy();
      expect(meta.activeClasses).toContain("text-");
      expect(meta.accentClasses).toContain("shadow-");
      expect(SCENE_MATRIX[value]).toBeDefined();
      expect(SCENE_MATRIX[value].carousel).toMatch(/^(neutral|visible|hidden)$/);
      expect(SCENE_MATRIX[value].combatBar).toMatch(/^(neutral|visible|hidden)$/);
      expect(SCENE_MATRIX[value].establishments).toMatch(/^(neutral|visible|hidden)$/);
    }
  });

  it("matriz reflete a spec: carrossel visível só em combate; estabelecimentos visíveis só em interlúdio", () => {
    expect(SCENE_MATRIX.combat.carousel).toBe("visible");
    expect(SCENE_MATRIX.interlude.carousel).toBe("hidden");
    expect(SCENE_MATRIX.stealth.carousel).toBe("hidden");
    expect(SCENE_MATRIX.investigation.carousel).toBe("hidden");
    expect(SCENE_MATRIX.escape.carousel).toBe("hidden");
    expect(SCENE_MATRIX.interlude.establishments).toBe("visible");
    expect(SCENE_MATRIX.combat.establishments).toBe("hidden");
    expect(SCENE_MATRIX.escape.establishments).toBe("hidden");
  });

  it("modulesForScene devolve neutro para Livre e a linha da cena quando ativa", () => {
    expect(modulesForScene(null)).toBe(NEUTRAL_MODULES);
    expect(modulesForScene("combat")).toBe(SCENE_MATRIX.combat);
  });

  it("isSceneValue aceita só os 5 valores e rejeita o resto", () => {
    expect(isSceneValue("combat")).toBe(true);
    expect(isSceneValue("escape")).toBe(true);
    expect(isSceneValue("luta")).toBe(false);
    expect(isSceneValue(null)).toBe(false);
    expect(isSceneValue(undefined)).toBe(false);
    expect(isSceneValue(42)).toBe(false);
  });

  it("sanitizeActiveScene normaliza desconhecidos para null (Livre)", () => {
    expect(sanitizeActiveScene("stealth")).toBe("stealth");
    expect(sanitizeActiveScene(null)).toBeNull();
    expect(sanitizeActiveScene("xyz")).toBeNull();
    expect(sanitizeActiveScene(123)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/scenes/__tests__/sceneConfig.test.ts`
Expected: FAIL — módulo não existe (`Cannot find module '../sceneConfig'`).

- [ ] **Step 3: Implementar o módulo**

Criar `src/lib/scenes/sceneConfig.ts`:

```ts
// =============================================================================
// Libmork — Cenas do Mestre: metadados e matriz declarativa (Issue #86, Fase 1)
// =============================================================================
// Fonte única do que cada cena significa. A matriz é declarada aqui e aplicada
// pelos componentes na Fase 2; nesta fase apenas SceneBar e o header a usam.
// =============================================================================

import { Beer, EyeOff, Footprints, Search, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SCENE_VALUES = ["combat", "interlude", "stealth", "investigation", "escape"] as const;

export type SceneType = (typeof SCENE_VALUES)[number];

/** null = modo Livre (neutro, comportamento anterior do escudo). */
export type ActiveScene = SceneType | null;

export type ModuleVisibility = "neutral" | "visible" | "hidden";

export interface SceneModuleState {
  carousel: ModuleVisibility;
  combatBar: ModuleVisibility;
  establishments: ModuleVisibility;
}

export interface SceneMeta {
  value: SceneType;
  label: string;
  icon: LucideIcon;
  /** Classes do botão quando a cena está ativa. */
  activeClasses: string;
  /** Classes de destaque da cena no header do escudo (Fase 1). */
  accentClasses: string;
}

export const SCENE_ORDER: SceneType[] = [
  "combat",
  "interlude",
  "stealth",
  "investigation",
  "escape",
];

export const SCENES: Record<SceneType, SceneMeta> = {
  combat: {
    value: "combat",
    label: "Combate",
    icon: Swords,
    activeClasses: "border-red-400 bg-red-600 text-white",
    accentClasses: "border-red-500/70 shadow-red-950/40",
  },
  interlude: {
    value: "interlude",
    label: "Interlúdio",
    icon: Beer,
    activeClasses: "border-emerald-400 bg-emerald-600 text-white",
    accentClasses: "border-emerald-500/70 shadow-emerald-950/40",
  },
  stealth: {
    value: "stealth",
    label: "Furtividade",
    icon: EyeOff,
    activeClasses: "border-indigo-400 bg-indigo-600 text-white",
    accentClasses: "border-indigo-500/70 shadow-indigo-950/40",
  },
  investigation: {
    value: "investigation",
    label: "Investigação",
    icon: Search,
    activeClasses: "border-amber-400 bg-amber-600 text-white",
    accentClasses: "border-amber-500/70 shadow-amber-950/40",
  },
  escape: {
    value: "escape",
    label: "Fuga",
    icon: Footprints,
    activeClasses: "border-orange-400 bg-orange-600 text-white",
    accentClasses: "border-orange-500/70 shadow-orange-950/40",
  },
};

/** Neutro = comportamento atual do escudo, módulo por módulo. */
export const NEUTRAL_MODULES: SceneModuleState = {
  carousel: "neutral",
  combatBar: "neutral",
  establishments: "neutral",
};

// "hidden" = oculto sem perder estado (desk/preferências/combate preservados).
export const SCENE_MATRIX: Record<SceneType, SceneModuleState> = {
  combat: { carousel: "visible", combatBar: "visible", establishments: "hidden" },
  interlude: { carousel: "hidden", combatBar: "hidden", establishments: "visible" },
  stealth: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
  investigation: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
  escape: { carousel: "hidden", combatBar: "hidden", establishments: "hidden" },
};

export function modulesForScene(scene: ActiveScene): SceneModuleState {
  return scene ? SCENE_MATRIX[scene] : NEUTRAL_MODULES;
}

export function isSceneValue(value: unknown): value is SceneType {
  return typeof value === "string" && (SCENE_VALUES as readonly string[]).includes(value);
}

export function sanitizeActiveScene(value: unknown): ActiveScene {
  return isSceneValue(value) ? value : null;
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/scenes/__tests__/sceneConfig.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scenes
git commit -m "feat(scenes): modulo declarativo sceneConfig com matriz cena-modulos"
```

---

### Task 3: Rota `PATCH /api/campaigns/[id]/scene` com log de sessão

**Files:**
- Create: `src/app/api/campaigns/[id]/scene/route.ts`
- Test: `src/app/api/campaigns/[id]/scene/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `isSceneValue`, `SCENES`, `SceneType` (Task 2); `campaigns.activeScene` (Task 1); `requireAuth`, `getCampaignAsMaster`, `campaignLogs` (existentes).
- Produces: `PATCH /api/campaigns/:id/scene` — body `{ scene: SceneType | null, encounterAction?: "ended" | "kept" }`; resposta `{ success: true, data: { campaignId, scene } }`; log `action: "scene_change"`.

- [ ] **Step 1: Escrever o teste falho**

Criar `src/app/api/campaigns/[id]/scene/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/auth/campaign-access", () => ({ getCampaignAsMaster: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { requireAuth } = await import("@/lib/auth/session");
const { getCampaignAsMaster } = await import("@/lib/auth/campaign-access");

const MASTER_SESSION = {
  user: { id: "master-1", displayName: "Mestre Teste", masterName: "Mestre Teste" },
  session: { id: "s1" },
};

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/campaigns/c1/scene", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function wireUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  mockUpdate.mockReturnValue({ set });
  return { set, where };
}

function wireInsertChain() {
  const values = vi.fn().mockResolvedValue([]);
  mockInsert.mockReturnValue({ values });
  return values;
}

describe("PATCH /api/campaigns/[id]/scene (issue #86, Fase 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(MASTER_SESSION as never);
    vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1" } as never);
    wireUpdateChain();
    wireInsertChain();
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Não autenticado");
  });

  it("retorna 403 quando não é o mestre da campanha", async () => {
    vi.mocked(getCampaignAsMaster).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 400 para cena inválida", async () => {
    const res = await PATCH(patchRequest({ scene: "luta" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cena inválida");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persiste cena válida, registra log e devolve 200", async () => {
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: { campaignId: "c1", scene: "combat" } });

    const { set } = mockUpdate.mock.results[0].value;
    expect(set.mock.calls[0][0]).toMatchObject({ activeScene: "combat" });

    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0]).toMatchObject({
      campaignId: "c1",
      action: "scene_change",
      description: "Cena: Combate iniciada",
      payload: { scene: "combat", encounterAction: null },
    });
  });

  it("scene null (Livre) persiste null com log de desativação", async () => {
    const res = await PATCH(patchRequest({ scene: null }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const { set } = mockUpdate.mock.results[0].value;
    expect(set.mock.calls[0][0]).toMatchObject({ activeScene: null });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].description).toBe("Cena desativada — modo Livre");
  });

  it("anexa encounterAction ao log quando informado", async () => {
    await PATCH(patchRequest({ scene: "interlude", encounterAction: "kept" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].description).toBe(
      "Cena: Interlúdio iniciada — encontro mantido em 2º plano",
    );
  });

  it("ignora encounterAction inválido (grava null)", async () => {
    await PATCH(patchRequest({ scene: "combat", encounterAction: "nope" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].payload).toEqual({ scene: "combat", encounterAction: null });
  });

  it("retorna 200 mesmo se o insert do log falhar", async () => {
    mockInsert.mockImplementation(() => {
      throw new Error("banco de log indisponível");
    });
    const res = await PATCH(patchRequest({ scene: "stealth" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run "src/app/api/campaigns/[id]/scene/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/campaigns/[id]/scene/route.ts`:

```ts
// =============================================================================
// Libmork — API Route: Cena ativa da campanha (Issue #86, Fase 1)
// =============================================================================
// PATCH: Persiste a cena ativa do escudo do mestre e registra a transição no
// log da sessão (apenas o mestre dono). Body: { scene, encounterAction? }.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isSceneValue, SCENES, type ActiveScene, type SceneType } from "@/lib/scenes/sceneConfig";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/campaigns/:id/scene
 * Define a cena ativa (null = modo Livre) e registra a transição no log.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode gerenciar cenas na campanha" },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      scene?: unknown;
      encounterAction?: unknown;
    } | null;

    const rawScene = body?.scene;
    if (rawScene !== null && !isSceneValue(rawScene)) {
      return NextResponse.json({ success: false, error: "Cena inválida" }, { status: 400 });
    }
    const scene = (rawScene ?? null) as ActiveScene;

    const encounterAction: "ended" | "kept" | null =
      body?.encounterAction === "ended" || body?.encounterAction === "kept"
        ? body.encounterAction
        : null;

    await db
      .update(campaigns)
      .set({ activeScene: scene, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    let description = scene ? `Cena: ${SCENES[scene].label} iniciada` : "Cena desativada — modo Livre";
    if (encounterAction === "ended") description += " — encontro encerrado";
    else if (encounterAction === "kept") description += " — encontro mantido em 2º plano";

    try {
      await db.insert(campaignLogs).values({
        campaignId,
        actorType: "master",
        actorName: session.user.masterName || session.user.displayName || "Mestre",
        action: "scene_change",
        description,
        payload: { scene, encounterAction },
        createdById: session.user.id,
      });
    } catch (logErr) {
      logger.warn({ err: logErr }, "Falha ao registrar log de mudança de cena");
    }

    return NextResponse.json({ success: true, data: { campaignId, scene } });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar cena da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run "src/app/api/campaigns/[id]/scene/__tests__/route.test.ts"`
Expected: PASS (8 testes).

- [ ] **Step 5: Typecheck e commit**

```bash
npx tsc --noEmit
git add "src/app/api/campaigns/[id]/scene"
git commit -m "feat(scenes): rota PATCH de cena com log de transicao no servidor"
```

---

### Task 4: Relay `scene-changed` no `server.js`

**Files:**
- Modify: `server.js` (bloco de relays da sala `campaign:{id}`, logo após o handler `toggle-establishment` ~linha 241-244)

**Interfaces:**
- Consumes: convenção existente `socket.on(event, payload => io.to(\`campaign:${payload.campaignId}\`).emit(event, payload))`.
- Produces: evento `scene-changed` com payload `{ campaignId, scene, encounterAction }` entregue a todos os sockets na sala (inclui outras abas do mestre e o pop-out).

- [ ] **Step 1: Adicionar o handler**

Em `server.js`, inserir imediatamente após o handler `socket.on("toggle-establishment", ...)` (termina em ~linha 244, antes de `socket.on("create-campaign-log", ...)`):

```js
        // Mudança de cena do escudo do mestre (Issue #86 — Fase 1)
        socket.on("scene-changed", (payload) => {
          if (!payload || !payload.campaignId) return;
          io.to(`campaign:${payload.campaignId}`).emit("scene-changed", payload);
        });
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check server.js`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(scenes): relay do evento scene-changed na sala da campanha"
```

---

### Task 5: Hook `useCampaignScene`

**Files:**
- Create: `src/hooks/useCampaignScene.ts`
- Test: `src/hooks/__tests__/useCampaignScene.test.ts`

**Interfaces:**
- Consumes: `ActiveScene`, `sanitizeActiveScene` (Task 2); rota `PATCH /api/campaigns/:id/scene` (Task 3); evento `scene-changed` (Task 4, via socket do cliente).
- Produces: `useCampaignScene({ campaignId: string | null, initialScene?: unknown, socket }): { activeScene: ActiveScene; isSaving: boolean; error: string | null; setScene(next: ActiveScene, encounterAction?: "ended" | "kept"): Promise<void> }`.

- [ ] **Step 1: Escrever o teste falho**

Criar `src/hooks/__tests__/useCampaignScene.test.ts`:

```ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCampaignScene } from "../useCampaignScene";

function makeFakeSocket() {
  const handlers: Record<string, Array<(payload: unknown) => void>> = {};
  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      (handlers[event] ||= []).push(handler);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== handler);
    }),
    emit: vi.fn(),
    fire(event: string, payload: unknown) {
      (handlers[event] || []).forEach((h) => h(payload));
    },
    handlerCount(event: string) {
      return (handlers[event] || []).length;
    },
  };
}

describe("useCampaignScene (issue #86, Fase 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inicializa com a cena sanitizada de initialScene", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "combat", socket }),
    );
    expect(result.current.activeScene).toBe("combat");
  });

  it("valor desconhecido vira Livre (null)", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "xyz", socket }),
    );
    expect(result.current.activeScene).toBeNull();
  });

  it("setScene faz PATCH, emite scene-changed e aplica otimista", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const socket = makeFakeSocket();

    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );

    await act(async () => {
      await result.current.setScene("interlude");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campaigns/c1/scene",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ scene: "interlude", encounterAction: undefined });
    expect(socket.emit).toHaveBeenCalledWith("scene-changed", {
      campaignId: "c1",
      scene: "interlude",
      encounterAction: undefined,
    });
    expect(result.current.activeScene).toBe("interlude");
    expect(result.current.isSaving).toBe(false);
    vi.unstubAllGlobals();
  });

  it("falha no PATCH faz rollback da otimista e seta error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "combat", socket }),
    );

    await act(async () => {
      await result.current.setScene("escape");
    });

    expect(result.current.activeScene).toBe("combat");
    expect(result.current.error).toBe("Não foi possível salvar a cena");
    expect(socket.emit).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("aplica scene-changed da própria campanha e ignora outras", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );

    act(() => {
      socket.fire("scene-changed", { campaignId: "c2", scene: "combat" });
    });
    expect(result.current.activeScene).toBeNull();

    act(() => {
      socket.fire("scene-changed", { campaignId: "c1", scene: "stealth" });
    });
    expect(result.current.activeScene).toBe("stealth");
  });

  it("não assina sem campaignId e remove listener no unmount", () => {
    const socket = makeFakeSocket();
    const { result, unmount } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );
    expect(socket.handlerCount("scene-changed")).toBe(1);
    unmount();
    expect(socket.handlerCount("scene-changed")).toBe(0);
    expect(result.current.activeScene).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/hooks/__tests__/useCampaignScene.test.ts`
Expected: FAIL — `Cannot find module '../useCampaignScene'`.

- [ ] **Step 3: Implementar o hook**

Criar `src/hooks/useCampaignScene.ts`:

```ts
"use client";

// =============================================================================
// Libmork — Hook: Cena ativa do escudo do mestre (Issue #86, Fase 1)
// =============================================================================
// Estado central da cena: restaura do banco (initialScene vindo do GET da
// campanha), persiste via PATCH e sincroniza em tempo real pelo evento
// socket "scene-changed" (aba principal, pop-out da Mesa e outras abas).
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { sanitizeActiveScene, type ActiveScene } from "@/lib/scenes/sceneConfig";

type MinimalSocket = Pick<Socket, "on" | "off" | "emit">;

type SceneChangedPayload = { campaignId?: string; scene?: unknown };

export type UseCampaignSceneOptions = {
  campaignId: string | null;
  initialScene?: unknown;
  socket: MinimalSocket | null;
};

export type UseCampaignSceneResult = {
  activeScene: ActiveScene;
  isSaving: boolean;
  error: string | null;
  setScene: (next: ActiveScene, encounterAction?: "ended" | "kept") => Promise<void>;
};

export function useCampaignScene({
  campaignId,
  initialScene,
  socket,
}: UseCampaignSceneOptions): UseCampaignSceneResult {
  const [activeScene, setActiveScene] = useState<ActiveScene>(() => sanitizeActiveScene(initialScene));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A campanha carrega depois do mount: restaura a cena persistida.
  useEffect(() => {
    setActiveScene(sanitizeActiveScene(initialScene));
  }, [campaignId, initialScene]);

  // Sync em tempo real — ignora eventos de outras campanhas.
  useEffect(() => {
    if (!socket || !campaignId) return;
    const handler = (payload: SceneChangedPayload) => {
      if (payload?.campaignId !== campaignId) return;
      setActiveScene(sanitizeActiveScene(payload.scene ?? null));
    };
    socket.on("scene-changed", handler);
    return () => {
      socket.off("scene-changed", handler);
    };
  }, [socket, campaignId]);

  const setScene = useCallback(
    async (next: ActiveScene, encounterAction?: "ended" | "kept") => {
      if (!campaignId) return;
      const previous = activeScene;
      setActiveScene(next); // otimista; rollback em falha
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/scene`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scene: next, encounterAction }),
        });
        if (!res.ok) throw new Error(`PATCH scene HTTP ${res.status}`);
        socket?.emit("scene-changed", { campaignId, scene: next, encounterAction });
      } catch {
        setActiveScene(previous);
        setError("Não foi possível salvar a cena");
      } finally {
        setIsSaving(false);
      }
    },
    [activeScene, campaignId, socket],
  );

  return { activeScene, isSaving, error, setScene };
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/hooks/__tests__/useCampaignScene.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCampaignScene.ts src/hooks/__tests__/useCampaignScene.test.ts
git commit -m "feat(scenes): hook useCampaignScene com otimista, rollback e sync por socket"
```

---

### Task 6: Componente `SceneBar`

**Files:**
- Create: `src/components/campaigns/SceneBar.tsx`
- Test: `src/components/campaigns/__tests__/SceneBar.test.tsx`

**Interfaces:**
- Consumes: `SCENES`, `SCENE_ORDER`, `ActiveScene` (Task 2).
- Produces: `<SceneBar activeScene onSceneChange disabled? className? />` — `onSceneChange(next: ActiveScene)`; emite `null` ao clicar a cena ativa; testids `scene-bar`, `scene-btn-<value>`, `scene-mode-label`.

- [ ] **Step 1: Escrever o teste falho**

Criar `src/components/campaigns/__tests__/SceneBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SceneBar } from "../SceneBar";

describe("SceneBar (issue #86, Fase 1)", () => {
  it("renderiza os 5 botões na ordem da spec", () => {
    render(<SceneBar activeScene={null} onSceneChange={vi.fn()} />);
    const order = ["combat", "interlude", "stealth", "investigation", "escape"];
    for (const value of order) {
      expect(screen.getByTestId(`scene-btn-${value}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Livre");
  });

  it("marca a cena ativa com aria-pressed e label correto", () => {
    render(<SceneBar activeScene="combat" onSceneChange={vi.fn()} />);
    expect(screen.getByTestId("scene-btn-combat")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("scene-btn-stealth")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Combate");
  });

  it("clicar cena inativa seleciona a cena", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene={null} onSceneChange={onSceneChange} />);
    fireEvent.click(screen.getByTestId("scene-btn-escape"));
    expect(onSceneChange).toHaveBeenCalledWith("escape");
  });

  it("clicar a cena ativa volta ao Livre", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene="investigation" onSceneChange={onSceneChange} />);
    fireEvent.click(screen.getByTestId("scene-btn-investigation"));
    expect(onSceneChange).toHaveBeenCalledWith(null);
  });

  it("disabled bloqueia cliques", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene={null} onSceneChange={onSceneChange} disabled />);
    fireEvent.click(screen.getByTestId("scene-btn-combat"));
    expect(onSceneChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/components/campaigns/__tests__/SceneBar.test.tsx`
Expected: FAIL — `Cannot find module '../SceneBar'`.

- [ ] **Step 3: Implementar o componente**

Criar `src/components/campaigns/SceneBar.tsx`:

```tsx
"use client";

// =============================================================================
// Libmork — Barra de Cenas do escudo do mestre (Issue #86, Fase 1)
// =============================================================================
// 5 botões de cena no header; clicar a cena ativa a desativa (modo Livre).
// Nesta fase só persiste/sincroniza a cena; efeitos vêm na Fase 2.
// =============================================================================

import { SCENE_ORDER, SCENES, type ActiveScene } from "@/lib/scenes/sceneConfig";

type SceneBarProps = {
  activeScene: ActiveScene;
  onSceneChange: (next: ActiveScene) => void;
  disabled?: boolean;
  className?: string;
};

export function SceneBar({ activeScene, onSceneChange, disabled = false, className = "" }: SceneBarProps) {
  return (
    <div
      data-testid="scene-bar"
      className={`flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-950/70 px-2 py-1 ${className}`}
    >
      {SCENE_ORDER.map((value) => {
        const scene = SCENES[value];
        const Icon = scene.icon;
        const isActive = activeScene === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`scene-btn-${value}`}
            aria-pressed={isActive}
            disabled={disabled}
            title={isActive ? `${scene.label} — clique para voltar ao modo Livre` : `Ativar cena: ${scene.label}`}
            onClick={() => onSceneChange(isActive ? null : value)}
            className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? scene.activeClasses
                : "border-gray-700 bg-gray-800/70 text-gray-300 hover:bg-gray-700"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <Icon size={14} />
            <span className="hidden xl:inline">{scene.label}</span>
          </button>
        );
      })}
      <span
        data-testid="scene-mode-label"
        className="ml-1 whitespace-nowrap text-[10px] uppercase tracking-wider text-gray-400"
      >
        {activeScene ? `Cena: ${SCENES[activeScene].label}` : "Cena: Livre"}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/components/campaigns/__tests__/SceneBar.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/SceneBar.tsx src/components/campaigns/__tests__/SceneBar.test.tsx
git commit -m "feat(scenes): SceneBar com identidade visual por cena e toggle para Livre"
```

---

### Task 7: Integração no `CampaignDetail` (header + accent + gate Missing)

**Files:**
- Modify: `src/components/campaigns/CampaignDetail.tsx` (imports ~linhas 1-31; hooks ~linha 84; header ~linhas 296-300 e 349-360)
- Test: `src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx`

**Interfaces:**
- Consumes: `useCampaignScene` (Task 5), `SceneBar` (Task 6), `SCENES` (Task 2), `Campaign.activeScene` (Task 1), `socket` de `useSocket()` (existente).
- Produces: cena ativa no header do escudo para campanhas d20; `data-testid="shield-header"`; nenhum consumo por MasterRoster/jukebox nesta fase.

- [ ] **Step 1: Escrever o teste falho**

Criar `src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx` (mocks espelham `CampaignDetail.shieldGrid.test.tsx`):

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: () => <div data-testid="master-roster-mock" />,
}));
vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="campaign-invites" />,
}));
vi.mock("@/components/campaigns/ContentOverlay", () => ({ ContentOverlay: () => null }));
vi.mock("@/components/campaigns/WorldOverlay", () => ({ WorldOverlay: () => null }));
vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="mock-master-jukebox" />,
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log-mock" />,
}));
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({ socket: null, isConnected: true }),
}));

let campaignPayload: Record<string, unknown> = {};

describe("CampaignDetail — barra de cenas (issue #86, Fase 1)", () => {
  beforeEach(() => {
    localStorage.clear();
    campaignPayload = {
      id: "camp-1",
      name: "Campanha Teste",
      rulesEngine: "d20_mod",
      masterId: "m1",
      activeScene: "combat",
    };
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (url.endsWith("/scene")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: campaignPayload }) });
    }) as unknown as typeof fetch;
  });

  it("renderiza a SceneBar pré-selecionada com a cena do banco", async () => {
    render(<CampaignDetail />);
    await waitFor(() => screen.getByTestId("scene-bar"));
    expect(screen.getByTestId("scene-btn-combat")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Combate");
  });

  it("clique em outra cena dispara PATCH /scene", async () => {
    render(<CampaignDetail />);
    await waitFor(() => screen.getByTestId("scene-bar"));
    fireEvent.click(screen.getByTestId("scene-btn-stealth"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("header recebe accent ring quando há cena ativa", async () => {
    render(<CampaignDetail />);
    const header = await waitFor(() => screen.getByTestId("shield-header"));
    expect(header.className).toContain("ring-1");
    expect(header.className).toContain("border-red-500/70");
  });

  it("campanha missing_zero não renderiza a SceneBar", async () => {
    campaignPayload = { ...campaignPayload, rulesEngine: "missing_zero" };
    const { container } = render(<CampaignDetail />);
    await waitFor(() => expect(container).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("scene-bar")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx`
Expected: FAIL — `scene-bar` não existe no `CampaignDetail` atual.

- [ ] **Step 3: Integrar no componente**

Em `src/components/campaigns/CampaignDetail.tsx`:

a) Imports — adicionar ao bloco de imports (após a linha 21, junto aos hooks/componentes):

```ts
import { SceneBar } from "./SceneBar";
import { useCampaignScene } from "@/hooks/useCampaignScene";
import { SCENES } from "@/lib/scenes/sceneConfig";
```

b) Hooks — logo após `const { config: screenConfig, updateConfig, resetConfig } = useMasterScreenConfig();` (~linha 84):

```ts
  const { activeScene, isSaving, setScene } = useCampaignScene({
    campaignId: campaign?.id ?? null,
    initialScene: campaign?.activeScene,
    socket,
  });
```

c) Header — no container do "Header Hero" (~linha 296), adicionar o testid e o accent da cena. Substituir o `className` do primeiro `<div>` do `return` de:

```tsx
        className={`relative overflow-hidden mb-2 rounded-xl border px-4 py-2.5 shrink-0 shadow-lg ${
          isMissing
            ? "border-zinc-800 bg-[#0d0e12] font-mono shadow-rose-950/20"
            : "border-gray-800/80 bg-gray-900"
        }`}
```

por:

```tsx
        data-testid="shield-header"
        className={`relative overflow-hidden mb-2 rounded-xl border px-4 py-2.5 shrink-0 shadow-lg ${
          isMissing
            ? "border-zinc-800 bg-[#0d0e12] font-mono shadow-rose-950/20"
            : "border-gray-800/80 bg-gray-900"
        } ${activeScene && !isMissing ? `ring-1 ${SCENES[activeScene].accentClasses}` : ""}`}
```

d) Barra de cenas — no grupo direito do header (`<div className="flex items-center gap-2">` ~linha 349), inserir ANTES do botão "Gerenciar Conteúdo" (`{!isMissing && (<button ... Boxes ... </button>)}`):

```tsx
            {!isMissing && (
              <SceneBar
                activeScene={activeScene}
                onSceneChange={(next) => void setScene(next)}
                disabled={isSaving}
              />
            )}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Rodar a bateria dos componentes do escudo para checar regressão**

Run: `npx vitest run src/components/campaigns`
Expected: PASS (inclusive `CampaignDetail.shieldGrid` e `CampaignDetail.masterConfig`, que não conhecem a SceneBar — os mocks de fetch já cobrem `/scene`).

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
git add src/components/campaigns/CampaignDetail.tsx src/components/campaigns/__tests__/CampaignDetail.scenes.test.tsx
git commit -m "feat(shield): SceneBar integrada ao header do escudo com accent por cena"
```

---

### Task 8: Verificação completa + smoke manual

**Files:**
- Sem alterações novas (a menos que o smoke encontre bug — corrigir na mesma tarefa).

**Interfaces:**
- Consumes: tudo das tarefas 1-7.
- Produces: Fase 1 verificada; branch pronta para PR.

- [ ] **Step 1: Aplicar as colunas no banco local**

Run: `npm run db:push`
Expected: sucesso (o drizzle-kit push cria `active_scene` e `scene` a partir do `schema.ts`). Requer `.env.local` com `DATABASE_URL`. Se não houver banco local disponível, registrar no relatório final — o arquivo `drizzle/0023_add_scene_columns.sql` é o artefato de deploy.

- [ ] **Step 2: Lint + typecheck + testes completos**

```bash
npm run lint
npx tsc --noEmit
npm run test
```

Expected: lint e tsc sem erros; suíte verde (os testes novos: `schema.sceneColumns`, `sceneConfig`, rota `scene`, `useCampaignScene`, `SceneBar`, `CampaignDetail.scenes`).

- [ ] **Step 3: Smoke manual com dev server**

Run: `npm run dev` e abrir uma campanha d20 como mestre.

Checklist (verificar um a um):
1. Barra de cenas aparece no header, à esquerda de "Gerenciar Conteúdo", com os 5 ícones; rótulo "Cena: Livre".
2. Clicar "Combate" → botão destacado em vermelho, header ganha ring vermelho, rótulo "Cena: Combate".
3. Recarregar a página → cena continua em Combate (persistiu via `PATCH`).
4. Abrir a aba do Log da sessão → entrada "Cena: Combate iniciada" presente.
5. Segunda aba do navegador na mesma campanha → ao clicar cena numa aba, a outra sincroniza em segundos (relay `scene-changed`).
6. Clicar a cena ativa → volta a "Cena: Livre"; log registra "Cena desativada — modo Livre".
7. Campanha `missing_zero` → barra ausente, escudo inalterado.

- [ ] **Step 4: Commit final (se algo foi corrigido no smoke) e relatório**

```bash
git status --short
```

Se limpo: nada a commitar. Reportar resultado do checklist; PR/push apenas se o usuário pedir.

---

## Self-Review (executado pelo autor do plano)

1. **Spec coverage (Fase 1 da issue):** migração das 2 colunas ✓ (Task 1); rota `PATCH /scene` com log ✓ (Task 3); relay socket ✓ (Task 4); `sceneConfig` ✓ (Task 2); `useCampaignScene` ✓ (Task 5); `SceneBar` com identidade visual ✓ (Task 6); integração + accent no header + gate Missing ✓ (Task 7); verificação ✓ (Task 8). Comportamentos da matriz, confirmação de encontro, jukebox e log de UI render são explicitamente Fase 2/3/4 — fora deste plano.
2. **Placeholders:** nenhum "TBD"/"similar ao Task N"; todos os passos têm código ou comando exato.
3. **Consistência de tipos:** `ActiveScene`/`sanitizeActiveScene`/`isSceneValue`/`SCENES`/`SCENE_ORDER`/`SCENE_MATRIX`/`modulesForScene` definidos na Task 2 e usados com os mesmos nomes nas Tasks 3, 5, 6, 7; payload do emit/relay `{ campaignId, scene, encounterAction }` idêntico nas Tasks 4 e 5; body da rota (Task 3) bate com o fetch do hook (Task 5) e com o teste de integração (Task 7).
