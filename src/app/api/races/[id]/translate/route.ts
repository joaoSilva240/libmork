// =============================================================================
// Libmork — API Route: Tradução de Raça via IA (9Router)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { extractErrorCode, getStatusForCode, TranslationErrorCode } from "@/lib/server/ninerouter";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const RACE_SYSTEM_PROMPT = `Você é um tradutor especialista em RPG de mesa (Pathfinder 2e, D&D 5e e fantasia medieval).
Sua tarefa é traduzir as informações da raça/ancestralidade fornecida de Inglês para Português do Brasil (pt-BR).
Mantenha a coerência terminológica de RPG (ex: darkvision -> visão no escuro, heritage -> herança/linhagem, trait -> traço racial, size -> tamanho).

Você DEVE responder com um objeto JSON contendo exatamente os mesmos campos estruturais:
- name: string
- description: string
- size: string
- languages: string[]
- traits: Array<{ name: string, description?: string }>
- heritages: Array<{ name: string, description?: string }>

Retorne estritamente o JSON sem comentários adicionais.`;

export async function POST(request: NextRequest, { params }: RouteContext) {
  const start = Date.now();
  let raceIdForLog = "unknown";

  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado", code: "unauthenticated" },
        { status: 401 }
      );
    }

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem traduzir raças", code: "forbidden" },
        { status: 403 }
      );
    }

    const { id } = await params;
    raceIdForLog = id;

    const [existingRace] = await db
      .select()
      .from(rpgRaces)
      .where(eq(rpgRaces.id, id))
      .limit(1);

    if (!existingRace) {
      return NextResponse.json(
        { success: false, error: "Raça não encontrada", code: "not_found" },
        { status: 404 }
      );
    }

    const traits = (existingRace.traits as Array<{ name: string; description?: string }>) || [];
    const heritages = (existingRace.heritages as Array<{ name: string; description?: string }>) || [];
    const languages = (existingRace.languages as string[]) || [];

    const payloadToTranslate = {
      name: existingRace.name,
      description: existingRace.description || "",
      size: existingRace.size,
      languages,
      traits: traits.map((t) => ({
        name: t.name,
        description: t.description || "",
      })),
      heritages: heritages.map((h) => ({
        name: h.name,
        description: h.description || "",
      })),
    };

    const translated = await translateContentWithLLM("race", payloadToTranslate, RACE_SYSTEM_PROMPT);

    let finalName = existingRace.name;
    let finalDescription = existingRace.description;
    let finalSize = existingRace.size;
    let finalLanguages = languages;
    let finalTraits = traits;
    let finalHeritages = heritages;

    if (typeof translated.name === "string" && translated.name) {
      finalName = translated.name;
    }
    if (typeof translated.description === "string") {
      finalDescription = translated.description;
    }
    if (typeof translated.size === "string" && translated.size) {
      finalSize = translated.size;
    }
    if (Array.isArray(translated.languages)) {
      finalLanguages = (translated.languages as unknown[])
        .filter((l): l is string => typeof l === "string" && Boolean(l));
    }
    if (Array.isArray(translated.traits)) {
      finalTraits = (translated.traits as Array<{ name?: string; description?: string }>).map((t, idx) => ({
        name: t.name || traits[idx]?.name || "Traço Racial",
        description: t.description ?? traits[idx]?.description ?? "",
      }));
    }
    if (Array.isArray(translated.heritages)) {
      finalHeritages = (translated.heritages as Array<{ name?: string; description?: string }>).map((h, idx) => ({
        name: h.name || heritages[idx]?.name || "Herança",
        description: h.description ?? heritages[idx]?.description ?? "",
      }));
    }

    const [updatedRace] = await db
      .update(rpgRaces)
      .set({
        name: finalName,
        description: finalDescription,
        size: finalSize,
        languages: finalLanguages,
        traits: finalTraits,
        heritages: finalHeritages,
        updatedAt: new Date(),
      })
      .where(eq(rpgRaces.id, id))
      .returning();

    const durationMs = Date.now() - start;
    logger.info(`[translateRace] raceId=${raceIdForLog} durationMs=${durationMs} success`);

    return NextResponse.json({
      success: true,
      message: "Raça traduzida com sucesso!",
      data: updatedRace,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    const err = error as { code?: string; status?: number; message?: string; causeCode?: string };
    const rawCode = err?.code ?? extractErrorCode(error);
    const isTranslationCode = typeof rawCode === "string" && rawCode.startsWith("translation_provider_");
    const mappedCode: TranslationErrorCode = isTranslationCode ? (rawCode as TranslationErrorCode) : "translation_provider_unreachable";

    const status = isTranslationCode ? getStatusForCode(mappedCode) : 502;
    const details = (err?.message || "").slice(0, 500);

    logger.error(
      `[translateRace] raceId=${raceIdForLog} durationMs=${durationMs} error.code=${mappedCode} status=${status} details=${details.slice(0, 200)}`
    );

    return NextResponse.json(
      {
        success: false,
        error: `Erro ao traduzir raça: ${mappedCode}`,
        code: mappedCode,
        details: details.slice(0, 500),
      },
      { status }
    );
  }
}
