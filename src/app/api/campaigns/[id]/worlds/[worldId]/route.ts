// =============================================================================
// Libmork — API Route: Operações em Mundo Específico (RF-013)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createWorldSchema } from "@/lib/validators/campaign";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; worldId: string }> };

/**
 * PATCH /api/campaigns/:id/worlds/:worldId
 * Atualiza um mundo de uma campanha.
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

    const { id, worldId } = await params;

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

    const [existingWorld] = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, worldId), eq(worlds.campaignId, id)))
      .limit(1);

    if (!existingWorld) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createWorldSchema.partial().safeParse(body);

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

    const [updatedWorld] = await db
      .update(worlds)
      .set(validation.data)
      .where(eq(worlds.id, worldId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedWorld,
    });
  } catch (error) {
    console.error("Erro ao atualizar mundo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/:id/worlds/:worldId
 * Exclui um mundo de uma campanha.
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

    const { id, worldId } = await params;

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

    const [existingWorld] = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, worldId), eq(worlds.campaignId, id)))
      .limit(1);

    if (!existingWorld) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(worlds).where(eq(worlds.id, worldId));

    return NextResponse.json({
      success: true,
      message: "Mundo excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir mundo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
