// =============================================================================
// Libmork — API Route: Convites de Campanha (RF-015)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, users, characterCampaigns, characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/invites
 * Lista o status de todos os jogadores para a campanha (apenas o mestre).
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

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    // Busca todos os usuários exceto o mestre da campanha
    const allPlayers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(ne(users.id, campaign.masterId))
      .orderBy(users.displayName);

    // Busca todos os convites ativos desta campanha
    const activeInvites = await db
      .select()
      .from(campaignInvites)
      .where(
        and(
          eq(campaignInvites.campaignId, id),
          eq(campaignInvites.revoked, false)
        )
      );

    const invitesByUserId = new Map<string, (typeof activeInvites)[0]>();
    for (const inv of activeInvites) {
      if (inv.userId) {
        invitesByUserId.set(inv.userId, inv);
      }
    }

    // Busca contagem de personagens ativos por jogador nesta campanha
    const campaignCharLinks = await db
      .select({
        ownerId: characters.ownerId,
        characterId: characters.id,
      })
      .from(characterCampaigns)
      .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
      .where(
        and(
          eq(characterCampaigns.campaignId, id),
          eq(characterCampaigns.approvalStatus, "approved")
        )
      );

    const charCountByUserId = new Map<string, number>();
    for (const link of campaignCharLinks) {
      const current = charCountByUserId.get(link.ownerId) || 0;
      charCountByUserId.set(link.ownerId, current + 1);
    }

    const playersData = allPlayers.map((player) => {
      const invite = invitesByUserId.get(player.id);
      return {
        id: player.id,
        displayName: player.displayName,
        email: player.email,
        isInvited: !!invite,
        inviteId: invite ? invite.id : null,
        activeCharactersCount: charCountByUserId.get(player.id) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: playersData,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar convites");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/invites
 * Convida um jogador (com userId) ou gera convite por token (apenas o mestre).
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

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    let userId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.userId === "string") {
        userId = body.userId;
      }
    } catch {
      // Body vazio é aceito para geração por token
    }

    if (userId) {
      // Verificar se o usuário existe e não é o mestre
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: "Jogador não encontrado" },
          { status: 404 }
        );
      }

      if (targetUser.id === campaign.masterId) {
        return NextResponse.json(
          { success: false, error: "O mestre não pode ser convidado para a própria campanha" },
          { status: 400 }
        );
      }

      // Verificar se já existe convite para este usuário
      const [existingInvite] = await db
        .select()
        .from(campaignInvites)
        .where(
          and(
            eq(campaignInvites.campaignId, id),
            eq(campaignInvites.userId, userId)
          )
        )
        .limit(1);

      if (existingInvite) {
        if (existingInvite.revoked) {
          const [reactivated] = await db
            .update(campaignInvites)
            .set({ revoked: false })
            .where(eq(campaignInvites.id, existingInvite.id))
            .returning();

          return NextResponse.json({
            success: true,
            data: reactivated,
          });
        }

        return NextResponse.json({
          success: true,
          data: existingInvite,
        });
      }

      const token = generateUrlSafeToken(32);
      const [newInvite] = await db
        .insert(campaignInvites)
        .values({
          campaignId: id,
          userId,
          token,
          revoked: false,
        })
        .returning();

      return NextResponse.json(
        {
          success: true,
          data: newInvite,
        },
        { status: 201 }
      );
    }

    // Geração de token genérico (legado)
    const token = generateUrlSafeToken(32);
    const [newInvite] = await db
      .insert(campaignInvites)
      .values({
        campaignId: id,
        token,
        revoked: false,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newInvite,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao gerar convite");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
