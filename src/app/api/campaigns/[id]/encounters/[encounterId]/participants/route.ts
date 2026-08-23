// =============================================================================
// Libmork — API Route: Participantes de um Encontro
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, encounters, worlds, encounterParticipants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { addParticipantSchema } from "@/lib/validators/encounter";
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
 * GET /api/campaigns/:id/encounters/:encounterId/participants
 * Lista participantes do encontro.
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

    return NextResponse.json({ success: true, data: participants });
  } catch (error) {
    console.error("Erro ao listar participantes:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/encounters/:encounterId/participants
 * Adiciona um participante ao encontro.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const validation = addParticipantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    // Verifica se já existe
    const existing = await db
      .select()
      .from(encounterParticipants)
      .where(
        and(
          eq(encounterParticipants.encounterId, encounterId),
          eq(encounterParticipants.actorType, validation.data.actorType),
          eq(encounterParticipants.actorId, validation.data.actorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Participante já está no encontro" },
        { status: 400 }
      );
    }

    const [participant] = await db
      .insert(encounterParticipants)
      .values({
        encounterId,
        actorType: validation.data.actorType,
        actorId: validation.data.actorId,
        initiative: validation.data.initiative ?? null,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: participant },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao adicionar participante:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
