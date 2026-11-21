// =============================================================================
// Libmork — API Route: Re-rolagem de um dado com Pontos de Sorte (Fallout 2d20)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { rerollFalloutDieWithLuck, FalloutServiceError } from "@/lib/server/fallout-service";
import { falloutRerollSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = falloutRerollSchema.parse(body);

    const result = await rerollFalloutDieWithLuck(validated, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof FalloutServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao re-rolar o dado" },
      { status: 500 },
    );
  }
}
