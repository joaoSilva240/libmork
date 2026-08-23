// =============================================================================
// Libmork — API Route: Catálogo Completo de Monstros D&D 5e (334 Monstros)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

/**
 * GET /api/npcs/dnd-catalog
 * Retorna a lista completa dos 334 monstros do D&D 5e API (dnd5eapi.co/api/monsters).
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const res = await fetch("https://www.dnd5eapi.co/api/monsters", {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Erro ao consultar API D&D 5e" }, { status: 500 });
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      count: data.count,
      results: data.results, // Array de { index, name, url }
    });
  } catch (error) {
    console.error("Erro ao carregar catálogo D&D 5e:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
