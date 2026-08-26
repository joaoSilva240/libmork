// =============================================================================
// Libmork — API Route: Mundos de uma Campanha (RF-013)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createWorldSchema } from "@/lib/validators/campaign";
import { eq, and, or } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verifica se a campanha existe e pertence ao usuário.
 */
async function getOwnedCampaign(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.masterId, userId)))
    .limit(1);
  return campaign;
}

/**
 * GET /api/campaigns/:id/worlds
 * Lista os mundos de uma campanha (RF-013).
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

    const { id } = await params;

    const campaign = await getOwnedCampaign(id, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const campaignWorlds = await db
      .select()
      .from(worlds)
      .where(eq(worlds.campaignId, id))
      .orderBy(worlds.createdAt);

    return NextResponse.json({
      success: true,
      data: campaignWorlds,
    });
  } catch (error) {
    console.error("Erro ao listar mundos:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/worlds
 * Cria um mundo em uma campanha ou vincula um mundo existente (RF-013).
 * Body pode ser:
 * - { name, description?, coverUrl?, mapUrl? } → cria novo mundo
 * - { worldId } → vincula mundo existente à campanha
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

    const { id } = await params;

    const campaign = await getOwnedCampaign(id, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Verificar se é um pedido para vincular um mundo existente
    if (body.worldId) {
      const { worldId } = body;

      // Verificar se o mundo existe e é acessível (ou global ou do usuário)
      const [existingWorld] = await db
        .select()
        .from(worlds)
        .where(eq(worlds.id, worldId))
        .limit(1);

      if (!existingWorld) {
        return NextResponse.json(
          { success: false, error: "Mundo não encontrado" },
          { status: 404 }
        );
      }

      // Verificar se já está vinculado à campanha
      const [existingLink] = await db
        .select()
        .from(worlds)
        .where(and(eq(worlds.id, worldId), eq(worlds.campaignId, id)))
        .limit(1);

      if (existingLink) {
        return NextResponse.json(
          { success: false, error: "Este mundo já está vinculado à campanha" },
          { status: 409 }
        );
      }

      // Atualizar o mundo para vinculá-lo à campanha
      const [updatedWorld] = await db
        .update(worlds)
        .set({ campaignId: id })
        .where(eq(worlds.id, worldId))
        .returning();

      return NextResponse.json(
        {
          success: true,
          data: updatedWorld,
        },
        { status: 200 }
      );
    }

    // Caso contrário, criar um novo mundo
    const validation = createWorldSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { name, description, coverUrl, mapUrl } = validation.data;

    const [newWorld] = await db
      .insert(worlds)
      .values({
        campaignId: id,
        name,
        description: description ?? null,
        coverUrl: coverUrl ?? null,
        mapUrl: mapUrl ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newWorld,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao processar mundo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
