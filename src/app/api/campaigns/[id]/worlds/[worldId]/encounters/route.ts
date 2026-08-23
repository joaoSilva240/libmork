// =============================================================================
// Libmork — API Route: Encontros de um Mundo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, worlds, encounters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createEncounterSchema } from "@/lib/validators/encounter";
import { eq, and, desc } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; worldId: string }> };

async function getOwnedCampaign(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.masterId, userId)))
    .limit(1);
  return campaign;
}

/**
 * GET /api/campaigns/:id/worlds/:worldId/encounters
 * Lista os encontros de um mundo.
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

    const { id, worldId } = await params;

    const campaign = await getOwnedCampaign(id, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const world = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, worldId), eq(worlds.campaignId, id)))
      .limit(1);

    if (world.length === 0) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const data = await db
      .select()
      .from(encounters)
      .where(eq(encounters.worldId, worldId))
      .orderBy(desc(encounters.createdAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Erro ao listar encontros:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/worlds/:worldId/encounters
 * Cria um encontro em um mundo.
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

    const { id, worldId } = await params;

    const campaign = await getOwnedCampaign(id, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const world = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, worldId), eq(worlds.campaignId, id)))
      .limit(1);

    if (world.length === 0) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createEncounterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    const [newEncounter] = await db
      .insert(encounters)
      .values({
        worldId,
        name: validation.data.name,
        description: validation.data.description ?? null,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newEncounter },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar encontro:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
