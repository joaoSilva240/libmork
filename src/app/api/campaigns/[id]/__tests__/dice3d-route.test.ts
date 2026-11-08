import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { POST as createCampaign } from "@/app/api/campaigns/route";
import { GET as getPlayerCampaignDetails } from "@/app/api/player/campaigns/[id]/details/route";
import { GET as getPlayerCampaigns } from "@/app/api/player/campaigns/route";

vi.mock("@/lib/server/chat-service", () => ({
  ensureCampaignChatGroup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function createFluentQuery(resolvedValue: any) {
  const query: any = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
  };
  return query;
}

describe("Dice 3D Toggles API Routes (Issue #74)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/campaigns/[id] with Dice 3D Toggles", () => {
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

  describe("GET /api/player/campaigns/[id]/details with Dice 3D Toggles", () => {
    it("returns dice3dPlayersEnabled and dice3dMasterEnabled for joined player", async () => {
      (requireAuth as any).mockResolvedValue({
        user: { id: "user-player", email: "player@test.com" },
      });

      const mockMembership = {
        id: "camp-1",
        activeAssetId: null,
        dice3dPlayersEnabled: false,
        dice3dMasterEnabled: true,
      };

      (db.select as any)
        .mockReturnValueOnce(createFluentQuery([mockMembership])) // membership query
        .mockReturnValueOnce(createFluentQuery([])) // worlds
        .mockReturnValueOnce(createFluentQuery([])) // establishments
        .mockReturnValueOnce(createFluentQuery([])); // npcs

      const request = new Request("http://localhost:3000/api/player/campaigns/camp-1/details");
      const response = await getPlayerCampaignDetails(request, {
        params: Promise.resolve({ id: "camp-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dice3dPlayersEnabled).toBe(false);
      expect(data.data.dice3dMasterEnabled).toBe(true);
    });

    it("returns dice3d toggles for campaign master when checking details", async () => {
      (requireAuth as any).mockResolvedValue({
        user: { id: "user-master", email: "master@test.com" },
      });

      const mockMasterCampaign = {
        id: "camp-1",
        activeAssetId: null,
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: false,
      };

      (db.select as any)
        .mockReturnValueOnce(createFluentQuery([])) // no membership invite
        .mockReturnValueOnce(createFluentQuery([mockMasterCampaign])) // campaignAsMaster
        .mockReturnValueOnce(createFluentQuery([])) // worlds
        .mockReturnValueOnce(createFluentQuery([])) // establishments
        .mockReturnValueOnce(createFluentQuery([])); // npcs

      const request = new Request("http://localhost:3000/api/player/campaigns/camp-1/details");
      const response = await getPlayerCampaignDetails(request, {
        params: Promise.resolve({ id: "camp-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dice3dPlayersEnabled).toBe(true);
      expect(data.data.dice3dMasterEnabled).toBe(false);
    });
  });

  describe("GET /api/player/campaigns with Dice 3D Toggles", () => {
    it("returns dice3dPlayersEnabled and dice3dMasterEnabled in player campaign list", async () => {
      (requireAuth as any).mockResolvedValue({
        user: { id: "user-player", email: "player@test.com" },
      });

      const mockInvites = [{ campaignId: "camp-1" }];
      const mockCampaigns = [
        {
          id: "camp-1",
          name: "Mesa 1",
          description: "Desc",
          rulesEngine: "mork_borg",
          pvpEnabled: false,
          coverImageUrl: null,
          worldMapUrl: null,
          theme: "default-dark",
          dice3dPlayersEnabled: false,
          dice3dMasterEnabled: true,
          masterId: "user-master",
          masterDisplayName: "Master Name",
          masterEmail: "master@test.com",
        },
      ];

      (db.select as any)
        .mockReturnValueOnce(createFluentQuery(mockInvites)) // invites
        .mockReturnValueOnce(createFluentQuery(mockCampaigns)) // campaigns
        .mockReturnValueOnce(createFluentQuery([])); // allCampaignCharacters

      const response = await getPlayerCampaigns();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].dice3dPlayersEnabled).toBe(false);
      expect(data.data[0].dice3dMasterEnabled).toBe(true);
    });
  });

  describe("POST /api/campaigns with Dice 3D Toggles overrides", () => {
    it("persists dice3dPlayersEnabled and dice3dMasterEnabled overrides when creating a campaign", async () => {
      (requireAuth as any).mockResolvedValue({
        user: { id: "user-master", email: "master@test.com" },
      });

      let insertedValues: any = null;
      (db.insert as any).mockReturnValue({
        values: vi.fn((vals: any) => {
          insertedValues = vals;
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "camp-new-1",
                ...vals,
              },
            ]),
          };
        }),
      });

      const request = new NextRequest("http://localhost:3000/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Campanha Custom 3D",
          dice3dPlayersEnabled: false,
          dice3dMasterEnabled: false,
        }),
      });

      const response = await createCampaign(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(insertedValues.dice3dPlayersEnabled).toBe(false);
      expect(insertedValues.dice3dMasterEnabled).toBe(false);
    });
  });
});
