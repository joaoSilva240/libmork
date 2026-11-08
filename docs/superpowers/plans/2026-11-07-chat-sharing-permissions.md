# Chat: DMs, Compartilhamentos e Permissões — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o chat de campanhas (issue #62) com DMs 1:1, compartilhamentos com card padrão (biblioteca, perfis, publicações, acesso a campanhas) e gerenciamento de permissões/membros por grupo.

**Architecture:** Extensão aditiva das tabelas de chat existentes (`campaign_chat_groups` ganha `type`/`userAId`/`userBId` e `campaignId` nullable; `campaign_chat_messages` ganha `payload` jsonb; `campaign_chat_members` ganha flags de permissão). Toda lógica nova vive em `chat-service.ts` (payloads de share montados no servidor). UI segue o padrão dos componentes de chat existentes (theme tokens, `data-testid`, Vitest + Testing Library).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (PostgreSQL), Socket.IO (`server.js` + `SocketContext`), Zod, Vitest + @testing-library/react, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-07-chat-sharing-permissions-design.md`

## Global Constraints

- Branch de trabalho: `feature/issue-62-campaign-chat-groups` (NUNCA criar worktrees paralelos; trabalhar nesta sessão/repo).
- **Commits:** somente na feature branch e somente após autorização do usuário; **push só com autorização explícita** (husky pre-push exige docker, ausente na máquina; `--no-verify` só com autorização expressa).
- UI usa **tokens de tema** (`bg-secondary-card`, `border-secondary-border`, `text-secondary-pure`, `text-secondary-muted`, `bg-accent`, etc.) — nunca paleta Tailwind fixa (exceção: conteúdo diegético).
- PT-BR em todas as strings de usuário, erros e mensagens.
- O projeto NÃO usa `db:push`/migrations do drizzle-kit para o banco real — mudanças de schema vão via **script SQL aditivo idempotente temporário** (técnica já usada nas tabelas de chat), aplicado com `NODE_PATH="C:/Users/kyone/Documents/Dev/libmork/node_modules"` e `dotenv`.
- `.env` contém credenciais reais — nunca ecoar no transcript nem commitar.
- Lint: seguir os `eslint-disable-next-line react-hooks/set-state-in-effect` já estabelecidos; sem `any` (usar `Record<string, unknown>` + cast `as unknown as T`).
- JSDOM não tem `scrollIntoView` — manter guards `typeof ... === "function"`.
- Rotas API seguem o padrão existente: `requireAuth()` de `@/lib/auth/session`, resposta `{ success, data }` / `{ success: false, error }`, `logger.error({ err: error }, "...")`.
- Testes de rotas mockeiam `@/lib/server/chat-service` e `@/lib/auth/session` (padrão de `src/app/api/chat/__tests__/chat-routes.test.ts`).
- Executar testes sempre a partir da raiz do repo: `npx vitest run <arquivo>`.

---

### Task 1: Schema + migração aditiva do banco

**Files:**
- Modify: `src/lib/db/schema.ts` (tabelas `campaignChatGroups` ~linha 1334, `campaignChatMembers` ~linha 1352, `campaignChatMessages` ~linha 1379)
- Create (temporário, deletar ao final): `scripts/tmp-apply-chat-evolution.js`

**Interfaces:**
- Produz: colunas novas no ORM — `campaignChatGroups.type/userAId/userBId` (campaignId nullable), `campaignChatMessages.payload`, `campaignChatMembers.canRead/canWrite/canShare`. Todas as tasks seguintes dependem disto.

- [ ] **Step 1: Atualizar `campaignChatGroups` no schema.ts**

Trocar o bloco atual (linhas ~1334-1347) por:

```ts
export const campaignChatGroups = pgTable(
  "campaign_chat_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull().default("campaign"), // "campaign" | "dm"
    name: varchar("name", { length: 200 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    userAId: uuid("user_a_id").references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_campaign_chat_groups_campaign").on(table.campaignId),
    uniqueIndex("idx_dm_pair").on(table.userAId, table.userBId),
  ],
);
```

- [ ] **Step 2: Adicionar permissões em `campaignChatMembers`**

Após a coluna `role` do `campaignChatMembers`, adicionar:

```ts
    canRead: boolean("can_read").notNull().default(true),
    canWrite: boolean("can_write").notNull().default(true),
    canShare: boolean("can_share").notNull().default(true),
```

- [ ] **Step 3: Adicionar `payload` em `campaignChatMessages`**

Após a coluna `type` do `campaignChatMessages`, adicionar:

```ts
    payload: jsonb("payload"), // SharePayload quando type = "share"
```

(Certificar que `jsonb` e `boolean` estão importados de `drizzle-orm/pg-core` no topo do arquivo — `boolean` e `jsonb` já são usados em outras tabelas.)

- [ ] **Step 4: Criar e rodar o script de migração aditiva**

Criar `scripts/tmp-apply-chat-evolution.js`:

```js
require("dotenv").config();
const { Client } = require("pg");

const SQL = `
BEGIN;
ALTER TABLE campaign_chat_groups ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE campaign_chat_groups ADD COLUMN IF NOT EXISTS type varchar(20) NOT NULL DEFAULT 'campaign';
ALTER TABLE campaign_chat_groups ADD COLUMN IF NOT EXISTS user_a_id uuid;
ALTER TABLE campaign_chat_groups ADD COLUMN IF NOT EXISTS user_b_id uuid;
ALTER TABLE campaign_chat_messages ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE campaign_chat_members ADD COLUMN IF NOT EXISTS can_read boolean NOT NULL DEFAULT true;
ALTER TABLE campaign_chat_members ADD COLUMN IF NOT EXISTS can_write boolean NOT NULL DEFAULT true;
ALTER TABLE campaign_chat_members ADD COLUMN IF NOT EXISTS can_share boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  ALTER TABLE campaign_chat_groups ADD CONSTRAINT campaign_chat_groups_user_a_id_fk
    FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE campaign_chat_groups ADD CONSTRAINT campaign_chat_groups_user_b_id_fk
    FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_pair ON campaign_chat_groups (user_a_id, user_b_id);
COMMIT;
`;

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(SQL);
  console.log("OK: evolução do chat aplicada.");
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

Rodar: `NODE_PATH="C:/Users/kyone/Documents/Dev/libmork/node_modules" node scripts/tmp-apply-chat-evolution.js`
Esperado: `OK: evolução do chat aplicada.`

- [ ] **Step 5: Verificar colunas no banco (read-only)**

```bash
NODE_PATH="C:/Users/kyone/Documents/Dev/libmork/node_modules" node -e "require('dotenv').config();const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name IN ('campaign_chat_groups','campaign_chat_members','campaign_chat_messages') AND column_name IN ('type','user_a_id','user_b_id','payload','can_read','can_write','can_share') ORDER BY 1\");console.log(r.rows);await c.end();})()"
```

Esperado: 7 linhas (can_read, can_share, can_write, payload, type, user_a_id, user_b_id).

- [ ] **Step 6: Deletar o script temporário e verificar types**

```bash
rm scripts/tmp-apply-chat-evolution.js
npx tsc --noEmit
```

Esperado: tsc limpo (o tipo de `campaignId` em `ChatGroupSummary` quebra na Task 3 — se aparecer erro em `chat-service.ts` linha 24/257 por `campaignId: string`, **adiar** a checagem para o fim da Task 3; anotar e seguir).

---

### Task 2: Validadores Zod (share, DM, permissões)

**Files:**
- Modify: `src/lib/validators/chat.ts`
- Test: `src/lib/validators/__tests__/chat.test.ts` (estender o existente)

**Interfaces:**
- Consumes: `contentTypeSchema` de `@/lib/validators/content` (`"skills" | "spells" | "items" | "conditions"`).
- Produz (usado pelas Tasks 3-5 e 7-9):
  - `shareInputSchema` → `{ kind: "library_item"|"profile"|"post"|"campaign"; id: string(uuid); contentType?: ContentType }`
  - `createChatMessageSchema` estendido: `type` enum ganha `"share"`; campo opcional `share`
  - `createDmSchema` → `{ userId: string(uuid) }`
  - `updateMemberPermissionsSchema` → `{ canRead?: boolean; canWrite?: boolean; canShare?: boolean }` (mín. 1)
  - `removeCampaignMemberSchema` → `{ userId: string(uuid) }`
  - Tipos: `ShareInput`, `CreateDmInput`, `UpdateMemberPermissionsInput`, `RemoveCampaignMemberInput`

- [ ] **Step 1: Escrever os testes novos (falham antes do código)**

Acrescentar em `src/lib/validators/__tests__/chat.test.ts`:

```ts
import {
  shareInputSchema,
  createDmSchema,
  updateMemberPermissionsSchema,
  removeCampaignMemberSchema,
  createChatMessageSchema,
} from "../chat";

describe("shareInputSchema", () => {
  it("aceita share de perfil com uuid", () => {
    const r = shareInputSchema.safeParse({ kind: "profile", id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });

  it("exige contentType para library_item", () => {
    const semTipo = shareInputSchema.safeParse({ kind: "library_item", id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(semTipo.success).toBe(false);
    const comTipo = shareInputSchema.safeParse({ kind: "library_item", id: "550e8400-e29b-41d4-a716-446655440000", contentType: "spells" });
    expect(comTipo.success).toBe(true);
  });

  it("rejeita kind inválido e id não-uuid", () => {
    expect(shareInputSchema.safeParse({ kind: "arquivo", id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(false);
    expect(shareInputSchema.safeParse({ kind: "post", id: "abc" }).success).toBe(false);
  });
});

describe("createChatMessageSchema com share", () => {
  it("aceita type share com bloco share", () => {
    const r = createChatMessageSchema.safeParse({
      content: "Olha essa magia",
      type: "share",
      share: { kind: "post", id: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(r.success).toBe(true);
  });
});

describe("createDmSchema", () => {
  it("aceita uuid e rejeita inválido", () => {
    expect(createDmSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(true);
    expect(createDmSchema.safeParse({ userId: "x" }).success).toBe(false);
  });
});

describe("updateMemberPermissionsSchema", () => {
  it("aceita flags parciais", () => {
    expect(updateMemberPermissionsSchema.safeParse({ canWrite: false }).success).toBe(true);
  });
  it("rejeita objeto vazio", () => {
    expect(updateMemberPermissionsSchema.safeParse({}).success).toBe(false);
  });
});

describe("removeCampaignMemberSchema", () => {
  it("aceita uuid e rejeita inválido", () => {
    expect(removeCampaignMemberSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(true);
    expect(removeCampaignMemberSchema.safeParse({ userId: "x" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/validators/__tests__/chat.test.ts`
Expected: FAIL (exports inexistentes).

- [ ] **Step 3: Implementar em `src/lib/validators/chat.ts`**

Adicionar ao arquivo existente:

```ts
import { contentTypeSchema } from "@/lib/validators/content";

export const shareInputSchema = z
  .object({
    kind: z.enum(["library_item", "profile", "post", "campaign"]),
    id: z.string().uuid("ID inválido"),
    contentType: contentTypeSchema.optional(),
  })
  .refine((v) => v.kind !== "library_item" || Boolean(v.contentType), {
    message: "contentType é obrigatório para itens da biblioteca",
    path: ["contentType"],
  });

export const createDmSchema = z.object({
  userId: z.string().uuid("Usuário inválido"),
});

export const updateMemberPermissionsSchema = z
  .object({
    canRead: z.boolean().optional(),
    canWrite: z.boolean().optional(),
    canShare: z.boolean().optional(),
  })
  .refine((v) => v.canRead !== undefined || v.canWrite !== undefined || v.canShare !== undefined, {
    message: "Informe ao menos uma permissão",
  });

export const removeCampaignMemberSchema = z.object({
  userId: z.string().uuid("Usuário inválido"),
});

export type ShareInput = z.infer<typeof shareInputSchema>;
export type CreateDmInput = z.infer<typeof createDmSchema>;
export type UpdateMemberPermissionsInput = z.infer<typeof updateMemberPermissionsSchema>;
export type RemoveCampaignMemberInput = z.infer<typeof removeCampaignMemberSchema>;
```

E alterar `createChatMessageSchema`:

```ts
export const createChatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "A mensagem não pode ficar vazia")
    .max(5000, "A mensagem pode ter no máximo 5000 caracteres"),
  type: z.enum(["text", "poll", "system", "share"]).default("text"),
  poll: createPollInputSchema.optional(),
  share: shareInputSchema.optional(),
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/validators/__tests__/chat.test.ts`
Expected: PASS (todos, incluindo os anteriores).

---

### Task 3: Tipos de share + DM no serviço + listUserChatGroups + rota POST /api/chat/dm

**Files:**
- Modify: `src/lib/server/chat-service.ts`
- Create: `src/app/api/chat/dm/route.ts`
- Test: `src/app/api/chat/__tests__/chat-dm.test.ts` (novo)
- Test: `src/app/api/chat/__tests__/chat-routes.test.ts` (atualizar fixtures)

**Interfaces:**
- Consome: schema da Task 1, `createDmSchema`/`ShareInput` da Task 2.
- Produz (usado pelas Tasks 4-11):
  - Tipos exportados em `chat-service.ts`:
    ```ts
    export type ShareKind = "library_item" | "profile" | "post" | "campaign";
    export type LibraryItemSnapshot = { contentType: string; contentId: string; name: string; description: string | null; imageUrl: string | null };
    export type ProfileSnapshot = { userId: string; displayName: string; avatarUrl: string | null; bio: string | null };
    export type PostSnapshot = { postId: string; title: string; description: string | null; contentType: string; tags: string[]; authorId: string; authorName: string; payload: Record<string, unknown> };
    export type CampaignSnapshot = { campaignId: string; name: string; coverImageUrl: string | null; inviteToken: string; masterName: string };
    export type SharePayload =
      | { kind: "library_item"; snapshot: LibraryItemSnapshot }
      | { kind: "profile"; snapshot: ProfileSnapshot }
      | { kind: "post"; snapshot: PostSnapshot }
      | { kind: "campaign"; snapshot: CampaignSnapshot };
    export type MemberPermissions = { canRead: boolean; canWrite: boolean; canShare: boolean };
    ```
  - `ChatGroupSummary` estendido: `campaignId: string | null`, `type: "campaign" | "dm"`, `permissions: MemberPermissions`.
  - `ChatMessageDetail`: `type: "text" | "poll" | "system" | "share"`, `payload?: SharePayload | null`.
  - `getOrCreateDmGroup(userId: string, otherUserId: string): Promise<ChatGroupSummary>` — erros: `"Usuário não encontrado"`, `"Não é possível iniciar um chat consigo mesmo"`.
  - Rota `POST /api/chat/dm` → `{ success: true, data: ChatGroupSummary }`.

- [ ] **Step 1: Estender tipos em `chat-service.ts`**

Adicionar os tipos `ShareKind`, snapshots, `SharePayload`, `MemberPermissions` (código acima) após `ChatGroupSummary`, e alterar:

```ts
export type ChatGroupSummary = {
  id: string;
  campaignId: string | null;
  type: "campaign" | "dm";
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  permissions: MemberPermissions;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    type: "text" | "poll" | "system" | "share";
    createdAt: string;
    senderName: string;
  } | null;
  membersCount: number;
  updatedAt: string;
};
```

Em `ChatMessageDetail`: `type: "text" | "poll" | "system" | "share";` e `payload?: SharePayload | null;`.

- [ ] **Step 2: Atualizar `listUserChatGroups`**

No select de memberships, acrescentar campos:

```ts
        canRead: campaignChatMembers.canRead,
        canWrite: campaignChatMembers.canWrite,
        canShare: campaignChatMembers.canShare,
        groupType: campaignChatGroups.type,
        userAId: campaignChatGroups.userAId,
        userBId: campaignChatGroups.userBId,
```

No `summaries.push`, para grupos `dm` derivar nome/avatar do outro participante:

```ts
    let name = m.groupName;
    let avatarUrl = m.groupAvatar;
    let role = m.role as "admin" | "member";

    if (m.groupType === "dm") {
      const otherId = m.userAId === userId ? m.userBId : m.userAId;
      if (otherId) {
        const [other] = await db
          .select({ displayName: users.displayName, masterAvatar: users.masterAvatar })
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);
        name = other?.displayName || "Usuário";
        avatarUrl = other?.masterAvatar || null;
      }
      role = "member";
    }

    summaries.push({
      id: m.groupId,
      campaignId: m.campaignId,
      type: m.groupType === "dm" ? "dm" : "campaign",
      name,
      avatarUrl,
      role,
      permissions: { canRead: m.canRead, canWrite: m.canWrite, canShare: m.canShare },
      unreadCount: Number(unreadRow?.count ?? 0),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            type: lastMsg.type as "text" | "poll" | "system" | "share",
            createdAt: lastMsg.createdAt.toISOString(),
            senderName: lastMsg.senderName || "Participante",
          }
        : null,
      membersCount: Number(membersCountRow?.count ?? 0),
      updatedAt: (lastMsg?.createdAt || m.groupUpdatedAt).toISOString(),
    });
```

- [ ] **Step 3: Implementar `getOrCreateDmGroup`**

Adicionar ao `chat-service.ts` (importar `asc` se necessário; `generateUrlSafeToken` não é usado aqui):

```ts
/**
 * Busca ou cria o grupo de DM 1:1 entre dois usuários.
 */
export async function getOrCreateDmGroup(
  userId: string,
  otherUserId: string,
): Promise<ChatGroupSummary> {
  if (userId === otherUserId) {
    throw new Error("Não é possível iniciar um chat consigo mesmo");
  }

  const [other] = await db
    .select({ id: users.id, displayName: users.displayName, masterAvatar: users.masterAvatar })
    .from(users)
    .where(eq(users.id, otherUserId))
    .limit(1);

  if (!other) {
    throw new Error("Usuário não encontrado");
  }

  const [a, b] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  let [group] = await db
    .select()
    .from(campaignChatGroups)
    .where(
      and(eq(campaignChatGroups.userAId, a), eq(campaignChatGroups.userBId, b)),
    )
    .limit(1);

  if (!group) {
    const [created] = await db
      .insert(campaignChatGroups)
      .values({
        campaignId: null,
        type: "dm",
        name: other.displayName || "Chat privado",
        avatarUrl: other.masterAvatar || null,
        userAId: a,
        userBId: b,
      })
      .returning();
    group = created;

    await db.insert(campaignChatMembers).values([
      { groupId: group.id, userId, role: "member" },
      { groupId: group.id, userId: otherUserId, role: "member" },
    ]);
  }

  const all = await listUserChatGroups(userId);
  const found = all.find((g) => g.id === group.id);
  if (!found) {
    throw new Error("Não foi possível carregar a conversa");
  }
  return found;
}
```

- [ ] **Step 4: Criar a rota `src/app/api/chat/dm/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getOrCreateDmGroup } from "@/lib/server/chat-service";
import { createDmSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createDmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const group = await getOrCreateDmGroup(session.user.id, parsed.data.userId);
    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Usuário não encontrado") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message === "Não é possível iniciar um chat consigo mesmo") {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logger.error({ err: error }, "Erro ao criar/obter DM");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Atualizar fixtures em `chat-routes.test.ts`**

No mock de `listUserChatGroups` do teste "retorna lista de grupos com sucesso", adicionar ao objeto: `type: "campaign"`, `permissions: { canRead: true, canWrite: true, canShare: true }` e trocar `campaignId: "c-1"` (mantém, agora o tipo aceita null).

- [ ] **Step 6: Escrever testes da rota DM `src/app/api/chat/__tests__/chat-dm.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postDm } from "../dm/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/chat-service", () => ({ getOrCreateDmGroup: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const { getOrCreateDmGroup } = await import("@/lib/server/chat-service");

const mockGroup = {
  id: "dm-1",
  campaignId: null,
  type: "dm",
  name: "Maria",
  avatarUrl: null,
  role: "member",
  permissions: { canRead: true, canWrite: true, canShare: true },
  unreadCount: 0,
  lastMessage: null,
  membersCount: 2,
  updatedAt: new Date().toISOString(),
};

describe("POST /api/chat/dm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(401);
  });

  it("retorna 400 para body inválido", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "x" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(400);
  });

  it("cria/retorna o grupo DM", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getOrCreateDmGroup).mockResolvedValue(mockGroup as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.type).toBe("dm");
  });

  it("retorna 404 quando usuário não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getOrCreateDmGroup).mockRejectedValue(new Error("Usuário não encontrado"));
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 7: Rodar testes + tsc**

Run: `npx vitest run src/app/api/chat/__tests__ src/lib/validators/__tests__/chat.test.ts && npx tsc --noEmit`
Expected: PASS. Se `tsc` acusar usos antigos de `ChatGroupSummary` em componentes (`CampaignChat.test.tsx`, `CampaignChat.test`, fixtures sem `type`/`permissions`), atualizar as fixtures nos arquivos de teste de componentes (`src/components/chat/__tests__/*.tsx`) adicionando `type: "campaign"` e `permissions: { canRead: true, canWrite: true, canShare: true }` nos mocks de grupos.

---

### Task 4: Permissões + gestão de membros no serviço e rotas

**Files:**
- Modify: `src/lib/server/chat-service.ts`
- Create: `src/app/api/chat/groups/[groupId]/members/route.ts` (GET)
- Create: `src/app/api/chat/groups/[groupId]/members/[userId]/route.ts` (PATCH, DELETE)
- Create: `src/app/api/campaigns/[id]/remove-member/route.ts` (POST)
- Test: `src/app/api/chat/__tests__/chat-members.test.ts` (novo)

**Interfaces:**
- Consome: tipos da Task 3; `updateMemberPermissionsSchema`/`removeCampaignMemberSchema` da Task 2.
- Produz (usado pelas Tasks 6, 10):
  - `export type GroupMemberDetail = { userId: string; displayName: string; avatarUrl: string | null; role: "admin" | "member"; canRead: boolean; canWrite: boolean; canShare: boolean; joinedAt: string };`
  - `listGroupMembers(groupId: string, userId: string): Promise<GroupMemberDetail[]>` — erro `"Você não é membro deste grupo"`.
  - `updateMemberPermissions(groupId, actorId, userId, input: UpdateMemberPermissionsInput): Promise<GroupMemberDetail>` — erros `"Apenas o Mestre pode alterar permissões"`, `"Membro não encontrado"`, `"Não é possível alterar permissões de um administrador"`.
  - `removeGroupMember(groupId, actorId, userId): Promise<void>` — erros `"Apenas o Mestre pode remover membros"`, `"Membro não encontrado"`, `"Não é possível remover um administrador"`.
  - `removeUserFromCampaign(campaignId, masterId, userId): Promise<void>` — erros `"Campanha não encontrada"`, `"Apenas o Mestre pode remover usuários da campanha"`.
  - `getGroupMessages` passa a lançar `"Você não tem permissão para ler este grupo"` quando `canRead === false`.
  - `postChatMessage` passa a lançar `"Você não tem permissão para escrever neste grupo"` quando `canWrite === false`.

- [ ] **Step 1: Enforcement de leitura/escrita**

Em `getGroupMessages`, após o check de membership:

```ts
  if (!membership.canRead) {
    throw new Error("Você não tem permissão para ler este grupo");
  }
```

Em `postChatMessage`, o select de membership deve incluir `canWrite` e `canShare` (adicionar `canWrite: campaignChatMembers.canWrite, canShare: campaignChatMembers.canShare` ao objeto do select) e, após o check de existência:

```ts
  if (!membership.canWrite) {
    throw new Error("Você não tem permissão para escrever neste grupo");
  }
```

Ainda em `postChatMessage`, proteger a busca de campanha contra DMs (`campaignId` null):

```ts
  const campaign = membership.campaignId
    ? (
        await db
          .select({ masterId: campaigns.masterId })
          .from(campaigns)
          .where(eq(campaigns.id, membership.campaignId))
          .limit(1)
      )[0]
    : undefined;

  const isMaster = membership.role === "admin" && campaign?.masterId === userId;
```

Em `getGroupMessages`, o join com `campaigns` continua correto para DMs (innerJoin sem match → `masterId` undefined → `isMaster: false`).

- [ ] **Step 2: Implementar as quatro funções de membros**

Adicionar ao `chat-service.ts`:

```ts
export type GroupMemberDetail = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  canRead: boolean;
  canWrite: boolean;
  canShare: boolean;
  joinedAt: string;
};

/**
 * Lista os membros de um grupo (requer membership).
 */
export async function listGroupMembers(
  groupId: string,
  userId: string,
): Promise<GroupMemberDetail[]> {
  const [membership] = await db
    .select({ id: campaignChatMembers.id })
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new Error("Você não é membro deste grupo");
  }

  const rows = await db
    .select({
      userId: campaignChatMembers.userId,
      role: campaignChatMembers.role,
      canRead: campaignChatMembers.canRead,
      canWrite: campaignChatMembers.canWrite,
      canShare: campaignChatMembers.canShare,
      joinedAt: campaignChatMembers.joinedAt,
      displayName: users.displayName,
      masterAvatar: users.masterAvatar,
    })
    .from(campaignChatMembers)
    .innerJoin(users, eq(campaignChatMembers.userId, users.id))
    .where(eq(campaignChatMembers.groupId, groupId));

  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.displayName || "Participante",
    avatarUrl: r.masterAvatar,
    role: r.role as "admin" | "member",
    canRead: r.canRead,
    canWrite: r.canWrite,
    canShare: r.canShare,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

async function requireAdmin(groupId: string, actorId: string) {
  const [actor] = await db
    .select({ role: campaignChatMembers.role })
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, actorId)))
    .limit(1);

  if (!actor) {
    throw new Error("Você não é membro deste grupo");
  }
  if (actor.role !== "admin") {
    return null;
  }
  return actor;
}

/**
 * Atualiza permissões de um membro (somente admin).
 */
export async function updateMemberPermissions(
  groupId: string,
  actorId: string,
  userId: string,
  input: UpdateMemberPermissionsInput,
): Promise<GroupMemberDetail> {
  const actor = await requireAdmin(groupId, actorId);
  if (!actor) {
    throw new Error("Apenas o Mestre pode alterar permissões");
  }

  const [target] = await db
    .select()
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!target) {
    throw new Error("Membro não encontrado");
  }
  if (target.role === "admin") {
    throw new Error("Não é possível alterar permissões de um administrador");
  }

  await db
    .update(campaignChatMembers)
    .set({
      ...(input.canRead !== undefined ? { canRead: input.canRead } : {}),
      ...(input.canWrite !== undefined ? { canWrite: input.canWrite } : {}),
      ...(input.canShare !== undefined ? { canShare: input.canShare } : {}),
    })
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)));

  const all = await listGroupMembers(groupId, actorId);
  const detail = all.find((m) => m.userId === userId);
  if (!detail) {
    throw new Error("Membro não encontrado");
  }
  return detail;
}

/**
 * Remove um membro do grupo (somente admin; não remove admins).
 */
export async function removeGroupMember(
  groupId: string,
  actorId: string,
  userId: string,
): Promise<void> {
  const actor = await requireAdmin(groupId, actorId);
  if (!actor) {
    throw new Error("Apenas o Mestre pode remover membros");
  }

  const [target] = await db
    .select()
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!target) {
    throw new Error("Membro não encontrado");
  }
  if (target.role === "admin") {
    throw new Error("Não é possível remover um administrador");
  }

  await db
    .delete(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)));
}

/**
 * Remove um usuário da campanha: revoga convite, desvincula personagens
 * e remove do grupo de chat. (Somente o mestre da campanha.)
 */
export async function removeUserFromCampaign(
  campaignId: string,
  masterId: string,
  userId: string,
): Promise<void> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (campaign.masterId !== masterId) {
    throw new Error("Apenas o Mestre pode remover usuários da campanha");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(campaignInvites)
      .set({ revoked: true })
      .where(
        and(eq(campaignInvites.campaignId, campaignId), eq(campaignInvites.userId, userId)),
      );

    const userCharacterIds = tx
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.ownerId, userId));

    await tx
      .delete(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.campaignId, campaignId),
          inArray(characterCampaigns.characterId, userCharacterIds),
        ),
      );

    const [group] = await tx
      .select({ id: campaignChatGroups.id })
      .from(campaignChatGroups)
      .where(eq(campaignChatGroups.campaignId, campaignId))
      .limit(1);

    if (group) {
      await tx
        .delete(campaignChatMembers)
        .where(
          and(eq(campaignChatMembers.groupId, group.id), eq(campaignChatMembers.userId, userId)),
        );
    }
  });
}
```

Adicionar `UpdateMemberPermissionsInput` ao import de `@/lib/validators/chat`.

- [ ] **Step 3: Criar rota GET members — `src/app/api/chat/groups/[groupId]/members/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listGroupMembers } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId } = await params;
    const members = await listGroupMembers(groupId, session.user.id);
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao listar membros do grupo");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Criar rota PATCH/DELETE — `src/app/api/chat/groups/[groupId]/members/[userId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { updateMemberPermissions, removeGroupMember } from "@/lib/server/chat-service";
import { updateMemberPermissionsSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId, userId } = await params;
    const body = await request.json();
    const parsed = updateMemberPermissionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const member = await updateMemberPermissions(groupId, session.user.id, userId, parsed.data);
    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Apenas o Mestre") || message.includes("administrador")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Membro não encontrado" || message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao atualizar permissões do membro");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId, userId } = await params;
    await removeGroupMember(groupId, session.user.id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Apenas o Mestre") || message.includes("administrador")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Membro não encontrado" || message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao remover membro do grupo");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Criar rota remove-member — `src/app/api/campaigns/[id]/remove-member/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { removeUserFromCampaign } from "@/lib/server/chat-service";
import { removeCampaignMemberSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = removeCampaignMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    await removeUserFromCampaign(id, session.user.id, parsed.data.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Apenas o Mestre pode remover usuários da campanha") {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Campanha não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao remover usuário da campanha");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Testes `src/app/api/chat/__tests__/chat-members.test.ts`**

Mesmo padrão de mocks dos outros testes de rota (`requireAuth`, `chat-service`, `logger`). Cobrir:
- GET members: 200 com lista; 403 quando serviço lança "Você não é membro deste grupo".
- PATCH: 200 retornando membro; 400 body vazio; 403 quando serviço lança "Apenas o Mestre pode alterar permissões".
- DELETE: 200; 403 para "Não é possível remover um administrador"; 404 para "Membro não encontrado".
- POST remove-member: 200; 400 body inválido; 403 "Apenas o Mestre..."; verificar que `removeUserFromCampaign` foi chamado com `(campaignId, sessionUserId, bodyUserId)`.

Exemplo (PATCH 403):

```ts
it("retorna 403 quando não é admin", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
  vi.mocked(updateMemberPermissions).mockRejectedValue(
    new Error("Apenas o Mestre pode alterar permissões"),
  );
  const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canWrite: false }),
  });
  const res = await patchMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
  expect(res.status).toBe(403);
});
```

- [ ] **Step 7: Rodar testes + tsc**

Run: `npx vitest run src/app/api/chat/__tests__ && npx tsc --noEmit`
Expected: PASS.

---

### Task 5: Compartilhamento — payload no servidor, catálogo e busca de usuários

**Files:**
- Modify: `src/lib/server/chat-service.ts`
- Modify: `src/app/api/chat/groups/[groupId]/messages/route.ts` (mapear novos erros)
- Create: `src/app/api/chat/share-catalog/route.ts` (GET)
- Create: `src/app/api/chat/users/route.ts` (GET)
- Test: `src/app/api/chat/__tests__/chat-share.test.ts` (novo)

**Interfaces:**
- Consome: `ShareInput`/`SharePayload` (Tasks 2-3); `CONTENT_TYPES`/`CONTENT_LABELS` de `@/lib/validators/content`; `getContentTable`/`getContentCampaignColumn`/`getContentIdColumn` de `@/lib/db/content-registry`; `generateUrlSafeToken` de `@/lib/utils/tokens`; tabelas `communityPosts`, `campaignInvites`, `campaigns`, `users`.
- Produz (usado pelas Tasks 7-9):
  - `buildSharePayload(input: ShareInput, actorId: string): Promise<SharePayload>` — erros: `"Conteúdo não encontrado para compartilhar"`, `"Publicação não encontrada"`, `"Usuário não encontrado"`, `"Apenas o Mestre pode compartilhar acesso à campanha"`.
  - `getShareCatalog(userId: string): Promise<ShareCatalog>` com
    ```ts
    export type ShareCatalog = {
      library: { type: string; label: string; items: { id: string; name: string; description: string | null; imageUrl: string | null }[] }[];
      posts: { id: string; title: string; contentType: string; authorName: string }[];
      campaigns: { id: string; name: string; coverImageUrl: string | null }[];
    };
    ```
  - `searchChatUsers(query: string, currentUserId: string, groupId?: string): Promise<ChatUserResult[]>` com
    ```ts
    export type ChatUserResult = { userId: string; displayName: string; avatarUrl: string | null; isGroupMember: boolean };
    ```
  - `postChatMessage` aceita `type: "share"` + `input.share`, grava `payload` e retorna `payload` em `ChatMessageDetail`.

- [ ] **Step 1: `buildSharePayload` no serviço**

```ts
import { CONTENT_TYPES, CONTENT_LABELS } from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
  getContentIdColumn,
} from "@/lib/db/content-registry";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { communityPosts } from "@/lib/db/schema"; // acrescentar ao import existente
import { ilike, isNull, or } from "drizzle-orm"; // acrescentar ao import existente
import type { ShareInput, SharePayload, UpdateMemberPermissionsInput } from "@/lib/validators/chat";

/**
 * Monta o snapshot congelado de um compartilhamento (sempre no servidor).
 */
export async function buildSharePayload(input: ShareInput, actorId: string): Promise<SharePayload> {
  if (input.kind === "library_item") {
    const contentType = input.contentType!;
    const table = getContentTable(contentType);
    const rows = await db
      .select()
      .from(table)
      .where(and(eq(getContentIdColumn(contentType), input.id), isNull(getContentCampaignColumn(contentType))))
      .limit(1);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Conteúdo não encontrado para compartilhar");
    }
    return {
      kind: "library_item",
      snapshot: {
        contentType,
        contentId: input.id,
        name: String(row.name ?? `Conteúdo de ${CONTENT_LABELS[contentType]}`),
        description: typeof row.description === "string" ? row.description : null,
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : typeof row.image === "string"
              ? row.image
              : null,
      },
    };
  }

  if (input.kind === "profile") {
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        masterAvatar: users.masterAvatar,
        masterBio: users.masterBio,
      })
      .from(users)
      .where(eq(users.id, input.id))
      .limit(1);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }
    return {
      kind: "profile",
      snapshot: {
        userId: user.id,
        displayName: user.displayName || "Usuário",
        avatarUrl: user.masterAvatar,
        bio: user.masterBio,
      },
    };
  }

  if (input.kind === "post") {
    const [post] = await db
      .select({
        post: communityPosts,
        authorName: users.displayName,
        authorId: users.id,
      })
      .from(communityPosts)
      .innerJoin(users, eq(users.id, communityPosts.authorId))
      .where(eq(communityPosts.id, input.id))
      .limit(1);
    if (!post) {
      throw new Error("Publicação não encontrada");
    }
    return {
      kind: "post",
      snapshot: {
        postId: post.post.id,
        title: post.post.title,
        description: post.post.description,
        contentType: post.post.contentType,
        tags: Array.isArray(post.post.tags) ? (post.post.tags as string[]) : [],
        authorId: post.authorId,
        authorName: post.authorName || "Mestre",
        payload: (post.post.payload ?? {}) as Record<string, unknown>,
      },
    };
  }

  // kind === "campaign"
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, input.id))
    .limit(1);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (campaign.masterId !== actorId) {
    throw new Error("Apenas o Mestre pode compartilhar acesso à campanha");
  }

  const [master] = await db
    .select({ masterName: users.masterName, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, campaign.masterId))
    .limit(1);

  const [invite] = await db
    .insert(campaignInvites)
    .values({
      campaignId: campaign.id,
      token: generateUrlSafeToken(32),
      revoked: false,
    })
    .returning();

  return {
    kind: "campaign",
    snapshot: {
      campaignId: campaign.id,
      name: campaign.name,
      coverImageUrl: campaign.coverImageUrl,
      inviteToken: invite.token,
      masterName: master?.masterName || master?.displayName || "Mestre",
    },
  };
}
```

- [ ] **Step 2: share em `postChatMessage`**

Após o check de `canWrite` (Task 4) e antes do check de enquete:

```ts
  const isShare = input.type === "share" || Boolean(input.share);
  if (isShare && !membership.canShare) {
    throw new Error("Você não tem permissão para compartilhar neste grupo");
  }
```

Antes do insert da mensagem:

```ts
  let sharePayload: SharePayload | null = null;
  if (isShare && input.share) {
    sharePayload = await buildSharePayload(input.share, userId);
  }
```

No `values` do insert: `type: isPoll ? "poll" : isShare ? "share" : input.type || "text",` e `payload: sharePayload,`. No retorno: `type: createdMessage.type as "text" | "poll" | "system" | "share",` e `payload: sharePayload,`.

- [ ] **Step 3: `getShareCatalog` e `searchChatUsers`**

```ts
/**
 * Catálogo para o modal de compartilhamento.
 */
export async function getShareCatalog(userId: string): Promise<ShareCatalog> {
  const library: ShareCatalog["library"] = [];
  for (const type of CONTENT_TYPES) {
    const table = getContentTable(type);
    const rows = await db
      .select()
      .from(table)
      .where(isNull(getContentCampaignColumn(type)));
    library.push({
      type,
      label: CONTENT_LABELS[type],
      items: rows.map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          id: String(row.id),
          name: String(row.name ?? "Sem nome"),
          description: typeof row.description === "string" ? row.description : null,
          imageUrl:
            typeof row.imageUrl === "string"
              ? row.imageUrl
              : typeof row.image === "string"
                ? row.image
                : null,
        };
      }),
    });
  }

  const postRows = await db
    .select({
      id: communityPosts.id,
      title: communityPosts.title,
      contentType: communityPosts.contentType,
      authorName: users.displayName,
    })
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .orderBy(desc(communityPosts.createdAt))
    .limit(20);

  const campaignRows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      coverImageUrl: campaigns.coverImageUrl,
    })
    .from(campaigns)
    .where(eq(campaigns.masterId, userId))
    .orderBy(desc(campaigns.createdAt));

  return {
    library,
    posts: postRows.map((p) => ({ ...p, authorName: p.authorName || "Mestre" })),
    campaigns: campaignRows,
  };
}

/**
 * Busca usuários para o autocomplete de @ (membros do grupo primeiro).
 */
export async function searchChatUsers(
  query: string,
  currentUserId: string,
  groupId?: string,
): Promise<ChatUserResult[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      masterAvatar: users.masterAvatar,
    })
    .from(users)
    .where(and(ilike(users.displayName, `%${query}%`), sql`${users.id} != ${currentUserId}`))
    .limit(10);

  let memberIds = new Set<string>();
  if (groupId) {
    const members = await db
      .select({ userId: campaignChatMembers.userId })
      .from(campaignChatMembers)
      .where(eq(campaignChatMembers.groupId, groupId));
    memberIds = new Set(members.map((m) => m.userId));
  }

  return rows
    .map((r) => ({
      userId: r.id,
      displayName: r.displayName || "Usuário",
      avatarUrl: r.masterAvatar,
      isGroupMember: memberIds.has(r.id),
    }))
    .sort((a, b) => Number(b.isGroupMember) - Number(a.isGroupMember));
}
```

Nota: se `users.displayName` for coluna nullable que impeça `ilike`, usar `ilike(sql`COALESCE(${users.displayName}, '')`, ...)`. Verificar o tipo no schema antes.

- [ ] **Step 4: Rotas share-catalog e users**

`src/app/api/chat/share-catalog/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getShareCatalog } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const catalog = await getShareCatalog(session.user.id);
    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    logger.error({ err: error }, "Erro ao montar catálogo de compartilhamento");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

`src/app/api/chat/users/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { searchChatUsers } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const groupId = request.nextUrl.searchParams.get("groupId") ?? undefined;
    if (q.length < 2) {
      return NextResponse.json(
        { success: false, error: "A busca exige ao menos 2 caracteres" },
        { status: 400 },
      );
    }
    const users = await searchChatUsers(q, session.user.id, groupId);
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    logger.error({ err: error }, "Erro ao buscar usuários do chat");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Mapear erros novos na rota de mensagens**

Em `src/app/api/chat/groups/[groupId]/messages/route.ts` (POST), estender o tratamento:

- Erros com `"não tem permissão"` ou `"Apenas o Mestre"` → 403.
- `"Conteúdo não encontrado para compartilhar"`, `"Publicação não encontrada"`, `"Usuário não encontrado"`, `"Campanha não encontrada"` → 404.
- Manter 400 para validação Zod e o 403 existente para "não é membro".

Em GET, adicionar: mensagem `"Você não tem permissão para ler este grupo"` → 403 (já cai no ramo existente de "não é membro" se este usar `includes("não é membro")`; adicionar ramo próprio).

- [ ] **Step 6: Testes `src/app/api/chat/__tests__/chat-share.test.ts`**

Mocks: `requireAuth`, `chat-service` (`getShareCatalog`, `searchChatUsers`, `postChatMessage`), `logger`. Cobrir:
- GET share-catalog: 200 `{ success: true, data }`; 401 sem sessão.
- GET users: 400 com `q` de 1 char; 200 com `q=mar` chamando `searchChatUsers("mar", "user-1", undefined)`; 401.
- POST messages com `type: "share"`: serviço resolve mensagem com `payload`; resposta 201 e `json.data.payload.kind` correto; serviço lançando `"Você não tem permissão para compartilhar neste grupo"` → 403.

- [ ] **Step 7: Rodar testes + tsc**

Run: `npx vitest run src/app/api/chat/__tests__ && npx tsc --noEmit`
Expected: PASS.

---

### Task 6: Eventos Socket.IO de membros

**Files:**
- Modify: `server.js` (bloco de eventos `chat:*`, ~linha 360-384)
- Modify: `src/context/SocketContext.tsx` (interface ~linha 218-226, implementações ~linha 997-1100, value ~linha 1155-1162)
- Test: não há teste unitário de server.js no projeto — validação manual no Step 4.

**Interfaces:**
- Produz (usado pelas Tasks 10):
  - Cliente emite `chat:member-updated` → sala recebe `chat:member-updated` com `{ groupId, userId, canRead, canWrite, canShare }`.
  - Cliente emite `chat:member-removed` → sala recebe `chat:member-removed` com `{ groupId, userId, reason: "group" | "campaign" }`.
  - SocketContext: `sendChatMemberUpdated(payload: Record<string, unknown>)`, `sendChatMemberRemoved(payload: Record<string, unknown>)`, `subscribeChatMemberUpdated(cb)`, `subscribeChatMemberRemoved(cb)`.

- [ ] **Step 1: server.js**

Após o handler `chat:poll-close`, adicionar:

```js
        socket.on("chat:member-updated", (payload) => {
          if (!payload || !payload.groupId) return;
          io.to(`chat:${payload.groupId}`).emit("chat:member-updated", payload);
        });

        socket.on("chat:member-removed", (payload) => {
          if (!payload || !payload.groupId) return;
          io.to(`chat:${payload.groupId}`).emit("chat:member-removed", payload);
        });
```

- [ ] **Step 2: SocketContext**

Na interface, após `subscribeChatPollClosed`:

```ts
  sendChatMemberUpdated: (payload: Record<string, unknown>) => void;
  sendChatMemberRemoved: (payload: Record<string, unknown>) => void;
  subscribeChatMemberUpdated: (callback: (payload: Record<string, unknown>) => void) => () => void;
  subscribeChatMemberRemoved: (callback: (payload: Record<string, unknown>) => void) => () => void;
```

Implementações seguindo EXATAMENTE o padrão de `sendChatPollVote`/`subscribeChatPollClosed` (useCallback com `getSocket()`, emit com evento correspondente; subscribe registrando `on` e retornando função que faz `off`). Adicionar as 4 ao objeto `value` do Provider.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit` — Expected: limpo.

- [ ] **Step 4: Verificação manual**

Com o dev server rodando, abrir o console do navegador em duas abas logadas e validar o round-trip pelo SocketContext (opcional nesta etapa — a validação real acontece na Task 10).

---

### Task 7: `SharedContentCard` + `ShareDetailModal` + renderização no `ActiveChatRoom`

**Files:**
- Create: `src/components/chat/SharedContentCard.tsx`
- Create: `src/components/chat/ShareDetailModal.tsx`
- Modify: `src/components/chat/ActiveChatRoom.tsx`
- Test: `src/components/chat/__tests__/SharedContentCard.test.tsx` (novo)

**Interfaces:**
- Consome: `SharePayload` e snapshots (Task 3); `PostDetailModal` de `@/components/community/PostDetailModal` (prop `post: CommunityPost`, `onClose`, `onCloned?`); `Modal` de `@/components/ui/Modal` (verificar assinatura exata antes — usada em `CreatePollModal.tsx`); `CONTENT_LABELS` de `@/lib/validators/content`.
- Produz (usado pelas Tasks 8-9):
  - `SharedContentCard({ payload, onClick }: { payload: SharePayload; onClick: () => void })` — `data-testid={`shared-card-${payload.kind}`}`.
  - `ShareDetailModal({ payload, currentUserId, onClose, onStartDm }: { payload: SharePayload; currentUserId: string; onClose: () => void; onStartDm?: (userId: string) => void })`.
  - `ActiveChatRoom` ganha props: `onSendShare(share: ShareInput, text?: string): Promise<void>`, `onStartDm?(userId: string): Promise<void>`, `onOpenSettings(): void`, `onShareFromMention?...` (ver Task 9 — usar apenas `onSendShare`).

- [ ] **Step 1: Teste do card (falha primeiro)**

`src/components/chat/__tests__/SharedContentCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharedContentCard } from "../SharedContentCard";
import type { SharePayload } from "@/lib/server/chat-service";

const profilePayload: SharePayload = {
  kind: "profile",
  snapshot: { userId: "u-2", displayName: "Maria", avatarUrl: null, bio: "Mestra de D&D" },
};

const campaignPayload: SharePayload = {
  kind: "campaign",
  snapshot: {
    campaignId: "c-1",
    name: "Maldição de Strahd",
    coverImageUrl: null,
    inviteToken: "tok",
    masterName: "João",
  },
};

describe("SharedContentCard", () => {
  it("renderiza card de perfil com nome e chama onClick", () => {
    const onClick = vi.fn();
    render(<SharedContentCard payload={profilePayload} onClick={onClick} />);
    const card = screen.getByTestId("shared-card-profile");
    expect(card).toHaveTextContent("Maria");
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza card de campanha com nome e mestre", () => {
    render(<SharedContentCard payload={campaignPayload} onClick={vi.fn()} />);
    const card = screen.getByTestId("shared-card-campaign");
    expect(card).toHaveTextContent("Maldição de Strahd");
    expect(card).toHaveTextContent("João");
  });
});
```

Run: `npx vitest run src/components/chat/__tests__/SharedContentCard.test.tsx` → FAIL (componente não existe).

- [ ] **Step 2: Implementar `SharedContentCard.tsx`**

```tsx
"use client";

import React from "react";
import { ChevronRight, Package, UserRound, Globe2, Map } from "lucide-react";
import type { SharePayload } from "@/lib/server/chat-service";

const KIND_CONFIG = {
  library_item: { Icon: Package, label: "Item da biblioteca" },
  profile: { Icon: UserRound, label: "Perfil" },
  post: { Icon: Globe2, label: "Publicação" },
  campaign: { Icon: Map, label: "Campanha" },
} as const;

function describePayload(payload: SharePayload): { title: string; subtitle: string; imageUrl: string | null } {
  switch (payload.kind) {
    case "library_item":
      return {
        title: payload.snapshot.name,
        subtitle: payload.snapshot.description
          ? payload.snapshot.description.slice(0, 80)
          : "Biblioteca geral",
        imageUrl: payload.snapshot.imageUrl,
      };
    case "profile":
      return {
        title: payload.snapshot.displayName,
        subtitle: payload.snapshot.bio ? payload.snapshot.bio.slice(0, 80) : "Perfil de usuário",
        imageUrl: payload.snapshot.avatarUrl,
      };
    case "post":
      return {
        title: payload.snapshot.title,
        subtitle: `Por ${payload.snapshot.authorName}`,
        imageUrl: null,
      };
    case "campaign":
      return {
        title: payload.snapshot.name,
        subtitle: `Mestre: ${payload.snapshot.masterName}`,
        imageUrl: payload.snapshot.coverImageUrl,
      };
  }
}

export function SharedContentCard({
  payload,
  onClick,
}: {
  payload: SharePayload;
  onClick: () => void;
}) {
  const { Icon, label } = KIND_CONFIG[payload.kind];
  const { title, subtitle, imageUrl } = describePayload(payload);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`shared-card-${payload.kind}`}
      className="flex w-full max-w-[320px] items-center gap-3 rounded-lg border border-secondary-border bg-secondary-input/60 p-2.5 text-left transition-colors hover:border-accent cursor-pointer"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-dominant-deep border border-secondary-border">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wide text-secondary-muted">{label}</p>
        <p className="truncate text-xs font-bold text-secondary-pure">{title}</p>
        <p className="truncate text-[10px] text-secondary-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-secondary-muted" />
    </button>
  );
}
```

Run teste → PASS.

- [ ] **Step 3: Implementar `ShareDetailModal.tsx`**

Modal único que troca o conteúdo por `payload.kind`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import type { SharePayload } from "@/lib/server/chat-service";
import PostDetailModal from "@/components/community/PostDetailModal";
import type { CommunityPost } from "@/components/community/CommunityCard";
import { CONTENT_LABELS } from "@/lib/validators/content";
import type { ContentType } from "@/lib/validators/content";

type ShareDetailModalProps = {
  payload: SharePayload;
  currentUserId: string;
  onClose: () => void;
  onStartDm?: (userId: string) => void;
};

export function ShareDetailModal({ payload, currentUserId, onClose, onStartDm }: ShareDetailModalProps) {
  if (payload.kind === "post") {
    const s = payload.snapshot;
    const post = {
      id: s.postId,
      authorId: s.authorId,
      title: s.title,
      description: s.description,
      contentType: s.contentType,
      tags: s.tags,
      payload: s.payload,
      clonesCount: 0,
      createdAt: "",
      updatedAt: "",
      author: { id: s.authorId, displayName: s.authorName },
      likesCount: 0,
      commentsCount: 0,
      isLikedByMe: false,
    } as CommunityPost;
    return <PostDetailModal post={post} onClose={onClose} />;
  }

  return <GenericShareModal payload={payload} currentUserId={currentUserId} onClose={onClose} onStartDm={onStartDm} />;
}
```

`GenericShareModal` (no mesmo arquivo) cobre os outros 3 tipos:

- **profile**: avatar grande, `displayName`, bio; se `snapshot.userId !== currentUserId && onStartDm` → botão `data-testid="start-dm-from-card"` "Iniciar chat" que chama `onStartDm(snapshot.userId)` e fecha.
- **library_item**: imagem (se houver), nome, badge com `CONTENT_LABELS[snapshot.contentType as ContentType]`, descrição.
- **campaign**: capa (se houver), nome, mestre; select de personagem carregado de `GET /api/characters` (`credentials: "include"`; usar `data.data ?? data` conforme resposta — verificar no Step 4) + botão `data-testid="join-campaign-button"` "Entrar na campanha" → `POST /api/invites/${snapshot.inviteToken}/join` body `{ characterId }` → em sucesso mostrar "Você entrou na campanha!" e fechar; em erro mostrar `data.error` inline (ex.: "Convite inválido ou revogado").
- Container do modal: fixed inset-0, backdrop `bg-black/60`, painel central `bg-secondary-card border border-secondary-border rounded-xl max-w-md w-full p-5`, botão X de fechar. Seguir o mesmo padrão visual do `Modal` usado em `CreatePollModal.tsx` (ler o componente `@/components/ui/Modal` e reutilizá-lo se a assinatura permitir `isOpen`/`onClose`/`title`).

- [ ] **Step 4: Verificar formatos**

- Ler `src/components/ui/Modal.tsx` e decidir: reutilizar `Modal` (preferível) para o container do `GenericShareModal`.
- Ler `src/app/api/characters/route.ts` (GET) e confirmar o formato da resposta (`{ data: [...] }` ou array) para o select de personagem.

- [ ] **Step 5: Renderizar share no `ActiveChatRoom`**

Em `ActiveChatRoom.tsx`:

1. Importar `SharedContentCard`, `ShareDetailModal`, `SharePayload`, `ShareInput`.
2. Props novas: `onSendShare: (share: ShareInput, text?: string) => Promise<void>;`, `onStartDm?: (userId: string) => Promise<void>;`, `onOpenSettings: () => void;`.
3. Estado: `const [selectedShare, setSelectedShare] = useState<SharePayload | null>(null);`.
4. Na renderização de mensagens, antes do ramo de texto (após `isPoll`):

```tsx
                {msg.type === "share" && msg.payload ? (
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-2.5 py-2 shadow-sm ${
                      isMe
                        ? "bg-accent/15 border border-accent/30 rounded-tr-none"
                        : "bg-secondary-card border border-secondary-border rounded-tl-none"
                    }`}
                  >
                    {msg.content && (
                      <p className="mb-1.5 px-1 text-xs leading-relaxed text-secondary-pure whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    <SharedContentCard
                      payload={msg.payload}
                      onClick={() => setSelectedShare(msg.payload!)}
                    />
                    <div className={`text-[9px] mt-1 text-right select-none text-secondary-muted`}>
                      {formatMessageTime(msg.createdAt)}
                    </div>
                  </div>
                ) : isPoll ? (
```

5. No fim do componente (após `CreatePollModal`):

```tsx
      {selectedShare && (
        <ShareDetailModal
          payload={selectedShare}
          currentUserId={currentUserId}
          onClose={() => setSelectedShare(null)}
          onStartDm={
            onStartDm
              ? async (userId) => {
                  setSelectedShare(null);
                  await onStartDm(userId);
                }
              : undefined
          }
        />
      )}
```

6. Atualizar `CampaignChat.tsx` para compilar: adicionar `handleSendShare` e `handleStartDm` e passar como props (implementação completa na Task 8; por enquanto criar as funções):

```tsx
  const handleSendShare = async (share: ShareInput, text?: string) => {
    if (!activeGroupId) return;
    const res = await fetch(`/api/chat/groups/${activeGroupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text || "Conteúdo compartilhado", type: "share", share }),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok && data.data) {
      setMessages((prev) => [...prev, data.data]);
      sendChatMessage(data.data);
    }
  };

  const handleStartDm = async (otherUserId: string) => {
    const res = await fetch("/api/chat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: otherUserId }),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok && data.data) {
      await loadGroups();
      setActiveGroupId(data.data.id);
      setIsMobileRoomOpen(true);
    }
  };
```

Passar no `<ActiveChatRoom>`: `onSendShare={handleSendShare}`, `onStartDm={handleStartDm}`, `onOpenSettings={() => {}}` (substituído na Task 10).

- [ ] **Step 6: Testes + tsc**

Atualizar `src/components/chat/__tests__/CampaignChat.test.tsx` e outros que renderizam `ActiveChatRoom`/`CampaignChat` com as props novas (mocks de `onSendShare`/`onOpenSettings`).

Run: `npx vitest run src/components/chat/__tests__ && npx tsc --noEmit`
Expected: PASS.

---

### Task 8: `SharePickerModal` + botão "+" no input

**Files:**
- Create: `src/components/chat/SharePickerModal.tsx`
- Modify: `src/components/chat/ActiveChatRoom.tsx`
- Test: `src/components/chat/__tests__/SharePickerModal.test.tsx` (novo)

**Interfaces:**
- Consome: `GET /api/chat/share-catalog` (Task 5) → `{ success, data: ShareCatalog }`; `onSendShare` (Task 7).
- Produz: `SharePickerModal({ isOpen, onClose, onPick }: { isOpen: boolean; onClose: () => void; onPick: (share: ShareInput, label: string) => void })`.

- [ ] **Step 1: Teste (falha primeiro)**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SharePickerModal } from "../SharePickerModal";

const catalog = {
  success: true,
  data: {
    library: [
      { type: "spells", label: "magia", items: [{ id: "s-1", name: "Bola de Fogo", description: null, imageUrl: null }] },
    ],
    posts: [{ id: "p-1", title: "Post épico", contentType: "spell", authorName: "Maria" }],
    campaigns: [{ id: "c-1", name: "Strahd", coverImageUrl: null }],
  },
};

describe("SharePickerModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => catalog }));
  });

  it("lista itens da biblioteca e emite pick", async () => {
    const onPick = vi.fn();
    render(<SharePickerModal isOpen onClose={vi.fn()} onPick={onPick} />);
    const item = await screen.findByText("Bola de Fogo");
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledWith(
      { kind: "library_item", id: "s-1", contentType: "spells" },
      "Bola de Fogo",
    );
  });

  it("troca para a aba de campanhas", async () => {
    render(<SharePickerModal isOpen onClose={vi.fn()} onPick={vi.fn()} />);
    await screen.findByText("Bola de Fogo");
    fireEvent.click(screen.getByTestId("share-tab-campaigns"));
    expect(await screen.findByText("Strahd")).toBeInTheDocument();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar `SharePickerModal.tsx`**

Estrutura (seguir `CreatePollModal.tsx` como modelo visual — ler o arquivo e copiar o padrão de overlay/Modal):

- Estado: `tab: "library" | "posts" | "campaigns"`, `catalog: ShareCatalog | null`, `search: string`, `loading`.
- `useEffect` em `isOpen`: `fetch("/api/chat/share-catalog", { credentials: "include" })`.
- Abas com `data-testid="share-tab-library" | "share-tab-posts" | "share-tab-campaigns"`.
- Input de busca filtrando por `name`/`title` localmente.
- Biblioteca: para cada `type` do catálogo com itens filtrados, seção com título = plural do label; cada item é um botão `data-testid={`share-item-${item.id}`}` com nome + descrição curta → `onPick({ kind: "library_item", id: item.id, contentType: type }, item.name)` e `onClose()`.
- Publicações: botão por post → `onPick({ kind: "post", id: post.id }, post.title)`.
- Campanhas: botão por campanha → `onPick({ kind: "campaign", id: campaign.id }, campaign.name)`; seção vazia mostra "Você não é mestre de nenhuma campanha".

- [ ] **Step 3: Botão "+" no `ActiveChatRoom`**

No formulário de envio, ANTES do botão de enquete:

```tsx
        {group.permissions.canShare && (
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            data-testid="open-share-modal-button"
            title="Compartilhar conteúdo"
            aria-label="Compartilhar conteúdo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-border bg-secondary-input text-secondary-muted hover:text-accent hover:border-accent transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
```

- Importar `Plus` de lucide-react; estado `isShareModalOpen`.
- Renderizar:

```tsx
      <SharePickerModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onPick={(share, label) => {
          setIsShareModalOpen(false);
          void onSendShare(share, inputText.trim() || label);
          setInputText("");
        }}
      />
```

- Desabilitar input/`+`/envio quando `!group.permissions.canWrite`: no textarea adicionar `disabled={!group.permissions.canWrite}` e placeholder alternativo "Você não tem permissão para escrever neste grupo"; ocultar o `+` também quando `!canWrite`.

- [ ] **Step 4: Atualizar fixtures de testes de componentes**

Todos os mocks de `ChatGroupSummary` em `src/components/chat/__tests__/*` precisam de `permissions: { canRead: true, canWrite: true, canShare: true }` e `type: "campaign"` (se ainda não feito na Task 3/7).

- [ ] **Step 5: Rodar testes + tsc**

Run: `npx vitest run src/components/chat/__tests__ && npx tsc --noEmit` → PASS.

---

### Task 9: Autocomplete de `@` no input

**Files:**
- Modify: `src/components/chat/ActiveChatRoom.tsx`
- Test: `src/components/chat/__tests__/ActiveChatRoom.mention.test.tsx` (novo)

**Interfaces:**
- Consome: `GET /api/chat/users?q=&groupId=` (Task 5) → `{ success, data: ChatUserResult[] }`; `onSendShare` (Task 7).
- Produz: comportamento — digitar `@` + ≥2 chars abre dropdown `data-testid="mention-dropdown"`; clicar em usuário envia `share` de perfil com o texto anterior como `content`.

- [ ] **Step 1: Teste (falha primeiro)**

Renderizar `ActiveChatRoom` com grupo mockado (permissões true), mock de `fetch`: `/api/chat/users` → `{ success: true, data: [{ userId: "u-9", displayName: "Maria Silveira", avatarUrl: null, isGroupMember: true }] }`. Simular `change` no textarea para `"Oi @mar"`; aguardar dropdown; clicar em "Maria Silveira"; esperar `onSendShare` chamado com `{ kind: "profile", id: "u-9" }` e texto `"Oi"`.

```tsx
it("envia share de perfil ao selecionar menção", async () => {
  const onSendShare = vi.fn().mockResolvedValue(undefined);
  render(<ActiveChatRoom group={mockGroup} messages={[]} currentUserId="u-1"
    onSendMessage={vi.fn()} onCreatePoll={vi.fn()} onVotePoll={vi.fn()}
    onClosePoll={vi.fn()} onSendShare={onSendShare} onOpenSettings={vi.fn()} />);
  const textarea = screen.getByTestId("chat-input-textarea");
  fireEvent.change(textarea, { target: { value: "Oi @mar" } });
  const option = await screen.findByText("Maria Silveira");
  fireEvent.click(option);
  expect(onSendShare).toHaveBeenCalledWith({ kind: "profile", id: "u-9" }, "Oi");
});
```

- [ ] **Step 2: Implementar no `ActiveChatRoom`**

- Estado: `mentionQuery: string | null`, `mentionResults: ChatUserResult[]`, `mentionIndex: number`.
- No `onChange` do textarea: regex `/(^|\s)@(\S{2,})$/` sobre o valor; se casar → `setMentionQuery(match[2])` e fetch debounced (setTimeout 300ms com cleanup) `/api/chat/users?q=${encodeURIComponent(match[2])}&groupId=${group.id}` → `setMentionResults(data.data ?? [])`. Se não casar → `setMentionQuery(null)`.
- Dropdown posicionado acima do input (`absolute bottom-full mb-2 left-0 right-0 ... bg-secondary-card border border-secondary-border rounded-lg`), itens com avatar/inicial + nome; `data-testid="mention-dropdown"`.
- Seleção (clique ou Enter com dropdown aberto — nesse caso `preventDefault`):

```ts
  const selectMention = (user: ChatUserResult) => {
    const textBefore = inputText.replace(/(^|\s)@\S+$/, "$1").trim();
    setInputText("");
    setMentionQuery(null);
    setMentionResults([]);
    void onSendShare({ kind: "profile", id: user.userId }, textBefore || undefined);
  };
```

Ajustar `onSendShare` para aceitar `text?: string` (já aceita desde a Task 7) — quando `undefined`, o `CampaignChat.handleSendShare` usa `label`; para menção sem texto usar `content = "Perfil compartilhado"`: alterar chamada para `onSendShare({ kind: "profile", id: user.userId }, textBefore || "Perfil compartilhado")`.

- Importar tipo local: `type ChatUserResult = { userId: string; displayName: string; avatarUrl: string | null; isGroupMember: boolean };` (definir no próprio arquivo para não importar de módulo de servidor).

- [ ] **Step 3: Rodar testes + tsc**

Run: `npx vitest run src/components/chat/__tests__ && npx tsc --noEmit` → PASS.

---

### Task 10: Menu hambúrguer + `ChatSettingsPanel`

**Files:**
- Create: `src/components/chat/ChatSettingsPanel.tsx`
- Modify: `src/components/chat/ActiveChatRoom.tsx`
- Modify: `src/components/chat/CampaignChat.tsx`
- Test: `src/components/chat/__tests__/ChatSettingsPanel.test.tsx` (novo)

**Interfaces:**
- Consome: `GET /api/chat/groups/:id/members`, `PATCH/DELETE .../members/:userId`, `POST /api/campaigns/:id/remove-member` (Task 4); `sendChatMemberUpdated`/`sendChatMemberRemoved` (Task 6); `GroupMemberDetail` (Task 4 — importar como type de `chat-service`).
- Produz:
  - `ChatSettingsPanel({ group, currentUserId, onClose, onPermissionsChanged, onMemberRemoved }: { group: ChatGroupSummary; currentUserId: string; onClose: () => void; onPermissionsChanged: (userId: string, perms: MemberPermissions) => void; onMemberRemoved: (userId: string, reason: "group" | "campaign") => void })`.
  - `CampaignChat` assina `subscribeChatMemberUpdated`/`subscribeChatMemberRemoved` e gerencia estado `settingsGroupId`.

- [ ] **Step 1: Teste (falha primeiro)**

Mock de fetch: GET members → `{ success: true, data: [admin {userId:"u-1",role:"admin",...}, member {userId:"u-2", displayName:"Maria", role:"member", canRead:true, canWrite:true, canShare:true, joinedAt:...}] }`; PATCH/DELETE → `{ success: true, data: {...} }` / `{ success: true }`.

Casos:
1. Renderiza lista com nomes e badge "Mestre" para admin.
2. Para `currentUserId="u-1"` (admin): toggles habilitados; clicar no toggle "Escrever" de Maria → `fetch` PATCH chamado com `{ canWrite: false }` e `onPermissionsChanged("u-2", {...})`.
3. Botão `data-testid="remove-from-group-u-2"` → confirmação (`confirm-remove-u-2`) → DELETE chamado → `onMemberRemoved("u-2", "group")`.
4. Em grupo `type: "campaign"` com `campaignId: "c-1"`: `data-testid="remove-from-campaign-u-2"` → POST `/api/campaigns/c-1/remove-member` com `{ userId: "u-2" }` → `onMemberRemoved("u-2", "campaign")`.
5. Para membro não-admin (`currentUserId="u-2"`): sem toggles interativos (desabilitados) e sem botões de remoção.

- [ ] **Step 2: Implementar `ChatSettingsPanel.tsx`**

- Modal (reusar `@/components/ui/Modal` como no `CreatePollModal`).
- Ao abrir: fetch de membros; estado `members: GroupMemberDetail[]`, `confirming: { userId: string; action: "group" | "campaign" } | null`.
- `isAdmin = group.role === "admin"`.
- Linha do membro: avatar (imagem ou inicial), nome + badge "Mestre" (admin) + "(você)" para o próprio; à direita, quando `isAdmin && member.role !== "member-admin" && member.userId !== currentUserId`:
  - Três toggles pequenos (Ler / Escrever / Compartilhar) — `<input type="checkbox">` estilizado ou botão pill com estado; onChange → PATCH com a flag → atualiza estado local + `onPermissionsChanged`.
  - Botão kebab/`MoreHorizontal` abrindo menu com "Remover do grupo" (`data-testid={`remove-from-group-${userId}`}`) e, se `group.type === "campaign" && group.campaignId`, "Remover da campanha" (`data-testid={`remove-from-campaign-${userId}`}`).
  - Confirmação inline: segundo clique (`data-testid={`confirm-remove-${userId}`}`) executa DELETE ou POST remove-member; em sucesso chama `onMemberRemoved(userId, reason)` e remove da lista local.
- Quando `!isAdmin`: exibir apenas a lista com as permissões em badges estáticos ("Somente leitura", etc.), sem ações.
- Erros de fetch/ação: mensagem inline em `text-red-400`... **usar token**: `text-error` se existir no tema; caso contrário `text-red-400` é aceitável apenas se já usado no projeto — verificar `grep -rn "text-red" src/components/chat src/components/community` e seguir o padrão encontrado.

- [ ] **Step 3: Menu hambúrguer no `ActiveChatRoom`**

No header, à direita (fora do bloco de avatar/nome):

```tsx
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            data-testid="chat-menu-button"
            aria-label="Menu do grupo"
            className="p-2 rounded-lg text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-secondary-border bg-secondary-card shadow-lg z-20">
              <button
                type="button"
                onClick={() => { setIsMenuOpen(false); onOpenSettings(); }}
                data-testid="chat-menu-settings"
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-secondary-pure hover:bg-secondary-input rounded-lg cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" /> Configurações
              </button>
            </div>
          )}
        </div>
```

Importar `Menu`, `Settings` de lucide-react; estado `isMenuOpen`.

- [ ] **Step 4: Ligar no `CampaignChat`**

- Importar `sendChatMemberUpdated`, `sendChatMemberRemoved`, `subscribeChatMemberUpdated`, `subscribeChatMemberRemoved` do `useSocket()`.
- Estado: `const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);`.
- Passar `onOpenSettings={() => setSettingsGroupId(activeGroupId)}` ao `ActiveChatRoom` (substituir o `() => {}` da Task 7).
- Renderizar o painel quando `settingsGroupId` e grupo ativo:

```tsx
      {settingsGroup && (
        <ChatSettingsPanel
          group={settingsGroup}
          currentUserId={currentUser.id}
          onClose={() => setSettingsGroupId(null)}
          onPermissionsChanged={(userId, perms) => {
            sendChatMemberUpdated({ groupId: settingsGroup.id, userId, ...perms });
            if (userId === currentUser.id) {
              setGroups((prev) =>
                prev.map((g) => (g.id === settingsGroup.id ? { ...g, permissions: perms } : g)),
              );
            }
          }}
          onMemberRemoved={(userId, reason) => {
            sendChatMemberRemoved({ groupId: settingsGroup.id, userId, reason });
            setGroups((prev) =>
              prev.map((g) =>
                g.id === settingsGroup.id ? { ...g, membersCount: Math.max(0, g.membersCount - 1) } : g,
              ),
            );
          }}
        />
      )}
```

(`const settingsGroup = groups.find((g) => g.id === settingsGroupId) ?? null;`)

- Subscrições em tempo real (novo `useEffect` ou estender o existente):

```ts
    const unsubMemberUpdated = subscribeChatMemberUpdated((raw) => {
      const payload = raw as unknown as {
        groupId: string; userId: string;
        canRead: boolean; canWrite: boolean; canShare: boolean;
      };
      if (payload.userId === currentUserRef.current.id) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === payload.groupId
              ? { ...g, permissions: { canRead: payload.canRead, canWrite: payload.canWrite, canShare: payload.canShare } }
              : g,
          ),
        );
      }
    });

    const unsubMemberRemoved = subscribeChatMemberRemoved((raw) => {
      const payload = raw as unknown as { groupId: string; userId: string; reason: "group" | "campaign" };
      if (payload.userId === currentUserRef.current.id) {
        setGroups((prev) => prev.filter((g) => g.id !== payload.groupId));
        if (activeGroupRef.current === payload.groupId) {
          setActiveGroupId(null);
          setMessages([]);
          setIsMobileRoomOpen(false);
        }
      } else {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === payload.groupId ? { ...g, membersCount: Math.max(0, g.membersCount - 1) } : g,
          ),
        );
      }
    });
```

Criar `currentUserRef` (`useRef(currentUser)` sincronizado em `useEffect`) para evitar dependência instável — mesmo padrão do `activeGroupRef` existente.

- [ ] **Step 5: Rodar testes + tsc**

Run: `npx vitest run src/components/chat/__tests__ && npx tsc --noEmit` → PASS.

---

### Task 11: `@handle` clicável no MasterProfile + navegação com parâmetros

**Files:**
- Modify: `src/components/community/MasterProfile.tsx` (~linha 239-241)
- Modify: `src/components/community/MasterCommunityView.tsx`
- Modify: `src/app/master/community/page.tsx` (Suspense)
- Modify: `src/components/chat/CampaignChat.tsx` (prop `initialGroupId`)
- Test: `src/components/community/__tests__/MasterProfile.dm.test.tsx` (novo)
- Test: `src/components/community/__tests__/MasterCommunityView.test.tsx` (estender)

**Interfaces:**
- Consome: `POST /api/chat/dm` (Task 3); `initialGroupId?: string` em `CampaignChat`.

- [ ] **Step 1: `CampaignChat` aceita `initialGroupId`**

```ts
type CampaignChatProps = {
  currentUser: { id: string; displayName: string | null; avatarUrl?: string | null };
  initialGroupId?: string;
};
```

Em `loadGroups`, ao definir o grupo inicial:

```ts
        if (!activeGroupId && data.data.length > 0) {
          const preferred = initialGroupId && data.data.some((g: ChatGroupSummary) => g.id === initialGroupId)
            ? initialGroupId
            : data.data[0].id;
          setActiveGroupId(preferred);
          if (initialGroupId === preferred) setIsMobileRoomOpen(true);
        }
```

Adicionar `initialGroupId` ao `useCallback` deps de `loadGroups`.

- [ ] **Step 2: `MasterCommunityView` lê searchParams**

```ts
import { useSearchParams } from "next/navigation";

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "chat" ? "chat" : "feed";
  const [activeTab, setActiveTab] = useState<"feed" | "chat">(initialTab);
  const dmGroupId = searchParams.get("dm") ?? undefined;
```

Passar `initialGroupId={dmGroupId}` ao `<CampaignChat>`.

Em `src/app/master/community/page.tsx`, envolver o retorno em `<Suspense>` (importar de `react`) para satisfazer o requisito de `useSearchParams` em build.

- [ ] **Step 3: `@handle` clicável no `MasterProfile`**

Substituir o `<p>` do handle (linhas 239-241):

```tsx
            {!isOwnProfile && currentUserId ? (
              <button
                type="button"
                onClick={handleStartDm}
                disabled={isStartingDm}
                data-testid="start-dm-button"
                className="text-xs font-medium text-accent hover:text-accent-hover hover:underline transition-colors cursor-pointer disabled:opacity-50"
              >
                @{userHandle}
              </button>
            ) : (
              <p className="text-xs font-medium text-gray-500">@{userHandle}</p>
            )}
```

Handler (com `useRouter` de `next/navigation`, estado `isStartingDm`):

```ts
  const handleStartDm = async () => {
    if (!currentUserId || isStartingDm) return;
    setIsStartingDm(true);
    try {
      const res = await fetch("/api/chat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.data?.id) {
        router.push(`/master/community?tab=chat&dm=${data.data.id}`);
      }
    } finally {
      setIsStartingDm(false);
    }
  };
```

- [ ] **Step 4: Teste `MasterProfile.dm.test.tsx`**

Renderizar `MasterProfile` com `userId="u-2"`, `currentUserId="u-1"` e `profileData` completo (fixture `MasterProfileData`); mock de fetch para `/api/community/profile/u-2/posts` (retorna `{ data: [] }`) e `/api/chat/dm` (retorna `{ success: true, data: { id: "dm-1" } }`); mock de `next/navigation` (`useRouter: () => ({ push: vi.fn() })`). Achar `@handle` clicável, clicar, esperar `router.push` com `/master/community?tab=chat&dm=dm-1`.

Caso "perfil próprio" (`currentUserId="u-2"`): renderiza `<p>` não-clicável (sem `start-dm-button`).

- [ ] **Step 5: Estender `MasterCommunityView.test.tsx`**

Mockar `next/navigation` com `useSearchParams: () => new URLSearchParams("tab=chat&dm=g-9")`; mock de `CampaignChat` capturando props; asserting que recebe `initialGroupId="g-9"` e que a aba ativa inicial é chat (botão `tab-campaign-chat` com classe `bg-accent`).

- [ ] **Step 6: Rodar testes + tsc**

Run: `npx vitest run src/components/community/__tests__ src/components/chat/__tests__ && npx tsc --noEmit` → PASS.

---

### Task 12: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: todos os testes verdes (ruído pré-existente documentado em memória do projeto não deve aumentar).

- [ ] **Step 2: tsc + lint nos arquivos tocados**

```bash
npx tsc --noEmit
npx eslint src/components/chat src/components/community src/app/api/chat src/app/api/campaigns src/lib/server/chat-service.ts src/lib/validators/chat.ts src/context/SocketContext.tsx server.js
```

Expected: sem erros novos (warnings pré-existentes permitidos).

- [ ] **Step 3: Verificação manual (dev server)**

1. Mestre: Comunidade → Grupos de Campanha → "+" → compartilhar magia da biblioteca → card aparece; clique abre modal de detalhes.
2. Jogador recebe em tempo real; clique no card de campanha compartilhada → seleciona personagem → "Entrar na campanha" → sucesso.
3. `@mar` no input → dropdown → selecionar → card de perfil enviado; clique no card → "Iniciar chat" → DM aberta.
4. Perfil de outro mestre na comunidade → clique no `@handle` → DM aberta na aba de chat.
5. Menu hambúrguer → Configurações → desabilitar "Escrever" de um membro → no navegador do membro o input desabilita em tempo real.
6. "Remover da campanha" → membro some do grupo, convite revogado, vínculo de personagem removido (verificar no banco read-only).
7. Excluir uma campanha de teste → confirmar no banco (read-only) que `campaign_chat_groups`/`campaign_chat_messages`/`campaign_assets` da campanha sumiram.

- [ ] **Step 4: Commit (com autorização do usuário)**

Somente após o usuário autorizar: `git add` dos arquivos tocados + spec + plano, commit `feat(chat): DMs, compartilhamentos e permissões de grupo`. Push e PR apenas com autorização explícita (docker ausente → `--no-verify` só se o usuário aprovar).

---

## Ordem e dependências

Task 1 → 2 → 3 → 4 → 5 → 6 (backend completo) → 7 → 8 → 9 → 10 → 11 (frontend) → 12.
Tasks 7-9 dependem de 3 e 5; Task 10 depende de 4 e 6; Task 11 depende de 3.
