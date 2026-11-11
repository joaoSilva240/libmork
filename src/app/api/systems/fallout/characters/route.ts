// =============================================================================
// Libmork — API Route: Personagens Fallout 2d20 (Listagem e Criação)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  createFalloutCharacterRecord,
  getFalloutCharactersByCampaign,
  getFalloutCharactersByUser,
} from "@/lib/server/fallout-service";
import { createFalloutCharacterSchema } from "@/lib/systems/fallout/validators";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    let characters;
    if (campaignId) {
      characters = await getFalloutCharactersByCampaign(campaignId);
    } else {
      characters = await getFalloutCharactersByUser(session.user.id);
    }

    return NextResponse.json({ success: true, data: characters });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar personagens" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createFalloutCharacterSchema.parse(body);

    const character = await createFalloutCharacterRecord(validated, session.user.id);

    return NextResponse.json({ success: true, data: character }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar personagem" },
      { status: 500 },
    );
  }
}
