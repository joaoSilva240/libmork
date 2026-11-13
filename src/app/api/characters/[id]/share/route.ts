// =============================================================================
// Libmork — API Route: Links de Personagem (RF-023, RF-024, RNF-003, Issue #79)
// =============================================================================
// kind "view"    → visualização pública off-session (/public-sheet/:token)
// kind "acquire" → aquisição/clonagem autenticada (/characters/import/:token)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { characters, publicShareLinks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { issueShareLink, type ShareKind } from "@/lib/server/character-share-service";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const kindSchema = z.enum(["view", "acquire"]);

function parseKind(raw: string | null, fallback: ShareKind = "view"): ShareKind {
  const parsed = kindSchema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

function linkUrl(kind: ShareKind, token: string, base: string): string {
  return kind === "acquire"
    ? `${base}/characters/import/${token}`
    : `${base}/public-sheet/${token}`;
}

async function requireOwnedCharacter(id: string, userId: string) {
  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.ownerId, userId)))
    .limit(1);
  return character ?? null;
}

/**
 * GET /api/characters/:id/share?kind=view|acquire
 * Retorna o link ativo do tipo informado (apenas dono).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const kind = parseKind(request.nextUrl.searchParams.get("kind"));

    const character = await requireOwnedCharacter(id, session.user.id);
    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    const [activeLink] = await db
      .select()
      .from(publicShareLinks)
      .where(
        and(
          eq(publicShareLinks.characterId, id),
          eq(publicShareLinks.kind, kind),
          eq(publicShareLinks.revoked, false),
        ),
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
        url: linkUrl(kind, activeLink.token, baseUrl),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao obter link público");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/characters/:id/share
 * Gera um novo link do tipo informado (body { kind }). Revoga links
 * anteriores do mesmo tipo (RF-024).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Body é opcional — kind padrão "view"
    }
    const kindValidation = z
      .object({ kind: kindSchema.optional() })
      .safeParse(body && typeof body === "object" ? body : {});
    if (!kindValidation.success) {
      return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 });
    }
    const kind: ShareKind = kindValidation.data.kind ?? "view";

    const character = await requireOwnedCharacter(id, session.user.id);
    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    const newLink = await issueShareLink(id, kind);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newLink,
          url: linkUrl(kind, newLink.token, baseUrl),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao gerar link público");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/characters/:id/share?kind=view|acquire
 * Revoga o link ativo do tipo informado (RF-024).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const kind = parseKind(request.nextUrl.searchParams.get("kind"));

    const character = await requireOwnedCharacter(id, session.user.id);
    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 },
      );
    }

    await db
      .update(publicShareLinks)
      .set({ revoked: true })
      .where(
        and(
          eq(publicShareLinks.characterId, id),
          eq(publicShareLinks.kind, kind),
          eq(publicShareLinks.revoked, false),
        ),
      );

    return NextResponse.json({
      success: true,
      message: "Link público revogado com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao revogar link público");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
