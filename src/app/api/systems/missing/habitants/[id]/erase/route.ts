// =============================================================================
// Libmork — API Route: Rasurar Linha do Habitante do Usuário (POST)
// Sistema MISSING — Edição ZERO
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getHabitantById,
  eraseHabitantLine,
  handleApiError,
} from "@/lib/server/missing-service";
import { eraseLineSchema } from "@/lib/systems/missing/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const habitant = await getHabitantById(id);

    if (!habitant || habitant.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Habitante não encontrado" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validated = eraseLineSchema.parse(body);

    const updated = await eraseHabitantLine(
      habitant.campaignId || null,
      id,
      session.user.id,
      validated.lineId,
      validated.reason,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
