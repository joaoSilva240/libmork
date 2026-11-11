// =============================================================================
// Libmork — API Route: Execução de Dados de Combate (DC) de Fallout
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { executeCombatDiceRoll } from "@/lib/server/fallout-service";
import { combatDiceRollSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = combatDiceRollSchema.parse(body);

    const result = executeCombatDiceRoll(validated);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Erro na rolagem de combate" },
      { status: 500 },
    );
  }
}
