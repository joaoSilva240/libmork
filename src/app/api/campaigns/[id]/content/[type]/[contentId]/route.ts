// =============================================================================
// Libmork — API Route: Item de Conteúdo de Campanha (RF-017)
// =============================================================================
// PATCH e DELETE de conteúdo privado da campanha (apenas o mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import {
  contentTypeSchema,
  getContentUpdateValidator,
} from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
  getContentIdColumn,
} from "@/lib/db/content-registry";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; type: string; contentId: string }> };

/**
 * PATCH /api/campaigns/:id/content/:type/:contentId
 * Atualiza conteúdo privado da campanha (apenas o mestre).
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

    const { id, type, contentId } = await params;
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

    const table = getContentTable(parsed.data);

    const [existing] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(parsed.data), contentId),
          eq(getContentCampaignColumn(parsed.data), id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conteúdo não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validator = getContentUpdateValidator(parsed.data);
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

    const [updated] = await db
      .update(table)
      .set(validation.data)
      .where(eq(getContentIdColumn(parsed.data), contentId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar conteúdo da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/:id/content/:type/:contentId
 * Remove conteúdo privado da campanha (apenas o mestre).
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

    const { id, type, contentId } = await params;
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

    const table = getContentTable(parsed.data);

    const [existing] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(parsed.data), contentId),
          eq(getContentCampaignColumn(parsed.data), id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conteúdo não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(table).where(eq(getContentIdColumn(parsed.data), contentId));

    return NextResponse.json({
      success: true,
      message: "Conteúdo excluído com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao excluir conteúdo da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
