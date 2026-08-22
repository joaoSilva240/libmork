// =============================================================================
// Libmork — API Route: NPCs de um Mundo (RF-014, D-38)
// =============================================================================
// GET: mestre da campanha ou participante. POST/PATCH/DELETE: apenas mestre.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, worlds, campaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createNpcSchema } from "@/lib/validators/npc";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ worldId: string }> };

/**
 * Obtém a campanha dona do mundo e verifica o papel do usuário.
 * Retorna null se não encontrado.
 */
async function getCampaignByWorld(worldId: string) {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world) return null;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return campaign ?? null;
}

/**
 * GET /api/worlds/:worldId/npcs
 * Lista NPCs do mundo.
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

    const { worldId } = await params;

    const campaign = await getCampaignByWorld(worldId);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    if (campaign.masterId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para acessar este mundo" },
        { status: 403 }
      );
    }

    const worldNpcs = await db
      .select()
      .from(npcs)
      .where(eq(npcs.worldId, worldId))
      .orderBy(npcs.createdAt);

    return NextResponse.json({
      success: true,
      data: worldNpcs,
    });
  } catch (error) {
    console.error("Erro ao listar NPCs:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worlds/:worldId/npcs
 * Cria um NPC no mundo (apenas o mestre da campanha).
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

    const { worldId } = await params;

    const campaign = await getCampaignByWorld(worldId);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    if (campaign.masterId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode criar NPCs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createNpcSchema.safeParse(body);

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

    const [newNpc] = await db
      .insert(npcs)
      .values({
        worldId,
        ...validation.data,
        imageUrl: validation.data.imageUrl ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newNpc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
