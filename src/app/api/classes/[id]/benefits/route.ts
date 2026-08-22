// =============================================================================
// Libmork — API Route: Benefícios por Nível da Classe (RF-033, D-21)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createClassBenefitSchema } from "@/lib/validators/class";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/classes/:id/benefits
 * Lista benefícios por nível da classe.
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

    const [rpgClass] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!rpgClass) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const benefits = await db
      .select()
      .from(classLevelBenefits)
      .where(eq(classLevelBenefits.classId, id))
      .orderBy(classLevelBenefits.level);

    return NextResponse.json({
      success: true,
      data: benefits,
    });
  } catch (error) {
    console.error("Erro ao listar benefícios:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes/:id/benefits
 * Cria benefício por nível (apenas mestres).
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

    const [rpgClass] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!rpgClass) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createClassBenefitSchema.safeParse(body);

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

    const { level, benefits } = validation.data;

    // Verifica se já existe benefício para este nível
    const [existing] = await db
      .select()
      .from(classLevelBenefits)
      .where(
        and(eq(classLevelBenefits.classId, id), eq(classLevelBenefits.level, level))
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Já existe benefício para o nível ${level}` },
        { status: 409 }
      );
    }

    const [newBenefit] = await db
      .insert(classLevelBenefits)
      .values({
        classId: id,
        level,
        benefits,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newBenefit },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar benefício:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
