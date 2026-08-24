import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster, isNpcInCampaign } from "@/lib/auth/campaign-access";
import { updateActorSchema } from "@/lib/validators/session";
import { applyCharacterUpdate, applyNpcUpdate } from "@/lib/server/session-actions";

type RouteContext = { params: Promise<{ id: string; actorId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  const { id: campaignId, actorId } = await params;
  const parsed = updateActorSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Dados inválidos", errors: parsed.error.issues }, { status: 400 });
  const [ownedCharacter] = await db.select({ id: characters.id }).from(characters).innerJoin(
    characterCampaigns,
    and(eq(characterCampaigns.characterId, characters.id), eq(characterCampaigns.campaignId, campaignId)),
  ).where(and(eq(characters.id, actorId), eq(characters.ownerId, session.user.id))).limit(1);
  if (ownedCharacter) {
    const result = await applyCharacterUpdate(campaignId, actorId, session.user.id, parsed.data);
    return NextResponse.json(result, { status: "error" in result ? 404 : 200 });
  }
  if (await getCampaignAsMaster(campaignId, session.user.id) && await isNpcInCampaign(actorId, campaignId)) {
    const result = await applyNpcUpdate(campaignId, actorId, session.user.id, parsed.data);
    return NextResponse.json(result, { status: "error" in result ? 404 : 200 });
  }
  // Se não for o mestre, verificar se é um jogador participante na campanha e se o ator é um NPC pertencente à campanha
  if (await isNpcInCampaign(actorId, campaignId)) {
    const [participantCharacter] = await db.select({ id: characters.id }).from(characters).innerJoin(
      characterCampaigns,
      and(eq(characterCampaigns.characterId, characters.id), eq(characterCampaigns.campaignId, campaignId))
    ).where(eq(characters.ownerId, session.user.id)).limit(1);

    if (participantCharacter) {
      const result = await applyNpcUpdate(campaignId, actorId, session.user.id, parsed.data);
      return NextResponse.json(result, { status: "error" in result ? 404 : 200 });
    }
  }
  return NextResponse.json({ success: false, error: "Ator não pertence à campanha ou sem permissão" }, { status: 403 });
}
