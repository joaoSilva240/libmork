// =============================================================================
// Libmork — API Route: Associação NFC do Personagem (RF-021, RF-022, RF-024)
// =============================================================================
// Gera URL NDEF, lista etiquetas ativas e revoga associações.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, nfcTags } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/:id/nfc
 * Retorna a etiqueta NFC ativa do personagem (apenas dono).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const [activeTag] = await db
      .select()
      .from(nfcTags)
      .where(and(eq(nfcTags.characterId, id), eq(nfcTags.active, true)))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: activeTag ?? null,
    });
  } catch (error) {
    console.error("Erro ao obter NFC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/characters/:id/nfc
 * Associa uma nova etiqueta NFC (URL NDEF) — revoga anteriores (RF-024).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    // Revoga associações ativas anteriores
    await db
      .update(nfcTags)
      .set({ active: false })
      .where(and(eq(nfcTags.characterId, id), eq(nfcTags.active, true)));

    // Gera token de alta entropia para a URL NDEF (RNF-003)
    const token = generateUrlSafeToken(32);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const ndefUrl = `${baseUrl}/nfc/${token}`;

    const [newTag] = await db
      .insert(nfcTags)
      .values({
        characterId: id,
        ndefUrl,
        active: true,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newTag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao associar NFC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/characters/:id/nfc
 * Revoga a associação NFC ativa (RF-024).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    await db
      .update(nfcTags)
      .set({ active: false })
      .where(and(eq(nfcTags.characterId, id), eq(nfcTags.active, true)));

    return NextResponse.json({
      success: true,
      message: "Associação NFC revogada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao revogar NFC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
