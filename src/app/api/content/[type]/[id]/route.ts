// =============================================================================
// Libmork — API Route: Item Global da Biblioteca (RF-016)
// =============================================================================
// GET (autenticado), PATCH e DELETE (apenas mestres).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ type: string; id: string }> };

/**
 * GET /api/content/:type/:id
 * Obtém um item global da biblioteca.
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

    const { type, id } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const table = getContentTable(parsed.data);

    const [content] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(parsed.data), id),
          isNull(getContentCampaignColumn(parsed.data))
        )
      )
      .limit(1);

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Conteúdo não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter conteúdo global');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/content/:type/:id
 * Atualiza um item global da biblioteca (apenas mestres).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar a biblioteca global" },
        { status: 403 }
      );
    }

    const { type, id } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const table = getContentTable(parsed.data);

    const [existing] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(parsed.data), id),
          isNull(getContentCampaignColumn(parsed.data))
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
      .where(eq(getContentIdColumn(parsed.data), id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar conteúdo global');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/:type/:id
 * Remove um item global da biblioteca (apenas mestres).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar a biblioteca global" },
        { status: 403 }
      );
    }

    const { type, id } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const table = getContentTable(parsed.data);

    const [existing] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(parsed.data), id),
          isNull(getContentCampaignColumn(parsed.data))
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conteúdo não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(table).where(eq(getContentIdColumn(parsed.data), id));

    return NextResponse.json({
      success: true,
      message: "Conteúdo excluído com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao excluir conteúdo global');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}