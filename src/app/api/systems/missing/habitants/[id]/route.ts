// =============================================================================
// Libmork — API Route: Habitante Individual do Usuário (GET, PATCH, DELETE)
// Sistema MISSING — Edição ZERO
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getHabitantById,
  updateHabitant,
  deleteHabitant,
  handleApiError,
} from "@/lib/server/missing-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
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

    const { id } = await params;
    const habitant = await getHabitantById(id);

    if (!habitant || habitant.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Habitante não encontrado" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const updated = await updateHabitant(
      habitant.campaignId || null,
      id,
      session.user.id,
      body,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    await deleteHabitant(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Habitante excluído com sucesso",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
