// =============================================================================
// Libmork — API Route: Execução de Rolagem 2d20 de Fallout
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { executeFalloutRoll } from "@/lib/server/fallout-service";
import { falloutRollSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = falloutRollSchema.parse(body);

    const result = executeFalloutRoll(validated);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Erro na rolagem" },
      { status: 500 },
    );
  }
}
