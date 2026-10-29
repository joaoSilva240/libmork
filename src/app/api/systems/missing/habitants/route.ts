// =============================================================================
// Libmork — API Route: Habitantes Pessoais do Usuário (MISSING — Edição ZERO)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  createHabitant,
  getUserHabitants,
  handleApiError,
} from "@/lib/server/missing-service";
import { createHabitantSchema } from "@/lib/systems/missing/validators";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const habitants = await getUserHabitants(session.user.id);
    return NextResponse.json({ success: true, data: habitants });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createHabitantSchema.parse(body);

    const habitant = await createHabitant(
      validated.campaignId || null,
      session.user.id,
      validated,
    );

    return NextResponse.json({ success: true, data: habitant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
