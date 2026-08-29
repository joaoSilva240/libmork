// =============================================================================
// Libmork — API Route: Raças — Lista e Criação (Races & Ancestries)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createRaceSchema } from "@/lib/validators/race";
import { logger } from "@/lib/logger";

/**
 * GET /api/races
 * Lista todas as raças cadastradas na biblioteca global.
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

    const races = await db.select().from(rpgRaces).orderBy(rpgRaces.name);

    return NextResponse.json({
      success: true,
      data: races,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar raças");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/races
 * Cria uma nova raça na biblioteca (apenas mestres).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar raças" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createRaceSchema.safeParse(body);

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

    const {
      name,
      description,
      speed,
      size,
      hitPointsBonus,
      attributeBonuses,
      languages,
      traits,
      heritages,
      imageUrl,
      sourceSystem,
    } = validation.data;

    const [newRace] = await db
      .insert(rpgRaces)
      .values({
        name,
        description: description ?? null,
        speed,
        size,
        hitPointsBonus,
        attributeBonuses,
        languages,
        traits,
        heritages,
        imageUrl: imageUrl ?? null,
        sourceSystem: sourceSystem ?? "custom",
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newRace },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao criar raça");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
