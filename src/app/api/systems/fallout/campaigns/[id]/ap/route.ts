// =============================================================================
// Libmork — API Route: AP Pool da Campanha Fallout 2d20 (GET e PATCH)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getOrCreateFalloutCampaignState,
  updateFalloutCampaignState,
} from "@/lib/server/fallout-service";
import { updateFalloutCampaignStateSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const state = await getOrCreateFalloutCampaignState(campaignId);

    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar AP pool" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const validated = updateFalloutCampaignStateSchema.parse(body);

    const updated = await updateFalloutCampaignState(campaignId, validated);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar AP pool" },
      { status: 500 },
    );
  }
}
