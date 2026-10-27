// =============================================================================
// Libmork — API Route: Rasurar Linha do Registro do Habitante
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { eraseHabitantLine, handleApiError } from "@/lib/server/missing-service";
import { eraseLineSchema } from "@/lib/systems/missing/validators";

type RouteContext = { params: Promise<{ id: string; habitantId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id, habitantId } = await params;
    const body = await request.json();
    const validated = eraseLineSchema.parse(body);

    const updated = await eraseHabitantLine(
      id,
      habitantId,
      session.user.id,
      validated.lineId,
      validated.reason,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
