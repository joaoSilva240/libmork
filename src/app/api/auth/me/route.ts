// =============================================================================
// Libmork — API Route: Sessão Atual
// =============================================================================

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        shadowPoints: session.user.shadowPoints,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar sessão:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
