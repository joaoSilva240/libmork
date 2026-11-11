// =============================================================================
// Libmork — API Route: Entrar na Campanha via Convite (RF-015)
// =============================================================================
// POST /api/invites/:token/join — jogador autenticado vincula uma ficha do mesmo
// sistema da campanha: d20 (characterCampaigns), MISSING (habitante) ou
// Fallout 2d20 (sobrevivente).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  campaigns,
  characters,
  characterCampaigns,
  campaignInvites,
  missingHabitants,
  missingActionLedger,
  falloutCharacters,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

const joinSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * POST /api/invites/:token/join
 * Jogador autenticado vincula uma de suas fichas à campanha do convite.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { token } = await params;

    const [invite] = await db
      .select()
      .from(campaignInvites)
      .where(and(eq(campaignInvites.token, token), eq(campaignInvites.revoked, false)))
      .limit(1);

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Convite inválido ou revogado" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validation = joinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { characterId } = validation.data;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, invite.campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 },
      );
    }

    const isMaster = campaign.masterId === session.user.id;

    // MISSING — Edição ZERO: vincula o habitante via campaignId
    if (campaign.rulesEngine === "missing_zero") {
      const [habitant] = await db
        .select()
        .from(missingHabitants)
        .where(
          and(eq(missingHabitants.id, characterId), eq(missingHabitants.ownerId, session.user.id)),
        )
        .limit(1);

      if (!habitant) {
        return NextResponse.json(
          { success: false, error: "Habitante não encontrado" },
          { status: 404 },
        );
      }

      if (habitant.campaignId === campaign.id) {
        return NextResponse.json(
          { success: false, error: "Este habitante já participa da campanha" },
          { status: 409 },
        );
      }

      await db
        .update(missingHabitants)
        .set({ campaignId: campaign.id, updatedAt: new Date() })
        .where(eq(missingHabitants.id, habitant.id));

      await db.insert(missingActionLedger).values({
        campaignId: campaign.id,
        habitantId: habitant.id,
        actorRole: isMaster ? "voice" : "writer",
        actorId: session.user.id,
        eventType: "system",
        payload: {
          message: `Habitante ${habitant.name} chegou à campanha.`,
          habitantId: habitant.id,
          habitantName: habitant.name,
        },
      });

      return NextResponse.json(
        { success: true, data: { habitantId: habitant.id, campaignId: campaign.id } },
        { status: 201 },
      );
    }

    // Fallout 2d20: vincula o sobrevivente via campaignId
    if (campaign.rulesEngine === "fallout_2d20") {
      const [falloutCharacter] = await db
        .select()
        .from(falloutCharacters)
        .where(
          and(eq(falloutCharacters.id, characterId), eq(falloutCharacters.ownerId, session.user.id)),
        )
        .limit(1);

      if (!falloutCharacter) {
        return NextResponse.json(
          { success: false, error: "Sobrevivente não encontrado" },
          { status: 404 },
        );
      }

      if (falloutCharacter.campaignId === campaign.id) {
        return NextResponse.json(
          { success: false, error: "Este sobrevivente já participa da campanha" },
          { status: 409 },
        );
      }

      await db
        .update(falloutCharacters)
        .set({ campaignId: campaign.id, updatedAt: new Date() })
        .where(eq(falloutCharacters.id, falloutCharacter.id));

      return NextResponse.json(
        { success: true, data: { characterId: falloutCharacter.id, campaignId: campaign.id } },
        { status: 201 },
      );
    }

    // d20 (d20_mod / dual_d20_sum): characters + characterCampaigns
    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    // Verifica se o personagem já está vinculado
    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.characterId, characterId),
          eq(characterCampaigns.campaignId, invite.campaignId),
        ),
      )
      .limit(1);

    if (existingLink) {
      return NextResponse.json(
        { success: false, error: "Este personagem já participa da campanha" },
        { status: 409 },
      );
    }

    const [newLink] = await db
      .insert(characterCampaigns)
      .values({
        characterId,
        campaignId: invite.campaignId,
        origin: "invited",
        approvalStatus: "approved",
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newLink,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao entrar na campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}