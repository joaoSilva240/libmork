// =============================================================================
// Libmork — Campanhas do Jogador: vínculo Fallout 2d20
// =============================================================================
// Sobreviventes ficam em fallout_characters (campaign_id), não em
// character_campaigns. Sem um ramo próprio, "Personagens Vinculados" e
// "Meus Personagens nesta campanha" ficam vazios mesmo com a ficha vinculada.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const MASTER_ID = "550e8400-e29b-41d4-a716-446655440009";
const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440001";
const SURVIVOR_ID = "770e8400-e29b-41d4-a716-446655440002";

const campaignRow = {
  id: CAMPAIGN_ID,
  name: "Wasteland",
  description: null,
  rulesEngine: "fallout_2d20",
  pvpEnabled: false,
  coverImageUrl: null,
  worldMapUrl: null,
  theme: null,
  dice3dPlayersEnabled: true,
  dice3dMasterEnabled: true,
  masterId: MASTER_ID,
  masterDisplayName: "Gina",
  masterEmail: "gina@example.com",
};

const survivorRow = {
  id: SURVIVOR_ID,
  name: "Walter",
  ownerId: USER_ID,
  campaignId: CAMPAIGN_ID,
  origin: "vault_dweller",
  level: 3,
  xp: 1200,
  hpCurrent: 22,
  hpMax: 30,
};

const otherSurvivorRow = {
  ...survivorRow,
  id: "880e8400-e29b-41d4-a716-446655440003",
  name: "Outro",
  ownerId: MASTER_ID,
};

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/db/schema", () => ({
  campaigns: { __name: "campaigns", id: "x" },
  campaignInvites: { __name: "campaignInvites", userId: "x", campaignId: "x", revoked: "x" },
  users: { __name: "users", id: "x" },
  characterCampaigns: { __name: "characterCampaigns", campaignId: "x", characterId: "x" },
  characters: { __name: "characters", id: "x" },
  missingHabitants: { __name: "missingHabitants", campaignId: "x" },
  falloutCharacters: { __name: "falloutCharacters", campaignId: "x" },
}));

vi.mock("@/lib/auth/session", () => ({ requireAuth: () => mockRequireAuth() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), inArray: vi.fn() }));
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

function mockTables(overrides: Record<string, unknown[]> = {}) {
  const rows: Record<string, unknown[]> = {
    campaignInvites: [{ campaignId: CAMPAIGN_ID }],
    campaigns: [campaignRow],
    characterCampaigns: [],
    missingHabitants: [],
    falloutCharacters: [survivorRow],
    ...overrides,
  };

  mockDb.select.mockImplementation(() => ({
    from: vi.fn((table: { __name?: string }) => makeChain(rows[table.__name ?? ""] ?? [])),
  }));
}

describe("GET /api/player/campaigns — Fallout 2d20", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockTables();
  });

  it("inclui o sobrevivente vinculado no roster e em characters da campanha", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);

    const [campaign] = body.data;
    expect(campaign.rulesEngine).toBe("fallout_2d20");
    expect(campaign.roster).toEqual([
      { id: SURVIVOR_ID, name: "Walter", imageUrl: null, isMine: true },
    ]);
    expect(campaign.characters).toEqual([
      {
        id: SURVIVOR_ID,
        name: "Walter",
        imageUrl: null,
        level: 3,
        hitPointsCurrent: 22,
        hitPointsMax: 30,
        manaPointsCurrent: 0,
        manaPointsMax: 0,
      },
    ]);
  });

  it("marca como meu apenas o sobrevivente do jogador autenticado", async () => {
    mockTables({ falloutCharacters: [survivorRow, otherSurvivorRow] });

    const response = await GET();
    const body = await response.json();

    const [campaign] = body.data;
    expect(campaign.roster.map((item: { isMine: boolean }) => item.isMine)).toEqual([true, false]);
    expect(campaign.characters).toHaveLength(1);
  });
});
