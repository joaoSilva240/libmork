// =============================================================================
// Libmork — API Route: Atualização da Cena e Ameaças (A Voz)
// =============================================================================

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { updateSceneThreats, handleApiError } from "@/lib/server/missing-service";
import { updateSceneSchema } from "@/lib/systems/missing/validators";
import type { MissingThreat } from "@/lib/systems/missing/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateSceneSchema.parse(body);

    const threatsWithId: MissingThreat[] = validated.threats.map((t) => ({
      id: t.id || randomUUID(),
      name: t.name,
      description: t.description,
      dangerLevel: t.dangerLevel,
    }));

    const updatedScene = await updateSceneThreats(
      id,
      session.user.id,
      validated.sceneTitle,
      threatsWithId,
    );

    return NextResponse.json({ success: true, data: updatedScene });
  } catch (error) {
    return handleApiError(error);
  }
}
