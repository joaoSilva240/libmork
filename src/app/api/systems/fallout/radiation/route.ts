// =============================================================================
// Libmork — API Route: Medidor de Radiação do Escudo do Mestre (Fallout 2d20)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { applyFalloutRadiation, FalloutServiceError } from "@/lib/server/fallout-service";
import { applyFalloutRadiationSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = applyFalloutRadiationSchema.parse(body);

    const result = await applyFalloutRadiation(validated, session.user.id);

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
      { success: false, error: error.message || "Erro ao aplicar radiação" },
      { status: 500 },
    );
  }
}
