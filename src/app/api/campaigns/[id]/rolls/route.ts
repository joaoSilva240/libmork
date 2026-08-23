// =============================================================================
// Libmork — API Route: Rolagens do Escudo do Mestre (RF-041)
// =============================================================================
// POST: exige uma rolagem de um personagem/NPC (registrada no log).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster, isNpcInCampaign } from "@/lib/auth/campaign-access";
import { createRollSchema } from "@/lib/validators/session";
import { createRollRequest } from "@/lib/server/session-actions";
import { db } from "@/lib/db";
import { characterCampaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/campaigns/:id/rolls
 * Exige uma rolagem de um personagem ou NPC da campanha.
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

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createRollSchema.safeParse(body);

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

    const { actorType, actorId } = validation.data;

    if (actorType === "character") {
      const [link] = await db
        .select()
        .from(characterCampaigns)
        .where(
          and(
            eq(characterCampaigns.campaignId, id),
            eq(characterCampaigns.characterId, actorId)
          )
        )
        .limit(1);

      if (!link) {
        return NextResponse.json(
          { success: false, error: "Personagem não está nesta campanha" },
          { status: 404 }
        );
      }
    } else {
      const belongs = await isNpcInCampaign(actorId, id);

      if (!belongs) {
        return NextResponse.json(
          { success: false, error: "NPC não pertence a esta campanha" },
          { status: 404 }
        );
      }
    }

    const log = await createRollRequest(id, session.user.id, validation.data);

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("Erro ao exigir rolagem:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
