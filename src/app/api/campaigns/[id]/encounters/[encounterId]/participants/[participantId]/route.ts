// =============================================================================
// Libmork — API Route: Remover Participante de Encontro
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, encounters, worlds, encounterParticipants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; encounterId: string; participantId: string }> };

async function getOwnedCampaign(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.masterId, userId)))
    .limit(1);
  return campaign;
}

async function getEncounterWithAccess(campaignId: string, encounterId: string, userId: string) {
  const campaign = await getOwnedCampaign(campaignId, userId);
  if (!campaign) return null;

  const [encounter] = await db
    .select()
    .from(encounters)
    .where(eq(encounters.id, encounterId))
    .limit(1);

  if (!encounter) return null;

  const [world] = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, encounter.worldId), eq(worlds.campaignId, campaignId)))
    .limit(1);

  if (!world) return null;

  return encounter;
}

/**
 * DELETE /api/campaigns/:id/encounters/:encounterId/participants/:participantId
 * Remove um participante do encontro.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, encounterId, participantId } = await params;

    const encounter = await getEncounterWithAccess(id, encounterId, session.user.id);
    if (!encounter) {
      return NextResponse.json(
        { success: false, error: "Encontro não encontrado" },
        { status: 404 }
      );
    }

    const [participant] = await db
      .select()
      .from(encounterParticipants)
      .where(
        and(
          eq(encounterParticipants.id, participantId),
          eq(encounterParticipants.encounterId, encounterId)
        )
      )
      .limit(1);

    if (!participant) {
      return NextResponse.json(
        { success: false, error: "Participante não encontrado" },
        { status: 404 }
      );
    }

    await db
      .delete(encounterParticipants)
      .where(eq(encounterParticipants.id, participantId));

    return NextResponse.json({ success: true, message: "Participante removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover participante:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
