// =============================================================================
// Libmork — API Route: Mundos Globais / Biblioteca
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createWorldSchema } from "@/lib/validators/campaign";
import { desc, isNull, eq, or } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/worlds
 * Lista todos os mundos globais e da biblioteca.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const campaignId = request.nextUrl.searchParams.get("campaignId");

    const condition = campaignId
      ? or(isNull(worlds.campaignId), eq(worlds.campaignId, campaignId))
      : undefined;

    const data = await db
      .select()
      .from(worlds)
      .where(condition)
      .orderBy(desc(worlds.createdAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar mundos');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * POST /api/worlds
 * Cria um novo mundo na biblioteca.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createWorldSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, coverUrl, mapUrl } = validation.data;

    const [newWorld] = await db
      .insert(worlds)
      .values({
        campaignId: body.campaignId || null,
        name,
        description: description ?? null,
        coverUrl: coverUrl ?? null,
        mapUrl: mapUrl ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: newWorld }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar mundo');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
