// =============================================================================
// Libmork — API Route: Listar e Criar Campanhas (RF-012)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createCampaignSchema } from "@/lib/validators/campaign";
import { eq } from "drizzle-orm";

/**
 * GET /api/campaigns
 * Lista as campanhas em que o usuário é mestre (RF-012).
 */
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const userCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.masterId, session.user.id))
      .orderBy(campaigns.createdAt);

    return NextResponse.json({
      success: true,
      data: userCampaigns,
    });
  } catch (error) {
    console.error("Erro ao listar campanhas:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns
 * Cria uma nova campanha, definindo o usuário como mestre (RF-012).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createCampaignSchema.safeParse(body);

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

    const { name, rulesEngine, pvpEnabled, difficultyModifierShadowPoints } =
      validation.data;

    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        masterId: session.user.id,
        name,
        rulesEngine,
        pvpEnabled,
        difficultyModifierShadowPoints,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newCampaign,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar campanha:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
