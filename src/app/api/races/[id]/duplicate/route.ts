// =============================================================================
// Libmork — API Route: Duplicar Raça da Biblioteca
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/races/:id/duplicate
 * Duplica uma raça existente na biblioteca.
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

    const [duplicate] = await db
      .insert(rpgRaces)
      .values({
        name: `${existing.name} (cópia)`,
        description: existing.description,
        speed: existing.speed,
        size: existing.size,
        hitPointsBonus: existing.hitPointsBonus,
        attributeBonuses: existing.attributeBonuses,
        languages: existing.languages,
        traits: existing.traits,
        heritages: existing.heritages,
        imageUrl: existing.imageUrl,
        sourceSystem: existing.sourceSystem,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Raça duplicada com sucesso",
        data: duplicate,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao duplicar raça");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
