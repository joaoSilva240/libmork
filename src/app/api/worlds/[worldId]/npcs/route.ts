// =============================================================================
// Libmork — API Route: NPCs de um Mundo (RF-014, D-38)
// =============================================================================
// GET: mestre da campanha ou participante. POST/PATCH/DELETE: apenas mestre.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, worlds, campaigns, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createNpcSchema } from "@/lib/validators/npc";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string }> };

/**
 * Obtém a campanha dona do mundo e verifica o papel do usuário.
 * Retorna null se não encontrado.
 */
async function getWorldAndPermission(worldId: string, userId: string) {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world) return { world: null, allowed: false };

  // Mundo global (sem campanha associada diretamente) é acessível a usuários autenticados
  if (!world.campaignId) {
    return { world, allowed: true };
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  if (!campaign) return { world: null, allowed: false };

  return { world, allowed: campaign.masterId === userId };
}

/**
 * GET /api/worlds/:worldId/npcs
 * Lista NPCs do mundo.
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

    const { worldId } = await params;
    const { world, allowed } = await getWorldAndPermission(worldId, session.user.id);

    if (!world) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para acessar este mundo" },
        { status: 403 }
      );
    }

    const worldNpcs = await db
      .select()
      .from(npcs)
      .where(eq(npcs.worldId, worldId))
      .orderBy(npcs.createdAt);

    return NextResponse.json({
      success: true,
      data: worldNpcs,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar NPCs');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worlds/:worldId/npcs
 * Cria um novo NPC ou importa/multiplica um NPC existente na biblioteca para o mundo.
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

    const { worldId } = await params;
    const { world, allowed } = await getWorldAndPermission(worldId, session.user.id);

    if (!world) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para modificar este mundo" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Suporte para puxar NPC da biblioteca com quantidade customizada
    if (body.sourceNpcId) {
      const { sourceNpcId, quantity = 1 } = body;
      const safeQuantity = Math.max(1, Math.min(20, Number(quantity) || 1));

      const [sourceNpc] = await db.select().from(npcs).where(eq(npcs.id, sourceNpcId)).limit(1);

      if (!sourceNpc) {
        return NextResponse.json(
          { success: false, error: "NPC fonte não encontrado na biblioteca" },
          { status: 404 }
        );
      }

      // Buscar pino(s) associados ao NPC fonte
      const sourcePins = await db.select().from(npcPins).where(eq(npcPins.npcId, sourceNpcId));

      const createdNpcs = [];

      for (let i = 1; i <= safeQuantity; i++) {
        const instanceName = safeQuantity > 1 ? `${sourceNpc.name} #${i}` : sourceNpc.name;

        const [newInstance] = await db
          .insert(npcs)
          .values({
            name: instanceName,
            npcType: sourceNpc.npcType,
            worldId: worldId,
            ownerId: session.user.id,
            classId: sourceNpc.classId,
            hitPoints: sourceNpc.hitPoints,
            hitPointsMax: sourceNpc.hitPointsMax,
            manaPoints: sourceNpc.manaPoints,
            manaPointsMax: sourceNpc.manaPointsMax,
            attributes: sourceNpc.attributes,
            level: sourceNpc.level,
            xp: sourceNpc.xp,
            block: sourceNpc.block,
            imageUrl: sourceNpc.imageUrl,
            xpReward: sourceNpc.xpReward,
          })
          .returning();

        // Duplicar os pins para cada nova instância independente
        if (sourcePins.length > 0) {
          const newPinsValues = sourcePins.map((pin) => ({
            npcId: newInstance.id,
            pinType: pin.pinType,
            contentId: pin.contentId,
            label: pin.label,
            rollExpression: pin.rollExpression,
            manaCost: pin.manaCost,
            circle: pin.circle,
          }));

          await db.insert(npcPins).values(newPinsValues);
        }

        createdNpcs.push(newInstance);
      }

      return NextResponse.json(
        {
          success: true,
          data: safeQuantity === 1 ? createdNpcs[0] : createdNpcs,
          message: `${safeQuantity} instância(s) independente(s) do NPC adicionada(s) ao mundo.`,
        },
        { status: 201 }
      );
    }

    // Criação tradicional via formulário
    const validation = createNpcSchema.safeParse(body);

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

    const [newNpc] = await db
      .insert(npcs)
      .values({
        worldId,
        ...validation.data,
        imageUrl: validation.data.imageUrl ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newNpc,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar NPC');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}