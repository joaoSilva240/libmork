# Issue #63 — Calendário de Sessões + Hub Comunitário: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de agendamento/matchmaking de sessões de RPG: calendário custom do mestre com "Lançar Sessão", hub do jogador (Grupos/Calendário Pessoal/Convites) e fluxo de candidatura com disponibilidade e confirmação.

**Architecture:** Backend novo (`session-service.ts` + 9 rotas REST + eventos socket `session:*`) sobre tabelas aditivas `campaign_sessions`/`session_candidates` e colunas `oneShot`/`maxPlayers` em `campaigns`. Frontend 100% custom sem deps novas: `CalendarGrid` (mês/semana/dia), modais de lançamento/candidatura, feed estilo X, integração nas abas existentes do mestre e jogador.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (PostgreSQL, `withTimezone: true`), Socket.IO (`server.js` + `SocketContext`), Zod, Vitest + @testing-library/react, lucide-react, `Intl`/`Date` nativos.

**Spec:** `docs/superpowers/specs/2026-11-08-session-calendar-community-hub-design.md`

## Global Constraints

- Branch: `feature/issue-63-session-calendar-community-hub` (já criada; NUNCA worktrees paralelos).
- **Commits só com autorização do usuário; push idem** (husky pre-push exige docker ausente; `HUSKY=0`/`--no-verify` só com autorização expressa — precedente autorizado nesta sessão).
- **Zero dependências novas** (sem libs de calendário/datas).
- UI com **tokens de tema** (`bg-secondary-card`, `border-secondary-border`, `text-secondary-pure`, `text-secondary-muted`, `bg-accent`, `bg-dominant-deep` etc.); cores semânticas de status podem usar as classes já presentes no repo (`text-green-*`/`text-red-*`/`text-amber-*` como em `ui/Toast.tsx`).
- PT-BR em todas as strings; erros de serviço com as mensagens EXATAS deste plano (as rotas mapeiam por texto).
- Migração via **script SQL aditivo idempotente temporário** (criar → rodar → verificar → deletar), nunca `db:push`/`db:generate`.
- `.env` tem credenciais reais — nunca ecoar/commitar.
- Sem `any`: `Record<string, unknown>` + casts `as unknown as T`; em testes `as never` (padrão do repo).
- `eslint-disable-next-line react-hooks/set-state-in-effect` só onde o padrão já é usado; JSDOM sem `scrollIntoView`/`matchMedia` (guards `typeof`).
- Rotas: `requireAuth()` de `@/lib/auth/session`, `{ success, data }` / `{ success: false, error }`, `logger.error({ err }, "...")`.
- Testes de rota mockeiam `@/lib/server/session-service` + `@/lib/auth/session` + `@/lib/logger` (padrão de `src/app/api/chat/__tests__/chat-routes.test.ts`).
- Comandos sempre na raiz: `npx vitest run <arquivo>`, `npx tsc --noEmit`.
- Timestamps: colunas novas `withTimezone: true`; `proposedStart` = 00:00 local do dia inicial, `proposedEnd` = 23:59:59 local do dia final (inclusivo); cliente envia `.toISOString()`.

## Estrutura de arquivos

**Criar:** `src/lib/validators/sessions.ts` (+teste), `src/lib/utils/session-dates.ts` (+teste), `src/lib/server/session-service.ts`, rotas `src/app/api/sessions/**`, `src/app/api/player/calendar/route.ts`, `src/app/api/campaigns/[id]/session-context/route.ts`, `src/app/api/campaigns/[id]/enrolled-players/route.ts`, `src/components/calendar/CalendarGrid.tsx` (+teste), `src/components/sessions/SessionLaunchModal.tsx`, `SessionDetailDrawer.tsx`, `ConfirmSessionModal.tsx`, `SessionInviteFeed.tsx`, `SessionInviteCard.tsx`, `SessionInviteDetail.tsx`, `ApplySessionModal.tsx`, `MasterSessionCalendar.tsx`, `PlayerSessionCalendar.tsx`, `PlayerCommunityHub.tsx` (+testes).

**Modificar:** `src/lib/db/schema.ts`, `server.js`, `src/context/SocketContext.tsx`, `src/components/community/MasterCommunityView.tsx`, `src/components/player/PlayerDashboard.tsx`, `src/app/player/page.tsx` (Suspense).

---

### Task 1: Schema + migração aditiva

**Files:**

- Modify: `src/lib/db/schema.ts` (campaigns ~linha 157; adicionar tabelas após o bloco de chat ~linha 1530)
- Create/Delete: `scripts/tmp-apply-session-calendar.js`

**Interfaces:**

- Produz: `campaigns.oneShot/maxPlayers`; tabelas `campaignSessions`, `sessionCandidates` + relations. Todas as tasks seguintes dependem disto.

- [ ] **Step 1: Colunas em `campaigns`**

Após `activeAssetId` (antes de `createdAt`):

```ts
  oneShot: boolean("one_shot"),
  maxPlayers: integer("max_players"),
```

- [ ] **Step 2: Tabelas novas + relations**

Adicionar ao final do arquivo (seguir o estilo do bloco de chat):

```ts
// =============================================================================
// SESSÕES AGENDADAS E CANDIDATURAS (Issue #63)
// =============================================================================

export const campaignSessions = pgTable(
  "campaign_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    masterId: uuid("master_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    proposedStart: timestamp("proposed_start", { withTimezone: true }).notNull(),
    proposedEnd: timestamp("proposed_end", { withTimezone: true }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull().default(240),
    xpReward: integer("xp_reward"),
    sessionType: varchar("session_type", { length: 20 }).notNull(), // "one_shot" | "continuing"
    maxSlots: integer("max_slots").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("proposed"), // proposed | confirmed | cancelled
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_campaign_status").on(table.campaignId, table.status),
    index("idx_sessions_feed").on(table.status, table.proposedStart),
    index("idx_sessions_master").on(table.masterId),
  ],
);

export const sessionCandidates = pgTable(
  "session_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => campaignSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
    availableDays: jsonb("available_days").notNull().default([]), // string[] 'yyyy-MM-dd'
    preferredStart: varchar("preferred_start", { length: 5 }), // 'HH:mm'
    preferredEnd: varchar("preferred_end", { length: 5 }),
    allDay: boolean("all_day").notNull().default(true),
    status: varchar("status", { length: 20 }).notNull().default("interested"), // interested | accepted | rejected
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_candidates_session_user").on(table.sessionId, table.userId),
    index("idx_candidates_user_status").on(table.userId, table.status),
  ],
);

export const campaignSessionsRelations = relations(campaignSessions, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [campaignSessions.campaignId], references: [campaigns.id] }),
  master: one(users, { fields: [campaignSessions.masterId], references: [users.id] }),
  candidates: many(sessionCandidates),
}));

export const sessionCandidatesRelations = relations(sessionCandidates, ({ one }) => ({
  session: one(campaignSessions, {
    fields: [sessionCandidates.sessionId],
    references: [campaignSessions.id],
  }),
  user: one(users, { fields: [sessionCandidates.userId], references: [users.id] }),
  character: one(characters, {
    fields: [sessionCandidates.characterId],
    references: [characters.id],
  }),
}));
```

(`relations`, `index`, `uniqueIndex`, `jsonb`, `boolean`, `integer`, `timestamp`, `varchar`, `text`, `uuid` já importados.)

- [ ] **Step 3: Script de migração**

Criar `scripts/tmp-apply-session-calendar.js`:

```js
require("dotenv").config();
const { Client } = require("pg");

const SQL = `
BEGIN;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS one_shot boolean;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS max_players integer;
CREATE TABLE IF NOT EXISTS campaign_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  master_id uuid NOT NULL,
  description text NOT NULL,
  proposed_start timestamptz NOT NULL,
  proposed_end timestamptz NOT NULL,
  scheduled_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 240,
  xp_reward integer,
  session_type varchar(20) NOT NULL,
  max_slots integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  character_id uuid,
  available_days jsonb NOT NULL DEFAULT '[]',
  preferred_start varchar(5),
  preferred_end varchar(5),
  all_day boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'interested',
  applied_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE campaign_sessions ADD CONSTRAINT campaign_sessions_campaign_id_fk
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE campaign_sessions ADD CONSTRAINT campaign_sessions_master_id_fk
    FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE session_candidates ADD CONSTRAINT session_candidates_session_id_fk
    FOREIGN KEY (session_id) REFERENCES campaign_sessions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE session_candidates ADD CONSTRAINT session_candidates_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE session_candidates ADD CONSTRAINT session_candidates_character_id_fk
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_sessions_campaign_status ON campaign_sessions (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_feed ON campaign_sessions (status, proposed_start);
CREATE INDEX IF NOT EXISTS idx_sessions_master ON campaign_sessions (master_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_session_user ON session_candidates (session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_status ON session_candidates (user_id, status);
COMMIT;
`;

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(SQL);
  console.log("OK: tabelas de sessões aplicadas.");
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

Rodar: `NODE_PATH="C:/Users/kyone/Documents/Dev/libmork/node_modules" node scripts/tmp-apply-session-calendar.js` → esperado `OK: tabelas de sessões aplicadas.`

- [ ] **Step 4: Verificar (read-only) e limpar**

```bash
NODE_PATH="C:/Users/kyone/Documents/Dev/libmork/node_modules" node -e "require('dotenv').config();const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(\"SELECT table_name FROM information_schema.tables WHERE table_name IN ('campaign_sessions','session_candidates')\");console.log(r.rows);const f=await c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='campaigns' AND column_name IN ('one_shot','max_players')\");console.log(f.rows);await c.end();})()"
rm scripts/tmp-apply-session-calendar.js
npx tsc --noEmit
```

Esperado: 2 tabelas + 2 colunas; tsc limpo.

---

### Task 2: Validadores Zod

**Files:**

- Create: `src/lib/validators/sessions.ts`
- Test: `src/lib/validators/__tests__/sessions.test.ts`

**Interfaces:**

- Produz: `launchSessionSchema`/`LaunchSessionInput`, `applySessionSchema`/`ApplySessionInput`, `updateSessionSchema`/`UpdateSessionInput`, `decideCandidateSchema`/`DecideCandidateInput`.

- [ ] **Step 1: Testes (falham primeiro)**

```ts
import { describe, it, expect } from "vitest";
import {
  launchSessionSchema,
  applySessionSchema,
  updateSessionSchema,
  decideCandidateSchema,
} from "../sessions";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("launchSessionSchema", () => {
  const base = {
    campaignId: UUID,
    description: "Sessão de abertura em Barovia",
    proposedStart: "2026-12-01T00:00:00.000Z",
    proposedEnd: "2026-12-03T23:59:59.000Z",
  };
  it("aceita lançamento válido", () => {
    expect(launchSessionSchema.safeParse(base).success).toBe(true);
  });
  it("rejeita período invertido", () => {
    expect(
      launchSessionSchema.safeParse({ ...base, proposedEnd: "2026-11-01T00:00:00.000Z" }).success,
    ).toBe(false);
  });
  it("rejeita descrição curta e xp negativo", () => {
    expect(launchSessionSchema.safeParse({ ...base, description: "curta" }).success).toBe(false);
    expect(launchSessionSchema.safeParse({ ...base, xpReward: -1 }).success).toBe(false);
  });
  it("aceita sessionType/maxSlots opcionais", () => {
    expect(
      launchSessionSchema.safeParse({ ...base, sessionType: "one_shot", maxSlots: 5 }).success,
    ).toBe(true);
    expect(launchSessionSchema.safeParse({ ...base, maxSlots: 0 }).success).toBe(false);
    expect(launchSessionSchema.safeParse({ ...base, maxSlots: 21 }).success).toBe(false);
  });
});

describe("applySessionSchema", () => {
  it("aceita candidatura mínima (sem personagem, sem horário)", () => {
    expect(applySessionSchema.safeParse({ availableDays: ["2026-12-01"] }).success).toBe(true);
  });
  it("exige ao menos 1 dia e formato ISO", () => {
    expect(applySessionSchema.safeParse({ availableDays: [] }).success).toBe(false);
    expect(applySessionSchema.safeParse({ availableDays: ["01/12/2026"] }).success).toBe(false);
  });
  it("exige horários aos pares e fim > início", () => {
    expect(
      applySessionSchema.safeParse({ availableDays: ["2026-12-01"], preferredStart: "19:00" })
        .success,
    ).toBe(false);
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "23:00",
        preferredEnd: "19:00",
      }).success,
    ).toBe(false);
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "19:00",
        preferredEnd: "23:00",
      }).success,
    ).toBe(true);
  });
  it("rejeita hora inválida", () => {
    expect(
      applySessionSchema.safeParse({
        availableDays: ["2026-12-01"],
        preferredStart: "25:00",
        preferredEnd: "26:00",
      }).success,
    ).toBe(false);
  });
});

describe("updateSessionSchema", () => {
  it("aceita confirm com scheduledAt e default de duração", () => {
    const r = updateSessionSchema.safeParse({
      action: "confirm",
      scheduledAt: "2026-12-02T19:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.action === "confirm") expect(r.data.durationMinutes).toBe(240);
  });
  it("aceita cancel sem campos extras", () => {
    expect(updateSessionSchema.safeParse({ action: "cancel" }).success).toBe(true);
  });
  it("rejeita action desconhecida e duração fora dos limites", () => {
    expect(updateSessionSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(
      updateSessionSchema.safeParse({
        action: "confirm",
        scheduledAt: "2026-12-02T19:00:00.000Z",
        durationMinutes: 10,
      }).success,
    ).toBe(false);
  });
});

describe("decideCandidateSchema", () => {
  it("aceita accepted/rejected e rejeita outro valor", () => {
    expect(decideCandidateSchema.safeParse({ decision: "accepted" }).success).toBe(true);
    expect(decideCandidateSchema.safeParse({ decision: "rejected" }).success).toBe(true);
    expect(decideCandidateSchema.safeParse({ decision: "maybe" }).success).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/validators/__tests__/sessions.test.ts` → FAIL.

- [ ] **Step 2: Implementar `src/lib/validators/sessions.ts`**

```ts
import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const launchSessionSchema = z
  .object({
    campaignId: z.string().uuid("Campanha inválida"),
    description: z
      .string()
      .trim()
      .min(10, "A descrição deve ter no mínimo 10 caracteres")
      .max(2000, "A descrição pode ter no máximo 2000 caracteres"),
    proposedStart: z.string().datetime({ offset: true, message: "Data inicial inválida" }),
    proposedEnd: z.string().datetime({ offset: true, message: "Data final inválida" }),
    xpReward: z.number().int().min(0).max(100000).optional(),
    sessionType: z.enum(["one_shot", "continuing"]).optional(),
    maxSlots: z.number().int().min(1, "Mínimo de 1 vaga").max(20, "Máximo de 20 vagas").optional(),
  })
  .refine((v) => new Date(v.proposedEnd) > new Date(v.proposedStart), {
    message: "O fim do período deve ser depois do início",
    path: ["proposedEnd"],
  });

export const applySessionSchema = z
  .object({
    characterId: z.string().uuid().optional().nullable(),
    availableDays: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dia inválido (use yyyy-MM-dd)"))
      .min(1, "Selecione ao menos um dia disponível")
      .max(62),
    preferredStart: z.string().regex(HHMM, "Horário inválido").optional(),
    preferredEnd: z.string().regex(HHMM, "Horário inválido").optional(),
  })
  .refine((v) => Boolean(v.preferredStart) === Boolean(v.preferredEnd), {
    message: "Informe início e fim do horário preferido",
    path: ["preferredEnd"],
  })
  .refine((v) => !v.preferredStart || !v.preferredEnd || v.preferredEnd > v.preferredStart, {
    message: "O fim do horário deve ser depois do início",
    path: ["preferredEnd"],
  });

export const updateSessionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    scheduledAt: z.string().datetime({ offset: true, message: "Data final inválida" }),
    durationMinutes: z.number().int().min(30).max(1440).default(240),
  }),
  z.object({ action: z.literal("cancel") }),
]);

export const decideCandidateSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
});

export type LaunchSessionInput = z.infer<typeof launchSessionSchema>;
export type ApplySessionInput = z.infer<typeof applySessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type DecideCandidateInput = z.infer<typeof decideCandidateSchema>;
```

- [ ] **Step 3: Rodar → PASS**

Run: `npx vitest run src/lib/validators/__tests__/sessions.test.ts`

---

### Task 3: Utilitários de data

**Files:**

- Create: `src/lib/utils/session-dates.ts`
- Test: `src/lib/utils/__tests__/session-dates.test.ts`

**Interfaces:**

- Produz (usado pelas Tasks 7-12): `toLocalDateISO(date: Date): string`, `getMonthGrid(year: number, monthIndex: number): Date[]` (42 células, semana começa segunda), `getWeekDays(date: Date): Date[]` (7, segunda-first), `eachDayISO(start: Date, end: Date): string[]`, `isSameDay(a: Date, b: Date): boolean`, `addDays/addWeeks/addMonths(date, n): Date`, `formatMonthYear(date): string` (Intl pt-BR, ex.: "novembro de 2026").

- [ ] **Step 1: Testes (falham primeiro)**

```ts
import { describe, it, expect } from "vitest";
import {
  toLocalDateISO,
  getMonthGrid,
  getWeekDays,
  eachDayISO,
  isSameDay,
  addDays,
  addWeeks,
  addMonths,
  formatMonthYear,
} from "../session-dates";

describe("session-dates", () => {
  it("toLocalDateISO formata yyyy-MM-dd local", () => {
    expect(toLocalDateISO(new Date(2026, 10, 8, 15, 30))).toBe("2026-11-08");
  });

  it("getMonthGrid retorna 42 células começando numa segunda", () => {
    const grid = getMonthGrid(2026, 10); // novembro/2026
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid.some((d) => d.getMonth() === 10 && d.getDate() === 1)).toBe(true);
  });

  it("getMonthGrid atravessa virada de ano", () => {
    const grid = getMonthGrid(2026, 11); // dezembro
    expect(grid).toHaveLength(42);
    expect(grid[41].getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("getWeekDays retorna 7 dias segunda-first contendo a data", () => {
    const week = getWeekDays(new Date(2026, 10, 11)); // quarta
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(1);
    expect(week.some((d) => isSameDay(d, new Date(2026, 10, 11)))).toBe(true);
  });

  it("eachDayISO inclui o primeiro e o último dia", () => {
    expect(eachDayISO(new Date(2026, 10, 1), new Date(2026, 10, 3, 23, 59, 59))).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("addDays/addWeeks/addMonths não mutam a data original", () => {
    const d = new Date(2026, 0, 31);
    expect(addMonths(d, 1).getMonth()).toBe(1);
    expect(addWeeks(d, 1).getDate()).toBe(7);
    expect(addDays(d, 1).getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });

  it("formatMonthYear em pt-BR", () => {
    expect(formatMonthYear(new Date(2026, 10, 8))).toBe("novembro de 2026");
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar**

```ts
export function toLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  return addDays(date, n * 7);
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function getMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7; // segunda = 0
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function getWeekDays(date: Date): Date[] {
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function eachDayISO(start: Date, end: Date): string[] {
  const days: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    days.push(toLocalDateISO(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}
```

- [ ] **Step 3: Rodar → PASS**

Run: `npx vitest run src/lib/utils/__tests__/session-dates.test.ts`

---

### Task 4: Serviço — lançamento, contexto e listagens do mestre

**Files:**

- Create: `src/lib/server/session-service.ts`
- Create: `src/app/api/sessions/route.ts` (POST; GET fica na Task 5)
- Create: `src/app/api/sessions/master/route.ts` (GET)
- Create: `src/app/api/campaigns/[id]/session-context/route.ts` (GET)
- Create: `src/app/api/campaigns/[id]/enrolled-players/route.ts` (GET)
- Test: `src/app/api/sessions/__tests__/sessions-launch.test.ts`

**Interfaces:**

- Consome: schema (Task 1), validadores (Task 2).
- Produz (usado por Tasks 5, 8-12):

```ts
export type SessionStatus = "proposed" | "confirmed" | "cancelled";
export type SessionType = "one_shot" | "continuing";

export type SessionSummary = {
  id: string;
  campaignId: string;
  campaignName: string;
  coverImageUrl: string | null;
  masterId: string;
  masterName: string;
  masterAvatar: string | null;
  description: string;
  proposedStart: string; // ISO
  proposedEnd: string;
  scheduledAt: string | null;
  durationMinutes: number;
  xpReward: number | null;
  sessionType: SessionType;
  maxSlots: number;
  acceptedCount: number;
  interestedCount: number;
  remainingSlots: number; // maxSlots - acceptedCount
  status: SessionStatus;
  userApplication: {
    status: "interested" | "accepted" | "rejected";
    availableDays: string[];
    allDay: boolean;
    preferredStart: string | null;
    preferredEnd: string | null;
    characterId: string | null;
  } | null;
  createdAt: string;
};

export type EnrolledPlayer = { userId: string; displayName: string; characterName: string };
export type SessionContext = {
  isFirstSession: boolean;
  oneShot: boolean | null;
  maxPlayers: number | null;
  enrolledPlayers: EnrolledPlayer[];
};

launchSession(masterId: string, input: LaunchSessionInput): Promise<SessionSummary>
listMasterSessions(masterId: string): Promise<SessionSummary[]>
getSessionContext(campaignId: string, masterId: string): Promise<SessionContext>
getEnrolledPlayers(campaignId: string): Promise<EnrolledPlayer[]>
```

Erros (strings EXATAS): `"Campanha não encontrada"`; `"Apenas o Mestre pode gerenciar sessões desta campanha"`; `"Tipo de sessão e vagas são obrigatórios na primeira sessão"`.

- [ ] **Step 1: Tipos + helpers internos + `getEnrolledPlayers`/`getSessionContext`**

Criar `session-service.ts` com imports (`db`, schema: `campaigns, campaignSessions, sessionCandidates, characters, characterCampaigns, users, campaignInvites` NÃO necessário; drizzle: `eq, and, ne, desc, sql, gte, lte, inArray`; validadores) e os tipos acima. Helpers:

```ts
async function requireCampaignMaster(campaignId: string, masterId: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.masterId !== masterId) {
    throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
  }
  return campaign;
}

async function buildSummary(
  row: typeof campaignSessions.$inferSelect,
  viewerId?: string,
): Promise<SessionSummary> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, row.campaignId))
    .limit(1);
  const [master] = await db
    .select({
      displayName: users.displayName,
      masterName: users.masterName,
      masterAvatar: users.masterAvatar,
    })
    .from(users)
    .where(eq(users.id, row.masterId))
    .limit(1);
  const candidates = await db
    .select()
    .from(sessionCandidates)
    .where(eq(sessionCandidates.sessionId, row.id));
  const acceptedCount = candidates.filter((c) => c.status === "accepted").length;
  const interestedCount = candidates.filter((c) => c.status === "interested").length;
  const mine = viewerId ? candidates.find((c) => c.userId === viewerId) : undefined;
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignName: campaign?.name ?? "Campanha",
    coverImageUrl: campaign?.coverImageUrl ?? null,
    masterId: row.masterId,
    masterName: master?.masterName || master?.displayName || "Mestre",
    masterAvatar: master?.masterAvatar ?? null,
    description: row.description,
    proposedStart: row.proposedStart.toISOString(),
    proposedEnd: row.proposedEnd.toISOString(),
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    durationMinutes: row.durationMinutes,
    xpReward: row.xpReward,
    sessionType: row.sessionType as SessionType,
    maxSlots: row.maxSlots,
    acceptedCount,
    interestedCount,
    remainingSlots: Math.max(0, row.maxSlots - acceptedCount),
    status: row.status as SessionStatus,
    userApplication: mine
      ? {
          status: mine.status as "interested" | "accepted" | "rejected",
          availableDays: (mine.availableDays ?? []) as string[],
          allDay: mine.allDay,
          preferredStart: mine.preferredStart,
          preferredEnd: mine.preferredEnd,
          characterId: mine.characterId,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getEnrolledPlayers(campaignId: string): Promise<EnrolledPlayer[]> {
  const rows = await db
    .select({
      userId: characters.ownerId,
      displayName: users.displayName,
      characterName: characters.name,
    })
    .from(characterCampaigns)
    .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
    .innerJoin(users, eq(characters.ownerId, users.id))
    .where(
      and(
        eq(characterCampaigns.campaignId, campaignId),
        eq(characterCampaigns.approvalStatus, "approved"),
      ),
    );
  const seen = new Set<string>();
  const result: EnrolledPlayer[] = [];
  for (const r of rows) {
    if (r.userId && !seen.has(r.userId)) {
      seen.add(r.userId);
      result.push({
        userId: r.userId,
        displayName: r.displayName || "Jogador",
        characterName: r.characterName,
      });
    }
  }
  return result;
}

export async function getSessionContext(
  campaignId: string,
  masterId: string,
): Promise<SessionContext> {
  const campaign = await requireCampaignMaster(campaignId, masterId);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignSessions)
    .where(
      and(eq(campaignSessions.campaignId, campaignId), ne(campaignSessions.status, "cancelled")),
    );
  return {
    isFirstSession: Number(countRow?.count ?? 0) === 0,
    oneShot: campaign.oneShot,
    maxPlayers: campaign.maxPlayers,
    enrolledPlayers: await getEnrolledPlayers(campaignId),
  };
}
```

NOTA: verificar no schema que `characters.ownerId` é notNull (é — usado assim no chat-service); se `characters.name` tiver outro nome, ajustar (confirmado: `name`).

- [ ] **Step 2: `launchSession` + `listMasterSessions`**

```ts
export async function launchSession(
  masterId: string,
  input: LaunchSessionInput,
): Promise<SessionSummary> {
  const campaign = await requireCampaignMaster(input.campaignId, masterId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignSessions)
    .where(
      and(eq(campaignSessions.campaignId, campaign.id), ne(campaignSessions.status, "cancelled")),
    );
  const isFirstSession = Number(countRow?.count ?? 0) === 0;
  const needsConfig = isFirstSession || campaign.oneShot === null || campaign.maxPlayers === null;

  if (needsConfig && (!input.sessionType || !input.maxSlots)) {
    throw new Error("Tipo de sessão e vagas são obrigatórios na primeira sessão");
  }

  const sessionType = needsConfig
    ? input.sessionType!
    : campaign.oneShot
      ? "one_shot"
      : "continuing";
  const maxSlots = needsConfig ? input.maxSlots! : campaign.maxPlayers!;

  const created = await db.transaction(async (tx) => {
    if (needsConfig) {
      await tx
        .update(campaigns)
        .set({ oneShot: sessionType === "one_shot", maxPlayers: maxSlots, updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));
    }
    const [row] = await tx
      .insert(campaignSessions)
      .values({
        campaignId: campaign.id,
        masterId,
        description: input.description,
        proposedStart: new Date(input.proposedStart),
        proposedEnd: new Date(input.proposedEnd),
        xpReward: input.xpReward ?? null,
        sessionType,
        maxSlots,
        status: "proposed",
      })
      .returning();

    if (sessionType === "continuing") {
      const enrolled = await getEnrolledPlayers(campaign.id);
      const toAccept = enrolled.filter((p) => p.userId !== masterId).slice(0, maxSlots);
      if (toAccept.length > 0) {
        await tx
          .insert(sessionCandidates)
          .values(
            toAccept.map((p) => ({
              sessionId: row.id,
              userId: p.userId,
              availableDays: [],
              allDay: true,
              status: "accepted",
            })),
          )
          .onConflictDoNothing();
      }
    }
    return row;
  });

  return buildSummary(created, masterId);
}

export async function listMasterSessions(masterId: string): Promise<SessionSummary[]> {
  const rows = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.masterId, masterId))
    .orderBy(desc(campaignSessions.proposedStart));
  const summaries: SessionSummary[] = [];
  for (const row of rows) summaries.push(await buildSummary(row, masterId));
  return summaries;
}
```

- [ ] **Step 3: Rotas**

`src/app/api/sessions/route.ts` (só POST por enquanto; GET do feed na Task 5):

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { launchSession } from "@/lib/server/session-service";
import { launchSessionSchema } from "@/lib/validators/sessions";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session)
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    const body = await request.json();
    const parsed = launchSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const created = await launchSession(session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Campanha não encontrada")
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    if (message.includes("Apenas o Mestre"))
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    if (message.includes("obrigatórios na primeira sessão"))
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    logger.error({ err: error }, "Erro ao lançar sessão");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
```

`src/app/api/sessions/master/route.ts` (GET → `listMasterSessions(session.user.id)`, 401/500 padrão).
`src/app/api/campaigns/[id]/session-context/route.ts` (GET, `RouteContext = { params: Promise<{ id: string }> }` → `getSessionContext(id, user.id)`; "Campanha não encontrada" 404; "Apenas o Mestre" 403).
`src/app/api/campaigns/[id]/enrolled-players/route.ts` (GET → valida mestre via `getSessionContext` e retorna `data: context.enrolledPlayers`; mesmos erros).

- [ ] **Step 4: Testes de rota `sessions-launch.test.ts`**

Padrão de mocks (requireAuth/session-service/logger). Casos:

- POST 401 sem sessão; 400 body inválido (descrição curta); 201 com `data.id`; 403 "Apenas o Mestre..."; 400 "Tipo de sessão e vagas são obrigatórios na primeira sessão"; 404 "Campanha não encontrada".
- GET master 200/401; GET session-context 200 com `isFirstSession`/401/403; GET enrolled-players 200.

Exemplo:

```ts
it("retorna 400 quando a primeira sessão não informa tipo/vagas", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
  vi.mocked(launchSession).mockRejectedValue(
    new Error("Tipo de sessão e vagas são obrigatórios na primeira sessão"),
  );
  const req = new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignId: "550e8400-e29b-41d4-a716-446655440000",
      description: "Sessão de abertura em Barovia",
      proposedStart: "2026-12-01T00:00:00.000Z",
      proposedEnd: "2026-12-03T23:59:59.000Z",
    }),
  });
  const res = await postSession(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 5: Rodar testes + tsc → PASS**

Run: `npx vitest run src/app/api/sessions/__tests__ src/lib/validators/__tests__/sessions.test.ts && npx tsc --noEmit`

---

### Task 5: Serviço — feed, candidaturas, decisão, confirmação e calendário do jogador

**Files:**

- Modify: `src/lib/server/session-service.ts`, `src/app/api/sessions/route.ts` (adicionar GET)
- Create: `src/app/api/sessions/[id]/route.ts` (GET, PATCH)
- Create: `src/app/api/sessions/[id]/candidates/route.ts` (GET, POST)
- Create: `src/app/api/sessions/[id]/candidates/[userId]/route.ts` (PATCH)
- Create: `src/app/api/player/calendar/route.ts` (GET)
- Test: `src/app/api/sessions/__tests__/sessions-flow.test.ts`

**Interfaces:**

- Consome: tipos/helpers da Task 4 (`buildSummary`, `requireCampaignMaster`).
- Produz (usado pelas Tasks 9-12):

```ts
export type CandidateDetail = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  characterId: string | null;
  characterName: string | null;
  availableDays: string[];
  preferredStart: string | null;
  preferredEnd: string | null;
  allDay: boolean;
  status: "interested" | "accepted" | "rejected";
  appliedAt: string;
};
export type PlayerCalendarEntry = {
  sessionId: string;
  campaignId: string;
  campaignName: string;
  coverImageUrl: string | null;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  sessionType: SessionType;
  xpReward: number | null;
};

getSessionFeed(userId: string, page?: number): Promise<{ items: SessionSummary[]; page: number; hasMore: boolean }>
getSessionDetail(sessionId: string, userId: string): Promise<SessionSummary>
applyToSession(sessionId: string, userId: string, input: ApplySessionInput): Promise<CandidateDetail>
listSessionCandidates(sessionId: string, masterId: string): Promise<CandidateDetail[]>
decideCandidate(sessionId: string, masterId: string, candidateUserId: string, decision: "accepted" | "rejected"): Promise<CandidateDetail>
confirmSession(sessionId: string, masterId: string, scheduledAt: string, durationMinutes?: number): Promise<SessionSummary>
cancelSession(sessionId: string, masterId: string): Promise<void>
listPlayerCalendar(userId: string): Promise<PlayerCalendarEntry[]>
```

Erros EXATOS: `"Sessão não encontrada"`; `"Apenas o Mestre pode gerenciar sessões desta campanha"`; `"Esta sessão não está mais aberta a candidaturas"`; `"O mestre não pode candidatar-se à própria sessão"`; `"Vagas esgotadas"`; `"Data final fora do período proposto"`; `"Candidatura não encontrada"`; `"Sessão já confirmada ou cancelada"`.

- [ ] **Step 1: Feed + detalhe**

```ts
export async function getSessionFeed(userId: string, page = 1) {
  const limit = 20;
  const rows = await db
    .select()
    .from(campaignSessions)
    .where(
      and(eq(campaignSessions.status, "proposed"), gte(campaignSessions.proposedEnd, new Date())),
    )
    .orderBy(campaignSessions.proposedStart)
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const items: SessionSummary[] = [];
  for (const row of rows.slice(0, limit)) {
    const summary = await buildSummary(row, userId);
    if (summary.remainingSlots > 0) items.push(summary);
  }
  return { items, page, hasMore: rows.length > limit };
}

export async function getSessionDetail(sessionId: string, userId: string): Promise<SessionSummary> {
  const [row] = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.id, sessionId))
    .limit(1);
  if (!row) throw new Error("Sessão não encontrada");
  return buildSummary(row, userId);
}
```

NOTA: o filtro `remainingSlots > 0` pós-query pode reduzir a página; aceitável
(feed pequeno). `hasMore` é calculado como `rows.length > limit` (query busca
`limit + 1` justamente para isso).

- [ ] **Step 2: Candidatura com FOR UPDATE + listagem + decisão**

```ts
async function requireSessionMaster(sessionId: string, masterId: string) {
  const [row] = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.id, sessionId))
    .limit(1);
  if (!row) throw new Error("Sessão não encontrada");
  if (row.masterId !== masterId)
    throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
  return row;
}

async function buildCandidateDetail(
  row: typeof sessionCandidates.$inferSelect,
): Promise<CandidateDetail> {
  const [user] = await db
    .select({ displayName: users.displayName, masterAvatar: users.masterAvatar })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  let characterName: string | null = null;
  if (row.characterId) {
    const [ch] = await db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, row.characterId))
      .limit(1);
    characterName = ch?.name ?? null;
  }
  return {
    userId: row.userId,
    displayName: user?.displayName || "Jogador",
    avatarUrl: user?.masterAvatar ?? null,
    characterId: row.characterId,
    characterName,
    availableDays: (row.availableDays ?? []) as string[],
    preferredStart: row.preferredStart,
    preferredEnd: row.preferredEnd,
    allDay: row.allDay,
    status: row.status as "interested" | "accepted" | "rejected",
    appliedAt: row.appliedAt.toISOString(),
  };
}

export async function applyToSession(
  sessionId: string,
  userId: string,
  input: ApplySessionInput,
): Promise<CandidateDetail> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);
    if (!row) throw new Error("Sessão não encontrada");
    if (row.status !== "proposed")
      throw new Error("Esta sessão não está mais aberta a candidaturas");
    if (row.masterId === userId)
      throw new Error("O mestre não pode candidatar-se à própria sessão");

    const accepted = await tx
      .select({ id: sessionCandidates.id })
      .from(sessionCandidates)
      .where(
        and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "accepted")),
      );
    const [existing] = await tx
      .select()
      .from(sessionCandidates)
      .where(and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.userId, userId)))
      .limit(1);
    if (accepted.length >= row.maxSlots && existing?.status !== "accepted")
      throw new Error("Vagas esgotadas");

    const startDay = new Date(row.proposedStart);
    const endDay = new Date(row.proposedEnd);
    const validDays = new Set(eachDayISO(startDay, endDay)); // importar de @/lib/utils/session-dates
    const days = input.availableDays.filter((d) => validDays.has(d));
    if (days.length === 0) throw new Error("Selecione ao menos um dia disponível");

    const allDay = !input.preferredStart || !input.preferredEnd;
    const values = {
      characterId: input.characterId ?? null,
      availableDays: days,
      preferredStart: allDay ? null : input.preferredStart!,
      preferredEnd: allDay ? null : input.preferredEnd!,
      allDay,
      status: "interested",
      appliedAt: new Date(),
    };
    const [upserted] = await tx
      .insert(sessionCandidates)
      .values({ sessionId, userId, ...values })
      .onConflictDoUpdate({
        target: [sessionCandidates.sessionId, sessionCandidates.userId],
        set: values,
      })
      .returning();
    return upserted;
  });
  return buildCandidateDetail(result);
}

export async function listSessionCandidates(
  sessionId: string,
  masterId: string,
): Promise<CandidateDetail[]> {
  await requireSessionMaster(sessionId, masterId);
  const rows = await db
    .select()
    .from(sessionCandidates)
    .where(eq(sessionCandidates.sessionId, sessionId))
    .orderBy(sessionCandidates.appliedAt);
  const details: CandidateDetail[] = [];
  for (const row of rows) details.push(await buildCandidateDetail(row));
  return details;
}

export async function decideCandidate(
  sessionId: string,
  masterId: string,
  candidateUserId: string,
  decision: "accepted" | "rejected",
): Promise<CandidateDetail> {
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);
    if (!row) throw new Error("Sessão não encontrada");
    if (row.masterId !== masterId)
      throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
    const [candidate] = await tx
      .select()
      .from(sessionCandidates)
      .where(
        and(
          eq(sessionCandidates.sessionId, sessionId),
          eq(sessionCandidates.userId, candidateUserId),
        ),
      )
      .limit(1);
    if (!candidate) throw new Error("Candidatura não encontrada");
    if (decision === "accepted" && candidate.status !== "accepted") {
      const accepted = await tx
        .select({ id: sessionCandidates.id })
        .from(sessionCandidates)
        .where(
          and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "accepted")),
        );
      if (accepted.length >= row.maxSlots) throw new Error("Vagas esgotadas");
    }
    const [u] = await tx
      .update(sessionCandidates)
      .set({ status: decision })
      .where(
        and(
          eq(sessionCandidates.sessionId, sessionId),
          eq(sessionCandidates.userId, candidateUserId),
        ),
      )
      .returning();
    return u;
  });
  return buildCandidateDetail(updated);
}
```

- [ ] **Step 3: Confirmar/cancelar + calendário do jogador**

```ts
export async function confirmSession(
  sessionId: string,
  masterId: string,
  scheduledAt: string,
  durationMinutes = 240,
): Promise<SessionSummary> {
  const row = await db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);
    if (!s) throw new Error("Sessão não encontrada");
    if (s.masterId !== masterId)
      throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
    if (s.status !== "proposed") throw new Error("Sessão já confirmada ou cancelada");
    const when = new Date(scheduledAt);
    if (when < s.proposedStart || when > s.proposedEnd)
      throw new Error("Data final fora do período proposto");
    const [updated] = await tx
      .update(campaignSessions)
      .set({ status: "confirmed", scheduledAt: when, durationMinutes, updatedAt: new Date() })
      .where(eq(campaignSessions.id, sessionId))
      .returning();
    await tx
      .update(sessionCandidates)
      .set({ status: "rejected" })
      .where(
        and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "interested")),
      );
    return updated;
  });
  return buildSummary(row, masterId);
}

export async function cancelSession(sessionId: string, masterId: string): Promise<void> {
  await requireSessionMaster(sessionId, masterId);
  const [row] = await db
    .select({ status: campaignSessions.status })
    .from(campaignSessions)
    .where(eq(campaignSessions.id, sessionId))
    .limit(1);
  if (row.status === "cancelled") return;
  await db
    .update(campaignSessions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(campaignSessions.id, sessionId));
}

export async function listPlayerCalendar(userId: string): Promise<PlayerCalendarEntry[]> {
  const rows = await db
    .select({ session: campaignSessions, campaign: campaigns })
    .from(sessionCandidates)
    .innerJoin(campaignSessions, eq(sessionCandidates.sessionId, campaignSessions.id))
    .innerJoin(campaigns, eq(campaignSessions.campaignId, campaigns.id))
    .where(
      and(
        eq(sessionCandidates.userId, userId),
        eq(sessionCandidates.status, "accepted"),
        eq(campaignSessions.status, "confirmed"),
      ),
    )
    .orderBy(campaignSessions.scheduledAt);
  return rows
    .filter((r) => r.session.scheduledAt !== null)
    .map((r) => ({
      sessionId: r.session.id,
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      coverImageUrl: r.campaign.coverImageUrl,
      description: r.session.description,
      scheduledAt: r.session.scheduledAt!.toISOString(),
      durationMinutes: r.session.durationMinutes,
      sessionType: r.session.sessionType as SessionType,
      xpReward: r.session.xpReward,
    }));
}
```

- [ ] **Step 4: Rotas**

- `GET /api/sessions` (adicionar ao route.ts existente): `page = Number(searchParams.get("page") ?? 1) || 1` → `getSessionFeed(user.id, page)` → `{ success, data: { items, page, hasMore } }`.
- `GET /api/sessions/[id]`: `getSessionDetail(id, user.id)`; "Sessão não encontrada" → 404.
- `PATCH /api/sessions/[id]`: parse `updateSessionSchema`; `action === "confirm"` → `confirmSession(id, user.id, data.scheduledAt, data.durationMinutes)`; `cancel` → `cancelSession`; erros: "Apenas o Mestre" 403; "Sessão não encontrada" 404; "Data final fora do período"/"Sessão já confirmada ou cancelada" 400/409 (409 para ambos).
- `GET /api/sessions/[id]/candidates`: `listSessionCandidates`; POST: parse `applySessionSchema` → `applyToSession`; erros: "não está mais aberta"/"Vagas esgotadas" 409; "mestre não pode candidatar-se"/"Selecione ao menos um dia" 400; "Sessão não encontrada" 404; "Apenas o Mestre" 403.
- `PATCH /api/sessions/[id]/candidates/[userId]`: parse `decideCandidateSchema` → `decideCandidate(id, user.id, userId, decision)`; "Vagas esgotadas" 409; "Candidatura não encontrada"/"Sessão não encontrada" 404; "Apenas o Mestre" 403.
- `GET /api/player/calendar`: `listPlayerCalendar(user.id)` → `{ success, data }`; 401/500.

Todas seguem o esqueleto da Task 4 (requireAuth → parse → service → catch com mapeamento por mensagem → logger).

- [ ] **Step 5: Testes `sessions-flow.test.ts`**

Mocks de todo o session-service. Casos (mínimo): feed 200 com items/page/hasMore + 401; detalhe 200/404; PATCH confirm 200 chamando `confirmSession(id, "m-1", scheduledAt, 240)`; PATCH cancel 200; PATCH 409 "Sessão já confirmada ou cancelada"; candidates GET 200/403; POST apply 201 + 409 "Vagas esgotadas" + 400 "Selecione ao menos um dia disponível"; PATCH decide 200 + 409; player/calendar 200/401.

- [ ] **Step 6: Rodar testes + tsc → PASS**

Run: `npx vitest run src/app/api/sessions/__tests__ && npx tsc --noEmit`

---

### Task 6: Eventos Socket.IO `session:*`

**Files:**

- Modify: `server.js` (após o bloco `chat:member-removed`, ~linha 393)
- Modify: `src/context/SocketContext.tsx` (interface ~linha 226, implementações após o bloco chat ~linha 1100, value ~linha 1165)

**Interfaces:**

- Produz (Tasks 11-12): `sendSessionPublish/sendSessionApply/sendSessionConfirm/sendSessionCancel(payload: Record<string, unknown>)`; `subscribeSessionPublished/Applied/Confirmed/Cancelled(cb: (payload: Record<string, unknown>) => void): () => void`. Eventos: cliente emite `session:publish|apply|confirm|cancel` → sala `campaign:${campaignId}` recebe `session:published|applied|confirmed|cancelled`.

- [ ] **Step 1: server.js**

```js
// Sessões agendadas em tempo real (Issue #63)
socket.on("session:publish", (payload) => {
  if (!payload || !payload.campaignId) return;
  io.to(`campaign:${payload.campaignId}`).emit("session:published", payload);
});
socket.on("session:apply", (payload) => {
  if (!payload || !payload.campaignId) return;
  io.to(`campaign:${payload.campaignId}`).emit("session:applied", payload);
});
socket.on("session:confirm", (payload) => {
  if (!payload || !payload.campaignId) return;
  io.to(`campaign:${payload.campaignId}`).emit("session:confirmed", payload);
});
socket.on("session:cancel", (payload) => {
  if (!payload || !payload.campaignId) return;
  io.to(`campaign:${payload.campaignId}`).emit("session:cancelled", payload);
});
```

- [ ] **Step 2: SocketContext**

Interface + 8 implementações copiando EXATAMENTE o padrão de `sendChatMemberUpdated`/`subscribeChatMemberUpdated` (useCallback, `socketRef.current || socket`, emit/on/off, deps `[socket]`), eventos `session:publish`/`session:published` etc. Adicionar as 8 ao `value`.

- [ ] **Step 3: tsc → limpo**

Run: `npx tsc --noEmit`

---

### Task 7: `CalendarGrid`

**Files:**

- Create: `src/components/calendar/CalendarGrid.tsx`
- Test: `src/components/calendar/__tests__/CalendarGrid.test.tsx`

**Interfaces:**

- Consome: utils da Task 3.
- Produz (Tasks 11-12):

```ts
export type CalendarEvent = {
  id: string;
  date: string; // 'yyyy-MM-dd' local
  title: string;
  tone: "accent" | "success" | "muted";
  badge?: string;
};
export type CalendarView = "month" | "week" | "day";
type CalendarGridProps = {
  view: CalendarView;
  cursor: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
};
```

- [ ] **Step 1: Testes (falham primeiro)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarGrid, type CalendarEvent } from "../CalendarGrid";

const events: CalendarEvent[] = [
  { id: "s-1", date: "2026-11-10", title: "Sessão em Barovia", tone: "accent", badge: "2/5" },
];

function setup(view: "month" | "week" | "day" = "month") {
  const props = {
    view,
    cursor: new Date(2026, 10, 8),
    events,
    onNavigate: vi.fn(),
    onViewChange: vi.fn(),
    onEventClick: vi.fn(),
    onDayClick: vi.fn(),
  };
  render(<CalendarGrid {...props} />);
  return props;
}

describe("CalendarGrid", () => {
  it("renderiza título do mês e 42 células", () => {
    setup();
    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(42);
  });
  it("navega para o mês seguinte/anterior e hoje", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-next"));
    expect(props.onNavigate).toHaveBeenCalledWith(expect.any(Date));
    const nextArg = props.onNavigate.mock.calls[0][0] as Date;
    expect(nextArg.getMonth()).toBe(11);
    fireEvent.click(screen.getByTestId("calendar-prev"));
    fireEvent.click(screen.getByTestId("calendar-today"));
    expect(props.onNavigate).toHaveBeenCalledTimes(3);
  });
  it("troca de view", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-view-week"));
    expect(props.onViewChange).toHaveBeenCalledWith("week");
  });
  it("renderiza evento e dispara clique", () => {
    const props = setup();
    const ev = screen.getByTestId("calendar-event-s-1");
    expect(ev).toHaveTextContent("Sessão em Barovia");
    fireEvent.click(ev);
    expect(props.onEventClick).toHaveBeenCalledWith(events[0]);
  });
  it("clique no dia dispara onDayClick", () => {
    const props = setup();
    fireEvent.click(screen.getByTestId("calendar-day-2026-11-10"));
    expect(props.onDayClick).toHaveBeenCalledWith(expect.any(Date));
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar `CalendarGrid.tsx`**

Estrutura completa ("use client"):

- Header: `formatMonthYear(cursor)` (month) ou range da semana (week: `dd – dd de mês`) ou data completa (day: Intl weekday+day+month); botões `calendar-prev`/`calendar-next` (ChevronLeft/Right; month→`addMonths(cursor, ±1)`, week→`addWeeks`, day→`addDays`), `calendar-today` (`onNavigate(new Date())`), trio `calendar-view-month|week|day` (pills com classe ativa `bg-accent text-white`).
- Month: `getMonthGrid(cursor.getFullYear(), cursor.getMonth())` → grid `grid grid-cols-7 gap-px`; cabeçalho seg..dom (`["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]`); cada célula: botão `data-testid={`calendar-day-${toLocalDateISO(d)}`}`, altura `min-h-16 md:min-h-24`, dia fora do mês `opacity-40`, hoje com `ring-1 ring-accent`; número do dia; eventos do dia (`events.filter(e => e.date === iso)`) como blocos `data-testid={`calendar-event-${e.id}`}` (`stopPropagation` no clique → `onEventClick`); mobile: blocos `hidden md:flex` e linha de pontos coloridos `md:hidden` (1 ponto por evento, máx 3, +N); tons: accent=`bg-accent/20 text-accent border-accent/40`, success=`bg-green-900/40 text-green-300 border-green-700/50`, muted=`bg-secondary-input text-secondary-muted border-secondary-border line-through`.
- Week: `getWeekDays(cursor)` → 7 colunas (`grid grid-cols-7`), cada uma com label do dia + lista vertical de eventos (mesmos blocos, sempre visíveis).
- Day: coluna única com eventos cuja data == `toLocalDateISO(cursor)` em ordem; estado vazio "Nenhuma sessão neste dia."
- Clique em célula (fora dos blocos) → `onDayClick?.(d)`.
- Container: `data-testid="calendar-grid"`, `rounded-xl border border-secondary-border bg-secondary-card overflow-hidden`.

- [ ] **Step 3: Rodar → PASS + tsc**

Run: `npx vitest run src/components/calendar/__tests__/CalendarGrid.test.tsx && npx tsc --noEmit`

---

### Task 8: `SessionLaunchModal`

**Files:**

- Create: `src/components/sessions/SessionLaunchModal.tsx`
- Test: `src/components/sessions/__tests__/SessionLaunchModal.test.tsx`

**Interfaces:**

- Consome: `GET /api/campaigns` (`{ success, data: [{ id, name, ... }] }`), `GET /api/campaigns/[id]/session-context` (Task 4), `POST /api/sessions` (Task 4), `SessionSummary`/`SessionContext`.
- Produz (Task 11): `SessionLaunchModal({ isOpen, onClose, onLaunched }: { isOpen: boolean; onClose: () => void; onLaunched: (session: SessionSummary) => void })` — o socket emit é responsabilidade do pai.

- [ ] **Step 1: Testes (falham primeiro)**

Mock fetch por URL: `/api/campaigns` → `{ success: true, data: [{ id: "c-1", name: "Strahd" }] }`; `/api/campaigns/c-1/session-context` → configurável (`isFirstSession: true, oneShot: null, maxPlayers: null, enrolledPlayers: []` ou `isFirstSession: false, oneShot: false, maxPlayers: 5, enrolledPlayers: [{ userId: "u-2", displayName: "Maria", characterName: "Artemis" }]`); POST `/api/sessions` → `{ success: true, data: { id: "s-1" } }`.

Casos:

1. Abre, seleciona campanha "Strahd" (select `data-testid="launch-campaign-select"`), contexto 1ª sessão → radios `launch-type-one-shot`/`launch-type-continuing` e input `launch-max-slots` visíveis.
2. Contexto continuada → radios/inputs ausentes; badge "Campanha continuada · 5 vagas" e nome "Maria" (inscritos) visíveis.
3. Submit 1ª sessão preenchendo descrição (`launch-description`), datas (`launch-start-date` = "2026-12-01", `launch-end-date` = "2026-12-03"), tipo one-shot, vagas 4 → POST chamado com body `{ campaignId: "c-1", description, proposedStart: new Date("2026-12-01T00:00:00").toISOString(), proposedEnd: new Date("2026-12-03T23:59:59").toISOString(), sessionType: "one_shot", maxSlots: 4 }` e `onLaunched` chamado.
4. Descrição < 10 chars → erro inline, sem POST.

- [ ] **Step 2: Implementar**

- Reutilizar `Modal` (`@/components/ui/Modal`, padrão `CreatePollModal`: `Modal.Header` com título "Lançar Sessão" + `Modal.CloseButton`, `Modal.Body`).
- Estados: `campaigns`, `selectedCampaignId`, `context: SessionContext | null`, `loadingContext`, form (`description`, `startDate`, `endDate`, `sessionType: "one_shot"`, `maxSlots: "4"`, `xpReward: ""`), `error`, `submitting`.
- `useEffect isOpen`: fetch campanhas; ao selecionar: fetch session-context (guard `cancelled`).
- Conversão datas: `new Date(`${startDate}T00:00:00`).toISOString()` / `new Date(`${endDate}T23:59:59`).toISOString()` (local → UTC).
- Condicional: `context.isFirstSession || context.oneShot === null || context.maxPlayers === null` → bloco obrigatório (radios + number 1–20); senão → badges herdadas (`context.oneShot ? "One-shot" : "Campanha continuada"` + `${context.maxPlayers} vagas`) + lista `context.enrolledPlayers` (nome + personagem).
- Validação client: descrição ≥10, datas preenchidas e fim ≥ início, 1ª sessão exige tipo+vagas; erros inline `text-red-300` (padrão CreatePollModal).
- Submit: POST → `onLaunched(data.data)` + `onClose()`; erro da API → inline.
- XP opcional: input number `launch-xp` (vazio → não enviar).

- [ ] **Step 3: Rodar → PASS + tsc**

---

### Task 9: `SessionDetailDrawer` + `ConfirmSessionModal`

**Files:**

- Create: `src/components/sessions/SessionDetailDrawer.tsx`, `src/components/sessions/ConfirmSessionModal.tsx`
- Test: `src/components/sessions/__tests__/SessionDetailDrawer.test.tsx`

**Interfaces:**

- Consome: `SessionSummary`/`CandidateDetail` (Tasks 4-5); rotas candidates GET/PATCH, PATCH sessions.
- Produz (Task 11):

```ts
SessionDetailDrawer({ session, isMaster, onClose, onConfirmed, onCancelled }: {
  session: SessionSummary; isMaster: boolean; onClose: () => void;
  onConfirmed: (session: SessionSummary) => void; onCancelled: (sessionId: string) => void;
})
ConfirmSessionModal({ isOpen, session, onClose, onConfirm }: {
  isOpen: boolean; session: SessionSummary; onClose: () => void;
  onConfirm: (scheduledAt: string, durationMinutes: number) => Promise<void>;
})
```

- [ ] **Step 1: Testes (falham primeiro)**

`SessionSummary` fixture completa (status proposed, maxSlots 5, acceptedCount 1, remainingSlots 4, período 2026-12-01..03). Mock fetch: GET candidates → `{ success: true, data: [CandidateDetail fixture userId "u-2" interested, availableDays ["2026-12-01","2026-12-02"], allDay false, preferredStart "19:00", preferredEnd "23:00"] }`; PATCH candidates/u-2 → `{ success: true, data: { ...candidate, status: "accepted" } }`; PATCH sessions → `{ success: true, data: { ...session, status: "confirmed", scheduledAt: "..." } }`.

Casos:

1. `isMaster` → busca candidates e renderiza "Maria" + dias + "19:00 – 23:00"; botão `candidate-accept-u-2` → PATCH decide `{ decision: "accepted" }`.
2. Botão `confirm-session-button` abre ConfirmSessionModal; preencher `confirm-datetime` (input datetime-local) + `confirm-duration` → submit → PATCH sessions com `{ action: "confirm", scheduledAt: ISO, durationMinutes }` → `onConfirmed`.
3. `cancel-session-button` → confirmação inline `confirm-cancel-session` → PATCH `{ action: "cancel" }` → `onCancelled(session.id)`.
4. `isMaster=false` → sem botões de gestão; mostra `userApplication` se presente.
5. Candidato `allDay: true` → texto "Livre o dia todo".

- [ ] **Step 2: Implementar `ConfirmSessionModal`**

Modal simples: input `datetime-local` (`confirm-datetime`) com min/max derivados do período (`toLocalISO + "T00:00"` / `"T23:59"`), number `confirm-duration` (30–1440, default 240, passo 30), submit → `onConfirm(new Date(value).toISOString(), duration)`; erro inline se fora do período (validação client + API).

- [ ] **Step 3: Implementar `SessionDetailDrawer`**

- Modal largo (`max-w-lg`): header com nome da campanha + badges (status, tipo, XP); descrição; período (`Intl` dd/mm); vagas `acceptedCount/maxSlots`; scheduledAt se confirmed.
- `isMaster && status === "proposed"`: fetch candidates ao montar; lista com avatar/inicial, nome, personagem, dias (pills), horário ou "Livre o dia todo", status badge; botões `candidate-accept-${userId}` / `candidate-reject-${userId}` (PATCH decide; atualiza lista local).
- Ações mestre (proposed): `confirm-session-button` → ConfirmSessionModal → PATCH confirm → `onConfirmed(data.data)`; `cancel-session-button` → 2 passos (`confirm-cancel-session`) → PATCH cancel → `onCancelled`.
- Não-mestre: mostra `session.userApplication` (status + dias + horário) se houver.
- Erros inline `text-red-300`; fetch sempre `credentials: "include"`.

- [ ] **Step 4: Rodar → PASS + tsc**

---

### Task 10: Feed de convites + candidatura

**Files:**

- Create: `src/components/sessions/SessionInviteCard.tsx`, `SessionInviteFeed.tsx`, `SessionInviteDetail.tsx`, `ApplySessionModal.tsx`
- Test: `src/components/sessions/__tests__/SessionInviteFeed.test.tsx`, `ApplySessionModal.test.tsx`

**Interfaces:**

- Consome: `GET /api/sessions?page=` (Task 5), `GET /api/characters` (`{ success, data: [...] }` — verificar formato no arquivo), `POST /api/sessions/[id]/candidates`, utils Task 3, `SessionSummary`.
- Produz (Task 12):

```ts
SessionInviteFeed({ currentUserId, onApplied }: { currentUserId: string; onApplied: (campaignId: string, sessionId: string) => void })
ApplySessionModal({ session, isOpen, onClose, onApplied }: {
  session: SessionSummary; isOpen: boolean; onClose: () => void;
  onApplied: (campaignId: string, sessionId: string) => void;
})
```

- [ ] **Step 1: Testes do feed (falham primeiro)**

Mock GET `/api/sessions` → `{ success: true, data: { items: [SessionSummary fixture], page: 1, hasMore: false } }`. Casos: card renderiza nome da campanha, mestre, sinopse, badges ("One-shot", "4 vagas", "XP 500"); clique abre detalhe com botão `apply-interest-button`; `userApplication` presente → mostra "Candidatura enviada" em vez do botão; feed vazio → "Nenhum convite de sessão no momento."

- [ ] **Step 2: Implementar `SessionInviteCard` + `SessionInviteFeed` + `SessionInviteDetail`**

- **Card** (estilo X, `data-testid={`session-invite-${id}`}"): banner (`coverImageUrl`ou gradiente`from-accent/30 to-dominant-deep`com inicial), linha avatar+nome do mestre + data relativa do período, sinopse`line-clamp-2`, metadados inline (vagas restantes, XP se houver, período `dd/mm – dd/mm`), badges One-shot/Campanha; botão/card clicável → `onOpen(session)`.
- **Feed**: fetch page 1 ao montar; lista de cards; botão `load-more-invites` se `hasMore` (append page+1); estados loading/empty/error; `onApplied` repassado ao modal.
- **Detail** (Modal): infos completas + `userApplication` (status/dias/horário) ou botão `apply-interest-button` → abre `ApplySessionModal`.

- [ ] **Step 3: Testes do ApplySessionModal (falham primeiro)**

Fixture sessão período 2026-12-01..03. Mock `/api/characters` → `{ success: true, data: [{ id: "ch-1", name: "Artemis" }] }`; POST candidates → `{ success: true, data: {} }`. Casos:

1. Renderiza pills dos 3 dias (`apply-day-2026-12-01` etc.); toggle `apply-all-day` ligado por padrão; selecionar dia 1+2, desligar allDay, preencher `apply-time-start` "19:00" / `apply-time-end` "23:00", personagem "Artemis" → POST body `{ characterId: "ch-1", availableDays: ["2026-12-01","2026-12-02"], preferredStart: "19:00", preferredEnd: "23:00" }` → `onApplied(campaignId, sessionId)`.
2. Sem horário (allDay ligado) → body sem preferredStart/End.
3. Nenhum dia selecionado → erro inline, sem POST.
4. "Candidatar-se sem ficha" → characterId null.

- [ ] **Step 4: Implementar `ApplySessionModal`**

- Modal: select personagem opcional (`apply-character-select`, opção "" = "Candidatar-se sem ficha"); grade de pills de dias via `eachDayISO(new Date(session.proposedStart), new Date(session.proposedEnd))` (toggle selecionado `bg-accent text-white`); toggle `apply-all-day` (checkbox, default true) com hint "Livre o dia todo"; quando desligado → inputs time `apply-time-start`/`apply-time-end`; validação client (≥1 dia; horários aos pares); POST → `onApplied` + `onClose`; erro API inline.

- [ ] **Step 5: Rodar → PASS + tsc**

---

### Task 11: `MasterSessionCalendar` + aba no `MasterCommunityView`

**Files:**

- Create: `src/components/sessions/MasterSessionCalendar.tsx`
- Modify: `src/components/community/MasterCommunityView.tsx`
- Test: `src/components/sessions/__tests__/MasterSessionCalendar.test.tsx`; estender `src/components/community/__tests__/MasterCommunityView.test.tsx`

**Interfaces:**

- Consome: CalendarGrid (T7), SessionLaunchModal (T8), SessionDetailDrawer (T9), `GET /api/sessions/master`, socket `sendSessionPublish/Confirm/Cancel` + `subscribeSessionApplied/Confirmed/Cancelled`, `Toast` de `@/components/ui/Toast`.
- Produz: aba `tab-master-calendar` no mestre.

- [ ] **Step 1: Testes (falham primeiro)**

Mock fetch `/api/sessions/master` → `{ success: true, data: [SessionSummary fixture proposed] }`; mock `useSocket` (parcial: sends como vi.fn(), subscribes retornando vi.fn()); mock dos 3 componentes filhos (CalendarGrid capturando props, LaunchModal/Drawer simplificados). Casos:

1. Renderiza CalendarGrid com 1 evento (tone accent, date = proposedStart local) e botão `launch-session-button`.
2. Abrir launch modal → `onLaunched(session)` → `sendSessionPublish({ campaignId, session })` + refetch.
3. Clique em evento → drawer; `onConfirmed` → `sendSessionConfirm` + refetch; `onCancelled` → `sendSessionCancel` + refetch.
4. MasterCommunityView: 3 abas; clicar `tab-master-calendar` renderiza MasterSessionCalendar (mockado).

- [ ] **Step 2: Implementar `MasterSessionCalendar`**

- Estados: `sessions`, `view`/`cursor`, `launchOpen`, `selected: SessionSummary | null`, `toasts: { id, message, type }[]`, loading/error.
- `loadSessions` (useCallback): GET master → setSessions; `useEffect` mount com eslint-disable padrão.
- Eventos p/ grid: `sessions.filter(s => s.status !== "cancelled").map(s => ({ id: s.id, date: toLocalDateISO(new Date(s.scheduledAt ?? s.proposedStart)), title: s.campaignName, tone: s.status === "confirmed" ? "success" : "accent", badge: `${s.acceptedCount}/${s.maxSlots}` }))` + cancelled com tone muted (opcional: incluir para histórico).
- Header: título "Calendário de Sessões" + botão `launch-session-button` (Plus, "Lançar Sessão").
- `onLaunched`: `sendSessionPublish({ campaignId: session.campaignId, session })` → toast success → loadSessions.
- Drawer: `isMaster` true; `onConfirmed` → `sendSessionConfirm({ campaignId, session })` + toast + load; `onCancelled` → `sendSessionCancel({ campaignId, sessionId })` + toast + load.
- Subscrições: `subscribeSessionApplied/Confirmed/Cancelled` → loadSessions (guard por campaignId das próprias sessions) + toast info para confirmed/cancelled; unsubscribe no cleanup.
- Toasts locais: estado + render `{toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={...} />)}` (sem ToastContainer no master).

- [ ] **Step 3: Aba no `MasterCommunityView`**

- Estado `activeTab: "feed" | "chat" | "calendar"`; novo botão `data-testid="tab-master-calendar"` (ícone CalendarDays, label "Calendário", mesmas classes dos vizinhos); render `activeTab === "calendar" && <MasterSessionCalendar />`.
- Preservar comportamento `useSearchParams` existente (tab=chat).

- [ ] **Step 4: Rodar → PASS + tsc**

Run: `npx vitest run src/components/sessions/__tests__ src/components/community/__tests__ && npx tsc --noEmit`

---

### Task 12: Hub do jogador + calendário pessoal + deep-link

**Files:**

- Create: `src/components/sessions/PlayerCommunityHub.tsx`, `src/components/sessions/PlayerSessionCalendar.tsx`
- Modify: `src/components/player/PlayerDashboard.tsx` (bloco community ~linha 897; deep-link), `src/app/player/page.tsx` (Suspense)
- Test: `src/components/sessions/__tests__/PlayerCommunityHub.test.tsx`; estender testes do PlayerDashboard se quebrarem

**Interfaces:**

- Consome: CampaignChat existente, CalendarGrid, SessionInviteFeed (T10), `GET /api/player/calendar`, `GET /api/player/campaigns` (formato: verificar no arquivo — usado em PlayerDashboard.tsx:148), socket join/leaveCampaign + sendSessionApply + subscribeSessionPublished/Confirmed/Cancelled.
- Produz: `PlayerCommunityHub({ currentUser }: { currentUser: { id: string; displayName: string | null; avatarUrl?: string | null } })`.

- [ ] **Step 1: Testes do hub (falham primeiro)**

Mocks: CampaignChat/CalendarGrid/SessionInviteFeed/PlayerSessionCalendar como stubs com testids; fetch `/api/player/campaigns` → `{ success: true, data: [{ id: "c-1" }] }` (confirmar formato real antes); useSocket mockado (joinCampaign/leaveCampaign vi.fn()). Casos:

1. Renderiza 3 sub-abas (`hub-tab-groups`, `hub-tab-calendar`, `hub-tab-invites`); Groups ativo por default → CampaignChat visível.
2. Clique `hub-tab-invites` → feed visível; localStorage `libmork.communityHubTab` = "invites"; remontagem restaura a aba.
3. Mount → `joinCampaign` chamado com `{ campaignId: "c-1", role: "player" }`; unmount → `leaveCampaign("c-1")`.

- [ ] **Step 2: Implementar `PlayerSessionCalendar`**

- Fetch `/api/player/calendar` → entries; CalendarGrid (view month default) com eventos `{ id: sessionId, date: toLocalDateISO(new Date(scheduledAt)), title: campaignName, tone: "success", badge: hora HH:mm }`.
- Clique evento → Modal com descrição, campanha, data/hora (Intl), duração, XP + Link `data-testid="go-to-room-link"` href={`/player?tab=campaigns&campaign=${campaignId}`} "Ir para a sala" (Button accent).
- Subscrições confirmed/cancelled → refetch; empty state "Nenhuma sessão confirmada na sua agenda."

- [ ] **Step 3: Implementar `PlayerCommunityHub`**

- Sub-abas pills (padrão visual das abas do MasterCommunityView): Groups (MessageSquare) → `<CampaignChat currentUser={...} />`; Calendário (CalendarDays) → `<PlayerSessionCalendar />`; Convites (Globe2) → `<SessionInviteFeed currentUserId onApplied={(campaignId, sessionId) => sendSessionApply({ campaignId, sessionId })} />`.
- Estado da aba: inicial de `localStorage.getItem("libmork.communityHubTab")` (fallback "groups"; ler dentro de useState initializer com guard typeof window); persistir no onChange.
- Realtime: ao montar fetch `/api/player/campaigns` → para cada campanha `joinCampaign({ campaignId, role: "player" })`; cleanup `leaveCampaign` para cada; subscrições `subscribeSessionPublished` (badge de novidade na aba Convites: estado `hasNewInvites`, zerado ao abrir a aba), `subscribeSessionConfirmed/Cancelled` → toast local (ui/Toast) + incrementar `refreshKey` passado ao `PlayerSessionCalendar` para forçar refetch.
- Container: `flex flex-col h-full`; barra de sub-abas shrink-0; conteúdo flex-1 min-h-0 (Groups precisa de altura p/ CampaignChat).

- [ ] **Step 4: Integrar no `PlayerDashboard` + deep-link**

- Substituir o bloco `{activeTab === "community" && (... <CampaignChat .../> ...)}` por `<PlayerCommunityHub currentUser={{ id: userId, displayName: userName }} />` (mesmas classes de container).
- Deep-link: `const searchParams = useSearchParams();` (import next/navigation); estado inicial `activeTab` continua como está; novo efeito: quando `campaigns` (lista do jogador) carregar e `searchParams.get("campaign")` existir e ainda não aplicado (ref `deepLinkAppliedRef`), `setActiveTab("campaigns")` + `setSelectedCampaign(campaign found)`; `tab` param: se `"campaigns"|"community"|...` válido → setActiveTab uma vez no mount. Marcar ref após aplicar (não reabrir após Escape).
- `src/app/player/page.tsx`: envolver `<PlayerDashboard />` em `<Suspense>` (import react), precedente master/community/page.tsx.
- Remover import de CampaignChat do PlayerDashboard se ficar não-usado.

- [ ] **Step 5: Rodar testes + tsc**

Run: `npx vitest run src/components/sessions/__tests__ src/components/player/__tests__ && npx tsc --noEmit`
Corrigir fixtures/expectativas dos testes existentes do PlayerDashboard que assumiam CampaignChat direto na aba community (agora é o hub).

---

### Task 13: Verificação final

- [ ] **Step 1: Suite completa** — `npx vitest run` → tudo verde (baseline: 130 arquivos/1026 testes; não introduzir falhas).
- [ ] **Step 2: tsc + eslint** — `npx tsc --noEmit`; `npx eslint src/components/calendar src/components/sessions src/lib/server/session-service.ts src/lib/validators/sessions.ts src/lib/utils/session-dates.ts src/app/api/sessions src/app/api/player/calendar "src/app/api/campaigns/[id]/session-context" "src/app/api/campaigns/[id]/enrolled-players" src/components/community/MasterCommunityView.tsx src/components/player/PlayerDashboard.tsx src/context/SocketContext.tsx server.js` → sem erros novos (pré-existentes documentados ok).
- [ ] **Step 3: Checklist manual (dev server)** —
  1. Mestre: aba Calendário → Lançar Sessão (1ª: tipo+vagas obrigatórios; campanha com sessão prévia: herdado + inscritos auto-accepted).
  2. Jogador: hub → Convites → card → Tenho Interesse → dias + horário (e fallback Livre o dia todo) → candidatura.
  3. Mestre: drawer → panorama de disponibilidades → aceitar → Confirmar Sessão (data dentro do período) → toast.
  4. Jogador: Calendário Pessoal mostra sessão confirmada → "Ir para a sala" abre campanha no dashboard.
  5. Realtime: duas abas → convite publicado aparece via badge; confirmação gera toast.
  6. Cancelar sessão → some do calendário pessoal.
  7. Mobile: grid mês com pontos, sub-abas empilhadas, modais adaptados.
- [ ] **Step 4: Commit/push/PR** — SOMENTE com autorização explícita do usuário (HUSKY=0 precedente autorizado; PR com "Closes #63").

---

## Ondas para execução paralela (subagents quando pedido)

- **Onda 1** (3 paralelos, arquivos disjuntos): Task 1 ∥ Task 2 ∥ Task 3.
- **Onda 2** (2 paralelos): Tasks 4+5 (agente único, service+rotas acoplados) ∥ Task 6 (server.js/SocketContext).
- **Onda 3** (4 paralelos, só arquivos novos): Task 7 ∥ Task 8 ∥ Task 9 ∥ Task 10.
- **Onda 4** (agente único, arquivos compartilhados): Tasks 11+12.
- **Onda 5** (sessão principal): Task 13 + revisão dos diffs.

## Ordem estrita se inline

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13.
