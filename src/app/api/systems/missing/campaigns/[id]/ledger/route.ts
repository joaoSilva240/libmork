// =============================================================================
// Libmork — API Route: Consulta ao Livro-Razão (Action Ledger)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignLedger, handleApiError } from "@/lib/server/missing-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const events = await getCampaignLedger(id, session.user.id);

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return handleApiError(error);
  }
}
