// =============================================================================
// Libmork — API Route: Detalhes de um Encontro
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, encounters, worlds, encounterParticipants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateEncounterSchema } from "@/lib/validators/encounter";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; encounterId: string }> };

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
 * GET /api/campaigns/:id/encounters/:encounterId
 * Retorna detalhes do encontro com participantes.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, encounterId } = await params;

    const encounter = await getEncounterWithAccess(id, encounterId, session.user.id);
    if (!encounter) {
      return NextResponse.json(
        { success: false, error: "Encontro não encontrado" },
        { status: 404 }
      );
    }

    const participants = await db
      .select()
      .from(encounterParticipants)
      .where(eq(encounterParticipants.encounterId, encounterId));

    return NextResponse.json({
      success: true,
      data: {
        ...encounter,
        participants,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar encontro:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campaigns/:id/encounters/:encounterId
 * Atualiza nome, descrição ou status ativo do encontro.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, encounterId } = await params;

    const encounter = await getEncounterWithAccess(id, encounterId, session.user.id);
    if (!encounter) {
      return NextResponse.json(
        { success: false, error: "Encontro não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateEncounterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    // Se estiver ativando este encontro, desativa outros do mesmo mundo
    if (validation.data.isActive === true) {
      await db
        .update(encounters)
        .set({ isActive: false })
        .where(eq(encounters.worldId, encounter.worldId));
    }

    const [updated] = await db
      .update(encounters)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(encounters.id, encounterId))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao atualizar encontro:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/:id/encounters/:encounterId
 * Remove um encontro.
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

    const { id, encounterId } = await params;

    const encounter = await getEncounterWithAccess(id, encounterId, session.user.id);
    if (!encounter) {
      return NextResponse.json(
        { success: false, error: "Encontro não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(encounters).where(eq(encounters.id, encounterId));

    return NextResponse.json({ success: true, message: "Encontro excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir encontro:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
