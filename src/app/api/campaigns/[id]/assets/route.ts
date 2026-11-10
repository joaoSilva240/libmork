// =============================================================================
// Libmork — API Route: Assets de Campanha (Issue #61)
// =============================================================================
// GET: Retorna todos os assets visuais da campanha (mestre ou jogador convidado).
// POST: Cria um novo asset da campanha (apenas mestre). Suporta multipart/form-data e application/json.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, campaignAssets } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { createCampaignAssetSchema } from "@/lib/validators/campaign-asset";
import { saveImage } from "@/lib/utils/uploads";
import { eq, and, asc, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

async function userCanAccessCampaign(campaignId: string, userId: string): Promise<boolean> {
  const [campaign] = await db
    .select({ masterId: campaigns.masterId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return false;
  if (campaign.masterId === userId) return true;

  const [invite] = await db
    .select({ id: campaignInvites.id })
    .from(campaignInvites)
    .where(
      and(
        eq(campaignInvites.campaignId, campaignId),
        eq(campaignInvites.userId, userId),
        eq(campaignInvites.revoked, false),
      ),
    )
    .limit(1);

  return !!invite;
}

/**
 * GET /api/campaigns/:id/assets
 * Retorna todos os assets visuais da campanha ordenados por posição e data de criação.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const hasAccess = await userCanAccessCampaign(campaignId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada ou acesso negado" },
        { status: 404 },
      );
    }

    const assets = await db
      .select()
      .from(campaignAssets)
      .where(eq(campaignAssets.campaignId, campaignId))
      .orderBy(asc(campaignAssets.position), desc(campaignAssets.createdAt));

    return NextResponse.json({
      success: true,
      data: assets,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar assets da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/campaigns/:id/assets
 * Cria um novo asset visual na campanha (apenas mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode adicionar assets à campanha" },
        { status: 403 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let rawInput: {
      name: unknown;
      description?: unknown;
      imageUrl?: unknown;
      category?: unknown;
      position?: unknown;
    };

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") || formData.get("image");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "Arquivo de imagem não enviado" },
          { status: 400 },
        );
      }

      let filename: string;
      try {
        filename = await saveImage(file, "campaigns/assets");
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Erro ao salvar imagem";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }

      const imageUrl = `/api/uploads/campaigns/assets/${filename}`;
      const rawPosition = formData.get("position");

      rawInput = {
        name: formData.get("name"),
        description: formData.get("description"),
        imageUrl,
        category: formData.get("category") || "handout",
        position:
          rawPosition !== null && rawPosition !== undefined && rawPosition !== ""
            ? Number(rawPosition)
            : 0,
      };
    } else {
      rawInput = await request.json().catch(() => ({}));
    }

    const validation = createCampaignAssetSchema.safeParse(rawInput);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const [newAsset] = await db
      .insert(campaignAssets)
      .values({
        campaignId,
        name: validation.data.name,
        description: validation.data.description ?? null,
        imageUrl: validation.data.imageUrl,
        category: validation.data.category,
        position: validation.data.position,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newAsset,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao criar asset da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
