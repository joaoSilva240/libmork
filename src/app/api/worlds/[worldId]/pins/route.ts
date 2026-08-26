// =============================================================================
// Libmork — API Route: Pins de Mapa Interativo (RF-068)
// =============================================================================
// Gerencia marcadores (pins) em mapas do mundo com persistência no banco.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, campaigns, mapPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { uuid } from "drizzle-orm/pg-core";

type RouteContext = { params: Promise<{ worldId: string }> };

async function isWorldMaster(worldId: string, userId: string): Promise<boolean> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world || !world.campaignId) return false;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return !!campaign && campaign.masterId === userId;
}

/**
 * GET /api/worlds/:worldId/pins
 * Retorna todos os pins salvos para o mundo.
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

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para acessar os pins deste mapa" },
        { status: 403 }
      );
    }

    // Verifica se o mundo existe e pertence à campanha
    const [world] = await db
      .select()
      .from(worlds)
      .where(eq(worlds.id, worldId))
      .limit(1);

    if (!world) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const pins = await db
      .select()
      .from(mapPins)
      .where(eq(mapPins.worldId, worldId))
      .orderBy(mapPins.createdAt);

    return NextResponse.json({
      success: true,
      data: pins,
    });
  } catch (error) {
    console.error("Erro ao listar pins do mapa:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worlds/:worldId/pins
 * Salva um array de pins no mapa.
 * Cada pin: { id: string, lat: number, lng: number, title: string, description: string }
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

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode gerenciar pins do mapa" },
        { status: 403 }
      );
    }

    // Verifica se o mundo existe
    const [world] = await db
      .select()
      .from(worlds)
      .where(eq(worlds.id, worldId))
      .limit(1);

    if (!world) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { pins } = body;

    if (!Array.isArray(pins)) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos: 'pins' deve ser um array" },
        { status: 400 }
      );
    }

    // Validação básica de cada pin
    const validatedPins = pins.map((pin) => {
      if (
        typeof pin.id !== "string" ||
        typeof pin.lat !== "number" ||
        typeof pin.lng !== "number" ||
        typeof pin.title !== "string" ||
        typeof pin.description !== "string"
      ) {
        throw new Error("Cada pin deve ter: id, lat, lng, title, description");
      }
      return {
        id: pin.id,
        worldId,
        lat: pin.lat,
        lng: pin.lng,
        title: pin.title,
        description: pin.description,
      };
    });

    // Delete existing pins and insert new ones
    await db.delete(mapPins).where(eq(mapPins.worldId, worldId));
    await db.insert(mapPins).values(validatedPins);

    return NextResponse.json({
      success: true,
      message: "Pins salvos com sucesso",
      data: validatedPins,
    });
  } catch (error) {
    console.error("Erro ao salvar pins do mapa:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao salvar pins: " + (error instanceof Error ? error.message : "Erro desconhecido") },
      { status: 500 }
    );
  }
}
