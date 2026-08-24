import { db } from "@/lib/db";
import { campaigns, campaignInvites } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type PublicInvite = {
  campaignId: string;
  campaignName: string;
  rulesEngine: string;
  pvpEnabled: boolean;
};

export type PublicInviteResult =
  | { invite: PublicInvite; error: null }
  | { invite: null; error: "invalid" | "campaign-not-found" };

/** Consults the public invite using the same validity rules for pages and API. */
export async function getPublicInvite(token: string): Promise<PublicInviteResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return { invite: null, error: "invalid" };
  }

  const [invite] = await db
    .select()
    .from(campaignInvites)
    .where(and(eq(campaignInvites.token, normalizedToken), eq(campaignInvites.revoked, false)))
    .limit(1);

  if (!invite) {
    return { invite: null, error: "invalid" };
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, invite.campaignId))
    .limit(1);

  if (!campaign) {
    return { invite: null, error: "campaign-not-found" };
  }

  return {
    error: null,
    invite: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      rulesEngine: campaign.rulesEngine,
      pvpEnabled: campaign.pvpEnabled,
    },
  };
}
