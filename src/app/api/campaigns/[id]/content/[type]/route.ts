// =============================================================================
// Libmork — API Route: Conteúdo de Campanha (RF-017, RF-018)
// =============================================================================
// GET: retorna conteúdo global (campaign_id NULL) + privado da campanha.
// POST: cria conteúdo privado (apenas o mestre da campanha).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, characters, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import {
  contentTypeSchema,
  getContentCreateValidator,
} from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
} from "@/lib/db/content-registry";
import { eq, and, isNull, or } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; type: string }> };

/**
 * Verifica se o usuário é mestre da campanha ou tem personagem vinculado.
 */
async function canViewCampaign(campaignId: string, userId: string): Promise<boolean> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return false;

  if (campaign.masterId === userId) return true;

  const [link] = await db
    .select()
    .from(characterCampaigns)
    .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
    .where(
      and(
        eq(characterCampaigns.campaignId, campaignId),
        eq(characters.ownerId, userId)
      )
    )
    .limit(1);

  return !!link;
}

/**
 * GET /api/campaigns/:id/content/:type
 * Lista conteúdo global + privado da campanha (RF-018).
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

    const { id, type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const allowed = await canViewCampaign(id, session.user.id);

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Você não participa desta campanha" },
        { status: 403 }
      );
    }

    const table = getContentTable(parsed.data);
    const campaignColumn = getContentCampaignColumn(parsed.data);

    // Global (campaign_id NULL) + privado desta campanha (RF-018)
    const result = await db
      .select()
      .from(table)
      .where(or(isNull(campaignColumn), eq(campaignColumn, id)));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar conteúdo da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/content/:type
 * Cria conteúdo privado da campanha (apenas o mestre).
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

    const { id, type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validator = getContentCreateValidator(parsed.data);
    const validation = validator.safeParse(body);

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

    const table = getContentTable(parsed.data);

    const [created] = await db
      .insert(table)
      .values({ ...validation.data, campaignId: id })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao criar conteúdo da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
