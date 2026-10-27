// =============================================================================
// Libmork — API Route: Habitante Específico (GET, PATCH)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getHabitantById,
  updateHabitant,
  handleApiError,
} from "@/lib/server/missing-service";

type RouteContext = { params: Promise<{ id: string; habitantId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id, habitantId } = await params;
    const habitant = await getHabitantById(habitantId);

    if (!habitant || habitant.campaignId !== id) {
      return NextResponse.json(
        { success: false, error: "Habitante não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: habitant });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id, habitantId } = await params;
    const body = await request.json();
    const updated = await updateHabitant(id, habitantId, session.user.id, body);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
