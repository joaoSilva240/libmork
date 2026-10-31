// =============================================================================
// Libmork — API Route: Habitantes da Campanha MISSING
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  createHabitant,
  getHabitants,
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
    const habitants = await getHabitants(id);

    return NextResponse.json({ success: true, data: habitants });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const habitant = await createHabitant(id, session.user.id, body);

    return NextResponse.json({ success: true, data: habitant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
