// =============================================================================
// Libmork — API Route: Execução de Rolagem de Teste (Padrão ou Forçado)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { executeTestRoll, handleApiError } from "@/lib/server/missing-service";
import { testRollSchema } from "@/lib/systems/missing/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = testRollSchema.parse(body);

    const result = await executeTestRoll(id, session.user.id, validated);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
