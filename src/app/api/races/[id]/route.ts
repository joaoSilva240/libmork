// =============================================================================
// Libmork — API Route: Raça Individual (GET, PATCH, DELETE)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateRaceSchema } from "@/lib/validators/race";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/races/:id
 * Retorna os detalhes de uma raça específica.
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

    const [existing] = await db
      .select()
      .from(rpgRaces)
      .where(eq(rpgRaces.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Raça não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: existing,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao buscar raça");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/races/:id
 * Atualiza uma raça (apenas mestres).
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
        { success: false, error: "Apenas mestres podem gerenciar raças" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(rpgRaces)
      .where(eq(rpgRaces.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Raça não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateRaceSchema.safeParse(body);

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
      .update(rpgRaces)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(rpgRaces.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar raça");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/races/:id
 * Remove uma raça (apenas mestres).
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
        { success: false, error: "Apenas mestres podem gerenciar raças" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(rpgRaces)
      .where(eq(rpgRaces.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Raça não encontrada" },
        { status: 404 }
      );
    }

    await db.delete(rpgRaces).where(eq(rpgRaces.id, id));

    return NextResponse.json({
      success: true,
      message: "Raça excluída com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao excluir raça");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
