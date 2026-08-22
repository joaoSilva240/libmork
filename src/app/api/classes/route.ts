// =============================================================================
// Libmork — API Route: Classes — Lista (RF-033, D-21)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createClassSchema } from "@/lib/validators/class";

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
    console.error("Erro ao listar classes:", error);
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

    const { name, description, initialItems, proficiencies } = validation.data;

    const [newClass] = await db
      .insert(rpgClasses)
      .values({
        name,
        description: description ?? null,
        initialItems,
        proficiencies,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newClass },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar classe:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
