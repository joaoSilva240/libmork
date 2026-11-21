// =============================================================================
// Libmork — Roster do Escudo: campanha Fallout 2d20
// =============================================================================
// O vínculo de um sobrevivente é gravado em fallout_characters.campaign_id, sem
// linha em character_campaigns. O roster precisa ler essa tabela, como já faz
// para os habitantes de MISSING — Edição ZERO.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440001";

const survivor = {
  id: "770e8400-e29b-41d4-a716-446655440002",
  name: "Walter",
  ownerId: USER_ID,
  campaignId: CAMPAIGN_ID,
  origin: "vault_dweller",
  level: 3,
  xp: 1200,
  hpCurrent: 22,
  hpMax: 30,
};

const rowsByTable: Record<string, unknown[]> = {
  characterCampaigns: [],
  characters: [],
  npcCampaigns: [],
  falloutCharacters: [survivor],
};

const { mockDb, mockRequireAuth, mockGetCampaignAsMaster, mockGetFalloutCharactersByCampaign } =
  vi.hoisted(() => ({
    mockDb: { select: vi.fn() },
    mockRequireAuth: vi.fn(),
    mockGetCampaignAsMaster: vi.fn(),
    mockGetFalloutCharactersByCampaign: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/db/schema", () => ({
  npcs: { __name: "npcs", id: "npcs.id" },
  npcCampaigns: { __name: "npcCampaigns", npcId: "npcCampaigns.npcId", campaignId: "campaignId" },
  characterCampaigns: { __name: "characterCampaigns", characterId: "x", campaignId: "x" },
  characters: { __name: "characters", id: "x" },
  characterConditions: {
    __name: "characterConditions",
    id: "x",
    characterId: "x",
    conditionId: "x",
  },
  conditions: { __name: "conditions", id: "x" },
  missingHabitants: { __name: "missingHabitants", campaignId: "x" },
  falloutCharacters: { __name: "falloutCharacters", campaignId: "x" },
}));

vi.mock("@/lib/auth/session", () => ({ requireAuth: () => mockRequireAuth() }));
vi.mock("@/lib/auth/campaign-access", () => ({
  getCampaignAsMaster: (...args: unknown[]) => mockGetCampaignAsMaster(...args),
}));
vi.mock("@/lib/server/fallout-service", () => ({
  getFalloutCharactersByCampaign: (...args: unknown[]) =>
    mockGetFalloutCharactersByCampaign(...args),
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
  };
  for (const method of ["where", "innerJoin", "orderBy", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

describe("GET /api/campaigns/:id/roster — Fallout 2d20", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => ({
      from: vi.fn((table: { __name?: string }) => makeChain(rowsByTable[table.__name ?? ""] ?? [])),
    }));
    mockRequireAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockGetCampaignAsMaster.mockResolvedValue({ id: CAMPAIGN_ID, rulesEngine: "fallout_2d20" });
    mockGetFalloutCharactersByCampaign.mockResolvedValue([survivor]);
  });

  it("lista os sobreviventes vinculados à campanha como jogadores do roster", async () => {
    const request = new NextRequest(`http://localhost/api/campaigns/${CAMPAIGN_ID}/roster`);

    const response = await GET(request, { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const [player] = body.data.players;
    expect(player).toMatchObject({
      id: survivor.id,
      name: survivor.name,
      ownerId: survivor.ownerId,
      level: survivor.level,
      xp: survivor.xp,
      hitPointsCurrent: survivor.hpCurrent,
      hitPointsMax: survivor.hpMax,
      system: "fallout_2d20",
    });
    expect(player.manaPointsCurrent).toBe(0);
    expect(player.conditions).toEqual([]);
  });

  it("busca as fichas pela campanha e não pela junção d20", async () => {
    const request = new NextRequest(`http://localhost/api/campaigns/${CAMPAIGN_ID}/roster`);

    await GET(request, { params: Promise.resolve({ id: CAMPAIGN_ID }) });

    expect(mockGetFalloutCharactersByCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
  });
});
