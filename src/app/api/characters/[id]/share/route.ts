// =============================================================================
// Libmork — API Route: Link Público de Personagem (RF-023, RF-024, RNF-003)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, publicShareLinks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/:id/share
 * Retorna o link público ativo do personagem (apenas dono).
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

    const [activeLink] = await db
      .select()
      .from(publicShareLinks)
      .where(
        and(eq(publicShareLinks.characterId, id), eq(publicShareLinks.revoked, false))
      )
      .limit(1);

    if (!activeLink) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json({
      success: true,
      data: {
        ...activeLink,
        url: `${baseUrl}/public-sheet/${activeLink.token}`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter link público');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/characters/:id/share
 * Gera um novo link público. Revoga links anteriores (RF-024).
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

    // Revoga links ativos anteriores
    await db
      .update(publicShareLinks)
      .set({ revoked: true })
      .where(
        and(
          eq(publicShareLinks.characterId, id),
          eq(publicShareLinks.revoked, false)
        )
      );

    // Gera novo link com token de alta entropia (RNF-003)
    const token = generateUrlSafeToken(32);

    const [newLink] = await db
      .insert(publicShareLinks)
      .values({
        characterId: id,
        token,
        revoked: false,
      })
      .returning();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newLink,
          url: `${baseUrl}/public-sheet/${newLink.token}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao gerar link público');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/characters/:id/share
 * Revoga o link público ativo (RF-024).
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
      .update(publicShareLinks)
      .set({ revoked: true })
      .where(
        and(
          eq(publicShareLinks.characterId, id),
          eq(publicShareLinks.revoked, false)
        )
      );

    return NextResponse.json({
      success: true,
      message: "Link público revogado com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao revogar link público');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}