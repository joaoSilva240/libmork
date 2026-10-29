/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Libmork — Testes de Integração de API: Sistema MISSING — Edição ZERO
// Mascaramento Seguro, Imutabilidade de Rasuras, Perda de Equipamento,
// Limite de Perigo, Epifanias por Estágio e Ledger de Ações
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

// Hoisted mocks
const { mockRequireAuth, store } = vi.hoisted(() => {
  const memoryStore = {
    campaigns: [] as any[],
    campaignInvites: [] as any[],
    missingCampaignStates: [] as any[],
    missingHabitants: [] as any[],
    missingActionLedger: [] as any[],
  };

  return {
    mockRequireAuth: vi.fn(),
    store: memoryStore,
  };
});

function getStoreTable(tableName: string) {
  if (tableName === "campaigns") return store.campaigns;
  if (tableName === "campaign_invites") return store.campaignInvites;
  if (tableName === "missing_campaign_states") return store.missingCampaignStates;
  if (tableName === "missing_habitants") return store.missingHabitants;
  if (tableName === "missing_action_ledger") return store.missingActionLedger;
  return [];
}

function matchCondition(item: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.op === "eq") {
    const colName = cond.col?.name || cond.col;
    const camel = colName.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    const val = item[camel] !== undefined ? item[camel] : item[colName];
    return val === cond.val;
  }
  if (cond.op === "and") {
    return cond.args.every((c: any) => matchCondition(item, c));
  }
  return true;
}

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: any, val: any) => ({ op: "eq", col, val }),
    and: (...args: any[]) => ({ op: "and", args }),
    asc: (col: any) => col,
    desc: (col: any) => col,
  };
});

vi.mock("@/lib/db", () => {
  const getTableName = (table: any) => {
    return (
      table?.[Symbol.for("drizzle:Name")] ||
      table?._?.name ||
      table?.tableName ||
      table?.name ||
      "unknown"
    );
  };

  return {
    db: {
      select: () => ({
        from: (table: any) => {
          const tableName = getTableName(table);
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
            where: (cond: any) => {
              const list = getStoreTable(tableName);
              const filtered = list.filter((item) => matchCondition(item, cond));
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                orderBy: () => Promise.resolve(filtered),
                then: (res: any, rej: any) => Promise.resolve(filtered).then(res, rej),
              };
            },
            orderBy: () => {
              const list = getStoreTable(tableName);
              return Promise.resolve(list);
            },
            limit: (n: number) => {
              const list = getStoreTable(tableName);
              return Promise.resolve(list.slice(0, n));
            },
            then: (res: any, rej: any) => Promise.resolve(getStoreTable(tableName)).then(res, rej),
          };
        },
      }),
      insert: (table: any) => {
        const tableName = getTableName(table);
        return {
          values: (data: any) => {
            const list = getStoreTable(tableName);
            const row = {
              id: data.id || randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
            list.push(row);
            return {
              returning: () => Promise.resolve([row]),
              then: (res: any, rej: any) => Promise.resolve([row]).then(res, rej),
            };
          },
        };
      },
      update: (table: any) => {
        const tableName = getTableName(table);
        return {
          set: (data: any) => ({
            where: (cond: any) => {
              const list = getStoreTable(tableName);
              const items = list.filter((item) => matchCondition(item, cond));
              for (const item of items) {
                Object.assign(item, data, { updatedAt: new Date() });
              }
              return {
                returning: () => Promise.resolve(items),
                then: (res: any, rej: any) => Promise.resolve(items).then(res, rej),
              };
            },
          }),
        };
      },
      delete: (table: any) => {
        const tableName = getTableName(table);
        return {
          where: (cond: any) => {
            const list = getStoreTable(tableName);
            const remaining = list.filter((item) => !matchCondition(item, cond));
            if (tableName === "campaigns") store.campaigns = remaining;
            else if (tableName === "campaign_invites") store.campaignInvites = remaining;
            else if (tableName === "missing_campaign_states") store.missingCampaignStates = remaining;
            else if (tableName === "missing_habitants") store.missingHabitants = remaining;
            else if (tableName === "missing_action_ledger") store.missingActionLedger = remaining;
            return Promise.resolve(remaining);
          },
        };
      },
    },
  };
});

// Import route handlers
import { GET as getState } from "../campaigns/[id]/state/route";
import { GET as getHabitants, POST as postHabitants } from "../campaigns/[id]/habitants/route";
import {
  GET as getUserHabitantsRoute,
  POST as postUserHabitantsRoute,
} from "../habitants/route";
import {
  GET as getPersonalHabitantById,
  PATCH as patchPersonalHabitant,
  DELETE as deletePersonalHabitant,
} from "../habitants/[id]/route";
import { POST as erasePersonalHabitantLine } from "../habitants/[id]/erase/route";
import {
  GET as getHabitantById,
  PATCH as patchHabitant,
} from "../campaigns/[id]/habitants/[habitantId]/route";
import { POST as eraseLine } from "../campaigns/[id]/habitants/[habitantId]/erase/route";
import { POST as updateScenes } from "../campaigns/[id]/scenes/route";
import { POST as createClue } from "../campaigns/[id]/clues/route";
import { POST as deliverClue } from "../campaigns/[id]/clues/[clueId]/deliver/route";
import { POST as addConnection } from "../campaigns/[id]/investigation/connections/route";
import { POST as declareEpiphany } from "../campaigns/[id]/investigation/epiphany/route";
import { POST as executeRoll } from "../campaigns/[id]/rolls/route";
import { GET as getLedger } from "../campaigns/[id]/ledger/route";

describe("MISSING — Edição ZERO: Suíte de Integração de APIs", () => {
  const masterUser = { id: "user-voice", email: "voice@carlton.com", role: "gm" };
  const writerUser1 = { id: "user-writer-1", email: "writer1@carlton.com", role: "player" };
  const writerUser2 = { id: "user-writer-2", email: "writer2@carlton.com", role: "player" };
  const campaignId = "camp-carlton-01";

  beforeEach(() => {
    vi.clearAllMocks();
    store.campaigns = [
      {
        id: campaignId,
        masterId: masterUser.id,
        name: "O Mistério de Carlton",
        rulesEngine: "missing_zero",
      },
    ];
    store.campaignInvites = [
      {
        id: "inv-1",
        campaignId,
        userId: writerUser1.id,
        revoked: false,
      },
      {
        id: "inv-2",
        campaignId,
        userId: writerUser2.id,
        revoked: false,
      },
    ];
    store.missingCampaignStates = [];
    store.missingHabitants = [];
    store.missingActionLedger = [];
  });

  // ===========================================================================
  // 1. Autenticação e Autorização Básica
  // ===========================================================================
  describe("Autenticação e Respostas Padronizadas", () => {
    it("deve retornar 401 para requisições não autenticadas", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const res = await getState(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Não autenticado");
    });

    it("deve rejeitar acesso a usuário sem vínculo com a campanha", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "stranger-user", email: "intruder@carlton.com" },
      });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const res = await getState(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain("Acesso não autorizado");
    });
  });

  // ===========================================================================
  // 2. Mascaramento Seguro de Pistas: Voz vs Redator
  // ===========================================================================
  describe("Mascaramento Seguro de Pistas (Issue #49)", () => {
    let habitant1Id: string;
    let habitant2Id: string;

    beforeEach(async () => {
      // Criar habitante 1 (pertence a writerUser1)
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const reqH1 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Thomas Miller",
            lines: [
              "Trabalha na usina nuclear de Carlton",
              "Tem medo crônico de barulhos metálicos",
              "Carrega a foto desbotada da irmã sumida",
              "Não confia na polícia local",
              "Mora sozinho perto da costa",
            ],
            equipments: [
              { name: "Lanterna" },
              { name: "Canivete Militar" },
              { name: "Gravador de Áudio" },
            ],
          }),
        },
      );
      const resH1 = await postHabitants(reqH1, { params: Promise.resolve({ id: campaignId }) });
      const dataH1 = await resH1.json();
      habitant1Id = dataH1.data.id;

      // Criar habitante 2 (pertence a writerUser2)
      mockRequireAuth.mockResolvedValue({ user: writerUser2 });
      const reqH2 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Sarah Connors",
            lines: [
              "Bióloga marinha investigando a água",
              "Encontrou peixes com mutações nos olhos",
              "Acredita que o farol guarda segredos",
              "Nunca sai sem seu caderno de campo",
              "Perdeu a mãe jovem demais",
            ],
            equipments: [
              { name: "Caderno" },
              { name: "Chaves" },
              { name: "Rolo de Filme" },
            ],
          }),
        },
      );
      const resH2 = await postHabitants(reqH2, { params: Promise.resolve({ id: campaignId }) });
      const dataH2 = await resH2.json();
      habitant2Id = dataH2.data.id;

      // A Voz cria 4 pistas:
      // P1: Verdadeira, entregue ao habitante 1
      // P2: FALSA (isFalseClue: true), entregue ao habitante 1
      // P3: Privada (não entregue a ninguém - no banco da Voz)
      // P4: Entregue ao habitante 2
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      const reqP1 = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Foto Estranha",
          description: "Um vulto perto do reator",
          isFalseClue: false,
          deliveredToHabitantId: habitant1Id,
        }),
      });
      await createClue(reqP1, { params: Promise.resolve({ id: campaignId }) });

      const reqP2 = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Bilhete Forjado",
          description: "Dizendo que a irmã viajou voluntariamente",
          isFalseClue: true, // PISTA FALSA!
          deliveredToHabitantId: habitant1Id,
        }),
      });
      await createClue(reqP2, { params: Promise.resolve({ id: campaignId }) });

      const reqP3 = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Dossiê Secreto do Mestre",
          description: "Segredo de estado da usina",
          isFalseClue: false,
          deliveredToHabitantId: null, // Pista privada da Voz
        }),
      });
      await createClue(reqP3, { params: Promise.resolve({ id: campaignId }) });

      const reqP4 = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Amostra da Água",
          description: "Resíduos fosforescentes",
          isFalseClue: false,
          deliveredToHabitantId: habitant2Id,
        }),
      });
      await createClue(reqP4, { params: Promise.resolve({ id: campaignId }) });
    });

    it("A Voz deve enxergar todas as pistas com o status real de isFalseClue", async () => {
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const res = await getState(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.role).toBe("voice");
      expect(json.data.cluesBank.length).toBe(4);

      const falseClue = json.data.cluesBank.find((c: any) => c.title === "Bilhete Forjado");
      expect(falseClue).toBeDefined();
      expect(falseClue.isFalseClue).toBe(true);

      const privateClue = json.data.cluesBank.find((c: any) => c.title === "Dossiê Secreto do Mestre");
      expect(privateClue).toBeDefined();
      expect(privateClue.deliveredToHabitantId).toBeNull();
    });

    it("O Redator deve receber APENAS suas pistas entregues, com isFalseClue mascarado como false", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const res = await getState(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.role).toBe("writer");

      // Deve enxergar apenas 2 pistas (Foto Estranha e Bilhete Forjado)
      expect(json.data.cluesBank.length).toBe(2);

      // Pista não distribuída NUNCA pode ser enviada
      const hasPrivate = json.data.cluesBank.some((c: any) => c.title === "Dossiê Secreto do Mestre");
      expect(hasPrivate).toBe(false);

      // Pista de outro habitante NUNCA pode ser enviada
      const hasOther = json.data.cluesBank.some((c: any) => c.title === "Amostra da Água");
      expect(hasOther).toBe(false);

      // CRÍTICO: Pista que era falsa no banco da Voz DEVE ter isFalseClue: false para o Redator
      const falseClue = json.data.cluesBank.find((c: any) => c.title === "Bilhete Forjado");
      expect(falseClue).toBeDefined();
      expect(falseClue.isFalseClue).toBe(false);
    });

    it("Redatores não podem criar nem entregar pistas (Apenas a Voz pode)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const reqCreate = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Tentativa do Redator",
          description: "Criando pista ilegalmente",
        }),
      });
      const resCreate = await createClue(reqCreate, { params: Promise.resolve({ id: campaignId }) });
      expect(resCreate.status).toBe(403);
      const jsonCreate = await resCreate.json();
      expect(jsonCreate.error).toContain("Apenas a Voz pode criar pistas");

      const reqDeliver = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/clues/fake-id/deliver`,
        {
          method: "POST",
          body: JSON.stringify({ targetHabitantId: habitant1Id }),
        },
      );
      const resDeliver = await deliverClue(reqDeliver, {
        params: Promise.resolve({ id: campaignId, clueId: "fake-id" }),
      });
      expect(resDeliver.status).toBe(403);
    });

    it("A Voz pode entregar pista privada ao Habitante, tornando-a visível ao Redator de forma mascarada", async () => {
      // Pega a pista privada criada no beforeEach
      mockRequireAuth.mockResolvedValue({ user: masterUser });
      const stateReq = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const stateRes = await getState(stateReq, { params: Promise.resolve({ id: campaignId }) });
      const stateData = (await stateRes.json()).data;
      const privateClue = stateData.cluesBank.find((c: any) => c.title === "Dossiê Secreto do Mestre");
      expect(privateClue).toBeDefined();

      // Voz entrega a pista ao habitante 1
      const deliverReq = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/clues/${privateClue.id}/deliver`,
        {
          method: "POST",
          body: JSON.stringify({ targetHabitantId: habitant1Id }),
        },
      );
      const deliverRes = await deliverClue(deliverReq, {
        params: Promise.resolve({ id: campaignId, clueId: privateClue.id }),
      });
      expect(deliverRes.status).toBe(200);

      // Agora Redator 1 consulta o estado e deve enxergar a nova pista entregue!
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const writerStateReq = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/state`);
      const writerStateRes = await getState(writerStateReq, { params: Promise.resolve({ id: campaignId }) });
      const writerStateData = (await writerStateRes.json()).data;

      const receivedClue = writerStateData.cluesBank.find((c: any) => c.id === privateClue.id);
      expect(receivedClue).toBeDefined();
      expect(receivedClue.title).toBe("Dossiê Secreto do Mestre");
      expect(receivedClue.isFalseClue).toBe(false);
    });

    it("O livro-razão (ledger) não deve revelar isFalseClue aos Redatores", async () => {
      // Adiciona evento no ledger com isFalseClue
      store.missingActionLedger.push({
        id: "event-secret",
        campaignId,
        actorRole: "voice",
        actorId: masterUser.id,
        eventType: "CLUE_CREATED",
        payload: {
          clueId: "clue-secret-01",
          title: "Pista ultra secreta",
          isFalseClue: true,
        },
        createdAt: new Date(),
      });

      // Voz consulta ledger -> enxerga o evento
      mockRequireAuth.mockResolvedValue({ user: masterUser });
      const voiceReq = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/ledger`);
      const voiceRes = await getLedger(voiceReq, { params: Promise.resolve({ id: campaignId }) });
      const voiceJson = await voiceRes.json();
      const voiceEvent = voiceJson.data.find((e: any) => e.id === "event-secret");
      expect(voiceEvent).toBeDefined();
      expect(voiceEvent.payload.isFalseClue).toBe(true);

      // Redator consulta ledger -> isFalseClue DEVE ser omitido / removido
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const writerReq = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/ledger`);
      const writerRes = await getLedger(writerReq, { params: Promise.resolve({ id: campaignId }) });
      const writerJson = await writerRes.json();
      const writerEvent = writerJson.data.find((e: any) => e.id === "event-secret");
      expect(writerEvent).toBeDefined();
      expect(writerEvent.payload.isFalseClue).toBeUndefined();
    });

    it("deve listar todos os habitantes da campanha via GET /habitants", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/habitants`);
      const res = await getHabitants(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(2);
      expect(json.data[0].name).toBe("Thomas Miller");
      expect(json.data[1].name).toBe("Sarah Connors");
    });
  });

  // ===========================================================================
  // 3. Imutabilidade de Rasuras & Desaparecimento do Habitante
  // ===========================================================================
  describe("Imutabilidade de Rasuras e Desaparecimento", () => {
    let habitantId: string;
    let line1Id: string;
    let line2Id: string;
    let line3Id: string;
    let line4Id: string;
    let line5Id: string;

    beforeEach(async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const req = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Arthur Pendelton",
            lines: ["Memória 1", "Memória 2", "Memória 3", "Memória 4", "Memória 5"],
            equipments: [
              { name: "Lanterna" },
              { name: "Revólver" },
              { name: "Caderno" },
            ],
          }),
        },
      );
      const res = await postHabitants(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();
      habitantId = json.data.id;
      line1Id = json.data.lines[0].id;
      line2Id = json.data.lines[1].id;
      line3Id = json.data.lines[2].id;
      line4Id = json.data.lines[3].id;
      line5Id = json.data.lines[4].id;
    });

    it("deve rasurar linha com sucesso, registrar motivo e manter habitante ativo", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}/erase`,
        {
          method: "POST",
          body: JSON.stringify({
            lineId: line1Id,
            reason: "Choque psicológico ao ver a criatura",
          }),
        },
      );

      const res = await eraseLine(req, {
        params: Promise.resolve({ id: campaignId, habitantId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("active");
      const erased = json.data.lines.find((l: any) => l.id === line1Id);
      expect(erased.isErased).toBe(true);
      expect(erased.erasedReason).toBe("Choque psicológico ao ver a criatura");
      expect(erased.erasedAt).toBeDefined();

      // Checa ledger
      const ledgerReq = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/ledger`,
      );
      const ledgerRes = await getLedger(ledgerReq, { params: Promise.resolve({ id: campaignId }) });
      const ledgerJson = await ledgerRes.json();
      const lastEvent = ledgerJson.data[ledgerJson.data.length - 1];
      expect(lastEvent.eventType).toBe("LINE_ERASED");
      expect(lastEvent.payload.lineId).toBe(line1Id);
    });

    it("deve impedir rasurar novamente uma linha já rasurada (status 400)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Primeira rasura
      const req1 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}/erase`,
        {
          method: "POST",
          body: JSON.stringify({ lineId: line1Id }),
        },
      );
      await eraseLine(req1, { params: Promise.resolve({ id: campaignId, habitantId }) });

      // Segunda tentativa na mesma linha
      const req2 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}/erase`,
        {
          method: "POST",
          body: JSON.stringify({ lineId: line1Id }),
        },
      );
      const res2 = await eraseLine(req2, { params: Promise.resolve({ id: campaignId, habitantId }) });
      const json2 = await res2.json();

      expect(res2.status).toBe(400);
      expect(json2.error).toContain("já foi rasurada e não pode ser alterada");
    });

    it("deve bloquear tentativa de desrasurar via PATCH (imutabilidade estrita)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Rasura linha 1
      const reqErase = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}/erase`,
        {
          method: "POST",
          body: JSON.stringify({ lineId: line1Id }),
        },
      );
      await eraseLine(reqErase, { params: Promise.resolve({ id: campaignId, habitantId }) });

      // Busca estado atual
      const getReq = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}`,
      );
      const getRes = await getHabitantById(getReq, {
        params: Promise.resolve({ id: campaignId, habitantId }),
      });
      const current = (await getRes.json()).data;

      // Tenta enviar PATCH com isErased: false na linha 1
      const tamperedLines = current.lines.map((l: any) =>
        l.id === line1Id ? { ...l, isErased: false } : l,
      );

      const patchReq = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ lines: tamperedLines }),
        },
      );
      const patchRes = await patchHabitant(patchReq, {
        params: Promise.resolve({ id: campaignId, habitantId }),
      });
      const patchJson = await patchRes.json();

      expect(patchRes.status).toBe(400);
      expect(patchJson.error).toContain("Não é permitido desrasurar uma linha rasurada");
    });

    it("deve marcar status como 'missing' quando todas as linhas forem rasuradas", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Rasura as 5 linhas sequencialmente
      for (const lId of [line1Id, line2Id, line3Id, line4Id, line5Id]) {
        const req = new NextRequest(
          `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants/${habitantId}/erase`,
          {
            method: "POST",
            body: JSON.stringify({ lineId: lId, reason: "Perdendo memórias" }),
          },
        );
        const res = await eraseLine(req, {
          params: Promise.resolve({ id: campaignId, habitantId }),
        });
        const json = await res.json();

        if (lId === line5Id) {
          // Última linha rasurada -> Desaparecido!
          expect(json.data.status).toBe("missing");
        } else {
          expect(json.data.status).toBe("active");
        }
      }
    });
  });

  // ===========================================================================
  // 4. Testes Forçados com Perda de Equipamento
  // ===========================================================================
  describe("Execução de Testes e Perda de Equipamento", () => {
    let habitantId: string;
    let eq1Id: string;

    beforeEach(async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const req = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/habitants`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Officer Davis",
            lines: ["Linha 1", "Linha 2", "Linha 3", "Linha 4", "Linha 5"],
            equipments: [
              { name: "Lanterna" },
              { name: "Canivete Militar" },
              { name: "Rolo de Filme" },
            ],
          }),
        },
      );
      const res = await postHabitants(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();
      habitantId = json.data.id;
      eq1Id = json.data.equipments[0].id;
    });

    it("teste comum padrão sem forçar retorna resultado com cálculo de rasuras", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify({
          habitantId,
          type: "common",
          dice: [5], // Ganho
        }),
      });

      const res = await executeRoll(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.rollType).toBe("standard");
      expect(json.data.originalResult.outcome).toBe("gain");
      expect(json.data.erasuresCount).toBe(0);
    });

    it("teste forçado com resultado Ganho preserva o equipamento", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify({
          habitantId,
          type: "common",
          dice: [2], // original foi perda
          forced: true,
          equipmentId: eq1Id,
          forcedDie: 6, // forçado resultou em ganho (6)
        }),
      });

      const res = await executeRoll(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.rollType).toBe("forced");
      expect(json.data.forcedResult.outcome).toBe("gain");
      expect(json.data.forcedResult.equipmentLost).toBe(false);
      expect(json.data.habitant.equipments[0].status).toBe("active");
    });

    it("teste forçado com resultado Perda marca o equipamento como 'lost' e impede reuso", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Força teste com dado forçado baixo (1 = Perda)
      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify({
          habitantId,
          type: "common",
          dice: [2],
          forced: true,
          equipmentId: eq1Id,
          forcedDie: 1, // forçado resultou em perda
        }),
      });

      const res = await executeRoll(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.forcedResult.outcome).toBe("loss");
      expect(json.data.forcedResult.equipmentLost).toBe(true);
      expect(json.data.habitant.equipments[0].status).toBe("lost");

      // Tenta forçar OUTRO teste com o mesmo equipamento agora perdido
      const req2 = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify({
          habitantId,
          type: "common",
          dice: [2],
          forced: true,
          equipmentId: eq1Id,
          forcedDie: 5,
        }),
      });

      const res2 = await executeRoll(req2, { params: Promise.resolve({ id: campaignId }) });
      const json2 = await res2.json();

      expect(res2.status).toBe(400);
      expect(json2.error).toContain("Não é possível forçar o teste com um equipamento inativo ou perdido");
    });
  });

  // ===========================================================================
  // 5. Validação do Limite de Perigo Total (<= 3)
  // ===========================================================================
  describe("Validação de Perigo da Cena (Total <= 3)", () => {
    it("deve rejeitar com status 400 tentativa de configurar soma de perigo > 3", async () => {
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          sceneTitle: "Nevoeiro Sobrenatural",
          threats: [
            { name: "Monstro das Sombras", dangerLevel: 2 },
            { name: "Incêndio na Sala de Controle", dangerLevel: 2 }, // Total = 4 (> 3)
          ],
        }),
      });

      const res = await updateScenes(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("não pode ultrapassar 3");
    });

    it("deve permitir configurar ameaças com soma de perigo <= 3", async () => {
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          sceneTitle: "Área de Contenção",
          threats: [
            { name: "Vazamento Radioativo", dangerLevel: 2 },
            { name: "Porta Emperrada", dangerLevel: 1 }, // Total = 3 (Válido)
          ],
        }),
      });

      const res = await updateScenes(req, { params: Promise.resolve({ id: campaignId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.title).toBe("Área de Contenção");
      expect(json.data.threats.length).toBe(2);
    });

    it("deve impedir Redatores de alterar as ameaças da cena (status 403)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          sceneTitle: "Tentativa de Cena",
          threats: [{ name: "Ameaça", dangerLevel: 1 }],
        }),
      });

      const res = await updateScenes(req, { params: Promise.resolve({ id: campaignId }) });
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 6. Declaração de Epifania (Estágios 1 e 2)
  // ===========================================================================
  describe("Declaração de Epifanias na Teia de Investigação", () => {
    let clue1Id: string;
    let clue2Id: string;
    let clue3Id: string;
    let clue4Id: string;
    let clue5Id: string;
    let clue6Id: string;
    let clue7Id: string;

    beforeEach(async () => {
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      // Cria pistas legítimas
      const clues = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];
      const createdIds: string[] = [];

      for (const title of clues) {
        const req = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
          method: "POST",
          body: JSON.stringify({
            title,
            description: `Descrição da pista ${title}`,
            isFalseClue: false,
          }),
        });
        const res = await createClue(req, { params: Promise.resolve({ id: campaignId }) });
        const json = await res.json();
        createdIds.push(json.data.id);
      }

      [clue1Id, clue2Id, clue3Id, clue4Id, clue5Id, clue6Id, clue7Id] = createdIds;
    });

    it("estágio 1 falha se faltar conexão de algum dos 3 tipos obrigatórios", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Adiciona apenas 'cause' e 'origin'
      const reqConn1 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceClueId: clue1Id,
            targetClueId: clue2Id,
            type: "cause",
          }),
        },
      );
      await addConnection(reqConn1, { params: Promise.resolve({ id: campaignId }) });

      const reqConn2 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceClueId: clue2Id,
            targetClueId: clue3Id,
            type: "origin",
          }),
        },
      );
      await addConnection(reqConn2, { params: Promise.resolve({ id: campaignId }) });

      // Tenta declarar epifania estágio 1 sem a conexão 'perspective'
      const reqEpi = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`,
        {
          method: "POST",
          body: JSON.stringify({ chosenEffect: "answer_question" }),
        },
      );

      const resEpi = await declareEpiphany(reqEpi, { params: Promise.resolve({ id: campaignId }) });
      const jsonEpi = await resEpi.json();

      expect(resEpi.status).toBe(400);
      expect(jsonEpi.error).toContain("Conexões insuficientes");
    });

    it("estágio 1 sucede com 1 conexão de cada tipo, e estágio 2 exige 2 de cada tipo", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // 1. Completa estágio 1 adicionando 'perspective'
      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue1Id, targetClueId: clue2Id, type: "cause" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue2Id, targetClueId: clue3Id, type: "origin" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue3Id, targetClueId: clue4Id, type: "perspective" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      // Declara Epifania Estágio 1
      const reqEpi1 = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`,
        {
          method: "POST",
          body: JSON.stringify({ chosenEffect: "answer_question" }),
        },
      );
      const resEpi1 = await declareEpiphany(reqEpi1, { params: Promise.resolve({ id: campaignId }) });
      const jsonEpi1 = await resEpi1.json();

      expect(resEpi1.status).toBe(201);
      expect(jsonEpi1.data.stage).toBe(1);

      // 2. Agora estamos no estágio 2. Tentar declarar novamente sem novas conexões falha:
      const reqEpi2Fail = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`,
        {
          method: "POST",
          body: JSON.stringify({ chosenEffect: "deliver_new_clue" }),
        },
      );
      const resEpi2Fail = await declareEpiphany(reqEpi2Fail, { params: Promise.resolve({ id: campaignId }) });
      expect(resEpi2Fail.status).toBe(400);

      // 3. Adiciona mais 1 de cada tipo para alcançar 2 de cada
      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue4Id, targetClueId: clue5Id, type: "cause" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue5Id, targetClueId: clue6Id, type: "origin" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue6Id, targetClueId: clue7Id, type: "perspective" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      // Declara Epifania Estágio 2
      const reqEpi2Success = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`,
        {
          method: "POST",
          body: JSON.stringify({ chosenEffect: "tear_false_clue" }),
        },
      );
      const resEpi2Success = await declareEpiphany(reqEpi2Success, {
        params: Promise.resolve({ id: campaignId }),
      });
      const jsonEpi2 = await resEpi2Success.json();

      expect(resEpi2Success.status).toBe(201);
      expect(jsonEpi2.data.stage).toBe(2);
    });

    it("se houver uma pista falsa na teia conectada, a epifania é frustrada (status 400)", async () => {
      // A Voz cria uma pista falsa e a conecta
      mockRequireAuth.mockResolvedValue({ user: masterUser });

      const reqFalse = new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/clues`, {
        method: "POST",
        body: JSON.stringify({
          title: "Pista Fraudulenta",
          description: "Desinformação deliberada",
          isFalseClue: true,
        }),
      });
      const resFalse = await createClue(reqFalse, { params: Promise.resolve({ id: campaignId }) });
      const falseClueId = (await resFalse.json()).data.id;

      // Cria conexões conectando a pista falsa
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue1Id, targetClueId: falseClueId, type: "cause" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: falseClueId, targetClueId: clue2Id, type: "origin" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      await addConnection(
        new NextRequest(`http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/connections`, {
          method: "POST",
          body: JSON.stringify({ sourceClueId: clue2Id, targetClueId: clue3Id, type: "perspective" }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      const reqEpi = new NextRequest(
        `http://localhost/api/systems/missing/campaigns/${campaignId}/investigation/epiphany`,
        {
          method: "POST",
          body: JSON.stringify({ chosenEffect: "answer_question" }),
        },
      );

      const resEpi = await declareEpiphany(reqEpi, { params: Promise.resolve({ id: campaignId }) });
      const jsonEpi = await resEpi.json();

      expect(resEpi.status).toBe(400);
      expect(jsonEpi.error).toContain("Uma das pistas presentes na teia é falsa! A epifania foi frustrada.");
    });
  });

  // ===========================================================================
  // 7. Rota Pessoal de Habitantes (/api/systems/missing/habitants)
  // ===========================================================================
  describe("Rota Pessoal de Habitantes (/api/systems/missing/habitants)", () => {
    it("deve criar um habitante pessoal sem campaignId com sucesso (status 201)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest("http://localhost/api/systems/missing/habitants", {
        method: "POST",
        body: JSON.stringify({
          name: "Detetive Desconhecido",
          lines: [
            "Memória 1: Acordou sem documentos na estação de trem",
            "Memória 2: Tem uma cicatriz no antebraço direito",
            "Memória 3: Lembra do som distante de sirenes",
            "Memória 4: Carrega uma chave enferrujada no bolso",
            "Memória 5: Desconfia de rostos familiares",
          ],
          equipments: [
            { name: "Lanterna Antiga", notes: "Luz trêmula" },
            { name: "Caderno Pautado", notes: "Sem anotações" },
            { name: "Pé de Cabra" },
          ],
        }),
      });

      const res = await postUserHabitantsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Detetive Desconhecido");
      expect(json.data.ownerId).toBe(writerUser1.id);
      expect(json.data.campaignId).toBeNull();
      expect(json.data.lines.length).toBe(5);
      expect(json.data.equipments.length).toBe(3);
    });

    it("deve retornar apenas os habitantes pertencentes ao usuário autenticado via GET", async () => {
      // Habitante para writerUser1
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const req1 = new NextRequest("http://localhost/api/systems/missing/habitants", {
        method: "POST",
        body: JSON.stringify({
          name: "Habitante do Usuário 1",
          lines: ["L1", "L2", "L3", "L4", "L5"],
          equipments: [{ name: "E1" }, { name: "E2" }, { name: "E3" }],
        }),
      });
      await postUserHabitantsRoute(req1);

      // Habitante para writerUser2
      mockRequireAuth.mockResolvedValue({ user: writerUser2 });
      const req2 = new NextRequest("http://localhost/api/systems/missing/habitants", {
        method: "POST",
        body: JSON.stringify({
          name: "Habitante do Usuário 2",
          lines: ["L1", "L2", "L3", "L4", "L5"],
          equipments: [{ name: "E1" }, { name: "E2" }, { name: "E3" }],
        }),
      });
      await postUserHabitantsRoute(req2);

      // Consulta como writerUser1
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });
      const getReq = new NextRequest("http://localhost/api/systems/missing/habitants");
      const getRes = await getUserHabitantsRoute();
      const getJson = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getJson.success).toBe(true);
      expect(getJson.data.every((h: any) => h.ownerId === writerUser1.id)).toBe(true);
      expect(getJson.data.some((h: any) => h.name === "Habitante do Usuário 1")).toBe(true);
      expect(getJson.data.some((h: any) => h.name === "Habitante do Usuário 2")).toBe(false);
    });

    it("deve rejeitar habitante com menos de 5 linhas com status 400", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest("http://localhost/api/systems/missing/habitants", {
        method: "POST",
        body: JSON.stringify({
          name: "Habitante Inválido",
          lines: ["Linha 1", "Linha 2"], // menos de 5
          equipments: [{ name: "E1" }, { name: "E2" }, { name: "E3" }],
        }),
      });

      const res = await postUserHabitantsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ===========================================================================
  // 8. Rotas Individuais de Habitante Pessoal (/api/systems/missing/habitants/[id])
  // ===========================================================================
  describe("Rotas Individuais de Habitante (/api/systems/missing/habitants/[id])", () => {
    let personalHabitantId: string;
    let personalLine1Id: string;

    beforeEach(async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest("http://localhost/api/systems/missing/habitants", {
        method: "POST",
        body: JSON.stringify({
          name: "Detetive Pessoal",
          lines: [
            "Memória 1: Lembrança da infância",
            "Memória 2: A casa na colina",
            "Memória 3: O relógio parado às 3:15",
            "Memória 4: Um nome sussurrado",
            "Memória 5: A chave do porão",
          ],
          equipments: [
            { name: "Lanterna Velha", notes: "Pilha fraca" },
            { name: "Gravador de Fita", notes: "Fita vazia" },
            { name: "Isqueiro de Metal" },
          ],
        }),
      });

      const res = await postUserHabitantsRoute(req);
      const json = await res.json();
      personalHabitantId = json.data.id;
      personalLine1Id = json.data.lines[0].id;
    });

    it("GET: retorna habitante pelo id para o proprietário com sucesso (status 200)", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/habitants/${personalHabitantId}`);
      const res = await getPersonalHabitantById(req, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(personalHabitantId);
      expect(json.data.name).toBe("Detetive Pessoal");
      expect(json.data.ownerId).toBe(writerUser1.id);
    });

    it("GET: retorna 404 se outro usuário tentar acessar habitante que não é seu", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser2 });

      const req = new NextRequest(`http://localhost/api/systems/missing/habitants/${personalHabitantId}`);
      const res = await getPersonalHabitantById(req, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toContain("não encontrado");
    });

    it("PATCH: permite adicionar linha de memória e atualizar equipamento", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      // Adiciona linha
      const patchReq = new NextRequest(`http://localhost/api/systems/missing/habitants/${personalHabitantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          addLine: "Memória 6: Encontrou um mapa rasgado",
          equipment: {
            slot: 1,
            name: "Super Lanterna LED",
            notes: "Foco brilhante",
            status: "active",
          },
        }),
      });

      const patchRes = await patchPersonalHabitant(patchReq, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      const patchJson = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchJson.success).toBe(true);
      expect(patchJson.data.lines.length).toBe(6);
      expect(patchJson.data.lines[5].text).toBe("Memória 6: Encontrou um mapa rasgado");
      expect(patchJson.data.equipments[0].name).toBe("Super Lanterna LED");
    });

    it("POST /erase: rasura linha do habitante pelo proprietário com campaignId nulo", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(
        `http://localhost/api/systems/missing/habitants/${personalHabitantId}/erase`,
        {
          method: "POST",
          body: JSON.stringify({
            lineId: personalLine1Id,
            reason: "Esquecimento traumático",
          }),
        },
      );

      const res = await erasePersonalHabitantLine(req, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      const erased = json.data.lines.find((l: any) => l.id === personalLine1Id);
      expect(erased.isErased).toBe(true);
      expect(erased.erasedReason).toBe("Esquecimento traumático");
    });

    it("DELETE: exclui habitante com sucesso pelo proprietário", async () => {
      mockRequireAuth.mockResolvedValue({ user: writerUser1 });

      const req = new NextRequest(`http://localhost/api/systems/missing/habitants/${personalHabitantId}`, {
        method: "DELETE",
      });

      const res = await deletePersonalHabitant(req, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Tenta buscar novamente -> 404
      const getReq = new NextRequest(`http://localhost/api/systems/missing/habitants/${personalHabitantId}`);
      const getRes = await getPersonalHabitantById(getReq, {
        params: Promise.resolve({ id: personalHabitantId }),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
