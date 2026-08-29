// =============================================================================
// Libmork — API Route: Listar e Criar Personagens (RF-006)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createCharacterSchema } from "@/lib/validators/character";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/characters
 * Lista todos os personagens do usuário autenticado.
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

    const userCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.ownerId, session.user.id));

    return NextResponse.json({
      success: true,
      data: userCharacters,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar personagens');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/characters
 * Cria um novo personagem para o usuário autenticado.
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

    const body = await request.json();
    const validation = createCharacterSchema.safeParse(body);

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

    const { name, classId, imageUrl, attributes } = validation.data;

    // Criar personagem com valores padrão
    const [newCharacter] = await db
      .insert(characters)
      .values({
        ownerId: session.user.id,
        name,
        classId: classId || null,
        imageUrl: imageUrl || null,
        attributes: attributes || {
          forca: 8,
          destreza: 8,
          vigor: 8,
          inteligencia: 8,
          empatia: 8,
        },
        hitPointsMax: 15,
        hitPointsCurrent: 15,
        manaPointsMax: 5,
        manaPointsCurrent: 5,
        block: 0,
        level: 1,
        xp: 0,
        deathStatus: "alive",
        deathSuccesses: 0,
        deathFailures: 0,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newCharacter,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar personagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
