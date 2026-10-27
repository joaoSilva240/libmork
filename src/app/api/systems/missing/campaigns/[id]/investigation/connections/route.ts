// =============================================================================
// Libmork — API Route: Adicionar Conexão na Teia de Investigação
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { addInvestigationConnection, handleApiError } from "@/lib/server/missing-service";
import { createConnectionSchema } from "@/lib/systems/missing/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = createConnectionSchema.parse(body);

    const connection = await addInvestigationConnection(id, session.user.id, validated);

    return NextResponse.json({ success: true, data: connection }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
