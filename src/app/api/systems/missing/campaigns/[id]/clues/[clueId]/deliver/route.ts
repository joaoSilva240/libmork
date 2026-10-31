// =============================================================================
// Libmork — API Route: Entrega de Pista a um Habitante (A Voz)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { deliverClue, handleApiError } from "@/lib/server/missing-service";
import { deliverClueSchema } from "@/lib/systems/missing/validators";

type RouteContext = { params: Promise<{ id: string; clueId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id, clueId } = await params;
    const body = await request.json().catch(() => ({}));
    const validated = deliverClueSchema.parse(body);

    const clue = await deliverClue(
      id,
      session.user.id,
      clueId,
      validated.targetHabitantId ?? null,
    );

    return NextResponse.json({ success: true, data: clue });
  } catch (error) {
    return handleApiError(error);
  }
}
