// =============================================================================
// Libmork — API Route: Conteúdo na Ficha do Personagem (RF-018, RF-008)
// =============================================================================
// GET: conteúdo vinculado + disponível (global + campanhas do personagem).
// POST: vincula conteúdo à ficha (apenas o dono).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns, characters, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { contentTypeSchema } from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
  getContentIdColumn,
  getJunctionTable,
  getJunctionContentColumn,
  getJunctionCharacterColumn,
  buildJunctionValues,
} from "@/lib/db/content-registry";
import { eq, and, isNull, or, inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; type: string }> };

async function canManageCharacterContent(characterId: string, userId: string): Promise<boolean> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!character) return false;

  if (character.ownerId === userId) return true;

  const [masterLink] = await db
    .select()
    .from(characterCampaigns)
    .innerJoin(campaigns, eq(characterCampaigns.campaignId, campaigns.id))
    .where(
      and(
        eq(characterCampaigns.characterId, characterId),
        eq(campaigns.masterId, userId)
      )
    )
    .limit(1);

  return !!masterLink;
}

const linkSchemas: Record<
  "skills" | "spells" | "items" | "conditions",
  z.ZodType<Record<string, unknown>>
> = {
  skills: z.object({
    contentId: z.string().uuid(),
    trained: z.boolean().default(false),
  }),
  spells: z.object({
    contentId: z.string().uuid(),
  }),
  items: z.object({
    contentId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  }),
  conditions: z.object({
    contentId: z.string().uuid(),
    permanent: z.boolean().default(false),
  }),
};

/**
 * GET /api/characters/:id/content/:type
 * Retorna vinculados e disponíveis (RF-018).
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

    const { id, type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const canManage = await canManageCharacterContent(id, session.user.id);

    if (!canManage) {
      return NextResponse.json(
        { success: false, error: "Sem permissão ou personagem não encontrado" },
        { status: 404 }
      );
    }

    const contentTable = getContentTable(parsed.data);
    const junctionTable = getJunctionTable(parsed.data);

    // Conteúdo vinculado à ficha (junção + conteúdo)
    const linked = await db
      .select({
        junction: junctionTable,
        content: contentTable,
      })
      .from(junctionTable)
      .innerJoin(
        contentTable,
        eq(getJunctionContentColumn(parsed.data), getContentIdColumn(parsed.data))
      )
      .where(eq(getJunctionCharacterColumn(parsed.data), id));

    // Campanhas do personagem
    const links = await db
      .select({ campaignId: characterCampaigns.campaignId })
      .from(characterCampaigns)
      .where(eq(characterCampaigns.characterId, id));

    const campaignIds = links.map((link) => link.campaignId);

    // Disponível: global + campanhas do personagem (RF-018)
    const available = await db
      .select()
      .from(contentTable)
      .where(
        campaignIds.length > 0
          ? or(
              isNull(getContentCampaignColumn(parsed.data)),
              inArray(getContentCampaignColumn(parsed.data), campaignIds)
            )
          : isNull(getContentCampaignColumn(parsed.data))
      );

    return NextResponse.json({
      success: true,
      data: { linked, available },
    });
  } catch (error) {
    console.error("Erro ao listar conteúdo da ficha:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/characters/:id/content/:type
 * Vincula conteúdo à ficha (apenas o dono).
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

    const { id, type } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const canManage = await canManageCharacterContent(id, session.user.id);

    if (!canManage) {
      return NextResponse.json(
        { success: false, error: "Sem permissão ou personagem não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validator = linkSchemas[parsed.data];
    const validation = validator.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const contentId = (validation.data as Record<string, unknown>).contentId as string;

    const contentTable = getContentTable(parsed.data);

    // Verifica se o conteúdo existe
    const [content] = await db
      .select()
      .from(contentTable)
      .where(eq(getContentIdColumn(parsed.data), contentId))
      .limit(1);

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Conteúdo não encontrado" },
        { status: 404 }
      );
    }

    // Verifica se o conteúdo é visível para o personagem (global ou das suas campanhas)
    const contentCampaignId = content.campaignId as string | null;

    if (contentCampaignId !== null) {
      const [link] = await db
        .select()
        .from(characterCampaigns)
        .where(
          and(
            eq(characterCampaigns.characterId, id),
            eq(characterCampaigns.campaignId, contentCampaignId)
          )
        )
        .limit(1);

      if (!link) {
        return NextResponse.json(
          {
            success: false,
            error: "Este conteúdo pertence a uma campanha da qual o personagem não participa",
          },
          { status: 403 }
        );
      }
    }

    const junctionTable = getJunctionTable(parsed.data);

    // Verifica se já está vinculado
    const [existingJunction] = await db
      .select()
      .from(junctionTable)
      .where(
        and(
          eq(getJunctionCharacterColumn(parsed.data), id),
          eq(getJunctionContentColumn(parsed.data), contentId)
        )
      )
      .limit(1);

    if (existingJunction) {
      return NextResponse.json(
        { success: false, error: "Conteúdo já vinculado à ficha" },
        { status: 409 }
      );
    }

    const junctionValues = buildJunctionValues(parsed.data, id, validation.data as Record<string, unknown>);

    const [createdJunction] = await db
      .insert(junctionTable)
      .values(junctionValues as never)
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: createdJunction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao vincular conteúdo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
