// =============================================================================
// Libmork — API Route: Duplicar Classe da Biblioteca
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/classes/:id/duplicate
 * Duplica uma classe e todos os seus benefícios por nível.
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
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const originalBenefits = await db
      .select()
      .from(classLevelBenefits)
      .where(eq(classLevelBenefits.classId, id))
      .orderBy(classLevelBenefits.level);

    const createdClass = await db.transaction(async (tx) => {
      const [duplicate] = await tx
        .insert(rpgClasses)
        .values({
          name: `${existing.name} (cópia)`,
          description: existing.description,
          initialItems: existing.initialItems,
          proficiencies: existing.proficiencies,
        })
        .returning();

      if (originalBenefits.length > 0) {
        const duplicatedBenefits = originalBenefits.map((b) => ({
          classId: duplicate.id,
          level: b.level,
          benefits: b.benefits,
        }));

        await tx.insert(classLevelBenefits).values(duplicatedBenefits);
      }

      return duplicate;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Classe duplicada com sucesso",
        data: createdClass,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao duplicar classe");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
