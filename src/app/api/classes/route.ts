// =============================================================================
// Libmork — API Route: Classes — Lista (RF-033, D-21)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createClassSchema } from "@/lib/validators/class";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const classes = await db.select().from(rpgClasses).orderBy(rpgClasses.name);

    return NextResponse.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar classes');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

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
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createClassSchema.safeParse(body);

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

    const { name, description, initialItems, proficiencies, levelBenefits } = validation.data;

    const newClass = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rpgClasses)
        .values({
          name,
          description: description ?? null,
          initialItems,
          proficiencies,
        })
        .returning();

      if (levelBenefits && levelBenefits.length > 0) {
        const benefitRows = levelBenefits.map((lb) => ({
          classId: created.id,
          level: lb.level,
          benefits: lb.benefits,
        }));
        await tx.insert(classLevelBenefits).values(benefitRows);
      }

      return created;
    });

    return NextResponse.json(
      { success: true, data: newClass },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar classe');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
