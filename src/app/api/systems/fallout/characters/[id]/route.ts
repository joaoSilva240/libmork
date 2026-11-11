// =============================================================================
// Libmork — API Route: Detalhe e Edição de Personagem Fallout 2d20
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getFalloutCharacterById,
  updateFalloutCharacterRecord,
} from "@/lib/server/fallout-service";
import { updateFalloutCharacterSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const character = await getFalloutCharacterById(id);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: character });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar personagem" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateFalloutCharacterSchema.parse(body);

    const updated = await updateFalloutCharacterRecord(id, validated, session.user.id);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    const status = error.message === "Não autorizado" ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar personagem" },
      { status },
    );
  }
}
