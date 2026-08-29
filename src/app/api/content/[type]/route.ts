// =============================================================================
// Libmork — API Route: Biblioteca Global de Conteúdo (RF-016)
// =============================================================================
// Escopo global: campaign_id = NULL. Gerenciada por mestres (role=master).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import {
  contentTypeSchema,
  getContentCreateValidator,
  CONTENT_LABELS,
} from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
  getContentIdColumn,
} from "@/lib/db/content-registry";
import { isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ type: string }> };

/**
 * GET /api/content/:type
 * Lista o conteúdo global (campaign_id NULL) — qualquer usuário autenticado.
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

    const { type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const table = getContentTable(parsed.data);

    const result = await db
      .select()
      .from(table)
      .where(isNull(getContentCampaignColumn(parsed.data)))
      .orderBy(getContentIdColumn(parsed.data));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar conteúdo global');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/:type
 * Cria conteúdo global — apenas mestres (role=master).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar a biblioteca global" },
        { status: 403 }
      );
    }

    const { type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
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
      .values({ ...validation.data, campaignId: null })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`Erro ao criar ${CONTENT_LABELS.skills} global:`, error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}