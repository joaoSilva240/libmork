// =============================================================================
// Libmork — API Route: Tradução de Classe via IA (9Router)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import type { InitialItem, Proficiencies, ClassLevelBenefit } from "@/types";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { extractErrorCode, getStatusForCode, TranslationErrorCode } from "@/lib/server/ninerouter";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const CLASS_SYSTEM_PROMPT = `Você é um tradutor especialista em RPG de mesa (Pathfinder 2e, D&D 5e e fantasia medieval).
Sua tarefa é traduzir as informações da classe de personagem fornecida de Inglês para Português do Brasil (pt-BR).
Mantenha a coerência terminológica de RPG (ex: saving throw -> teste de resistência, spell -> magia, feat -> talento, skill -> perícia).

Você DEVE responder com um objeto JSON contendo exatamente os mesmos campos estruturais:
- name: string
- description: string
- proficiencies: { weapons: string[], armor: string[], languages: string[], tools: string[] }
- initialItems: Array<{ name: string, quantity: number, description: string }>
- benefits: Array<{ level: number, advantages?: string[], description?: string }>

Retorne estritamente o JSON sem comentários adicionais.`;

export async function POST(request: NextRequest, { params }: RouteContext) {
  const start = Date.now();
  let classIdForLog = "unknown";

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
        { success: false, error: "Apenas mestres podem traduzir classes", code: "forbidden" },
        { status: 403 }
      );
    }

    const { id } = await params;
    classIdForLog = id;

    const [existingClass] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!existingClass) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada", code: "not_found" },
        { status: 404 }
      );
    }

    const rawBenefits = await db
      .select()
      .from(classLevelBenefits)
      .where(eq(classLevelBenefits.classId, id))
      .orderBy(classLevelBenefits.level);

    const initialItems = (existingClass.initialItems as unknown as InitialItem[]) || [];
    const proficiencies = (existingClass.proficiencies as unknown as Proficiencies) || {};

    const payloadToTranslate = {
      name: existingClass.name,
      description: existingClass.description || "",
      proficiencies: proficiencies,
      initialItems: initialItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        description: item.description || "",
      })),
      benefits: rawBenefits.map((b) => {
        const benefitData = (b.benefits as unknown as ClassLevelBenefit) || {};
        return {
          level: b.level,
          advantages: benefitData.advantages || [],
          description: benefitData.description || "",
        };
      }),
    };

    const translated = await translateContentWithLLM("class", payloadToTranslate, CLASS_SYSTEM_PROMPT);

    let finalName = existingClass.name;
    let finalDescription = existingClass.description;
    let finalProficiencies = proficiencies;
    let finalInitialItems = initialItems;

    if (typeof translated.name === "string" && translated.name) {
      finalName = translated.name;
    }
    if (typeof translated.description === "string") {
      finalDescription = translated.description;
    }
    if (translated.proficiencies && typeof translated.proficiencies === "object") {
      const tp = translated.proficiencies as Record<string, unknown>;
      finalProficiencies = {
        weapons: Array.isArray(tp.weapons) ? (tp.weapons as string[]) : proficiencies.weapons,
        armor: Array.isArray(tp.armor) ? (tp.armor as string[]) : proficiencies.armor,
        languages: Array.isArray(tp.languages) ? (tp.languages as string[]) : proficiencies.languages,
        tools: Array.isArray(tp.tools) ? (tp.tools as string[]) : proficiencies.tools,
      };
    }
    if (Array.isArray(translated.initialItems)) {
      finalInitialItems = (translated.initialItems as Array<{ name?: string; quantity?: number; description?: string }>).map((item, idx) => ({
        item_id: initialItems[idx]?.item_id || null,
        name: item.name || initialItems[idx]?.name || "Item",
        quantity: Number(item.quantity) || initialItems[idx]?.quantity || 1,
        description: item.description ?? initialItems[idx]?.description ?? "",
      }));
    }

    const [updatedClass] = await db
      .update(rpgClasses)
      .set({
        name: finalName,
        description: finalDescription,
        proficiencies: finalProficiencies,
        initialItems: finalInitialItems,
      })
      .where(eq(rpgClasses.id, id))
      .returning();

    // Atualiza benefícios de nível
    if (Array.isArray(translated.benefits) && rawBenefits.length > 0) {
      const transBenefits = translated.benefits as Array<{ level?: number; advantages?: string[]; description?: string }>;
      for (let i = 0; i < rawBenefits.length; i++) {
        const current = rawBenefits[i];
        const tb = transBenefits.find((b) => b.level === current.level) || transBenefits[i];
        if (tb) {
          const currentBenefitsObj = (current.benefits as unknown as ClassLevelBenefit) || {};
          const newBenefitsObj: ClassLevelBenefit = {
            ...currentBenefitsObj,
            advantages: Array.isArray(tb.advantages) ? tb.advantages : currentBenefitsObj.advantages,
            description: typeof tb.description === "string" ? tb.description : currentBenefitsObj.description,
          };
          await db
            .update(classLevelBenefits)
            .set({ benefits: newBenefitsObj })
            .where(eq(classLevelBenefits.id, current.id));
        }
      }
    }

    const updatedBenefits = await db
      .select()
      .from(classLevelBenefits)
      .where(eq(classLevelBenefits.classId, id))
      .orderBy(classLevelBenefits.level);

    const durationMs = Date.now() - start;
    logger.info(`[translateClass] classId=${classIdForLog} durationMs=${durationMs} success`);

    return NextResponse.json({
      success: true,
      message: "Classe traduzida com sucesso!",
      data: updatedClass,
      benefits: updatedBenefits,
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
      `[translateClass] classId=${classIdForLog} durationMs=${durationMs} error.code=${mappedCode} status=${status} details=${details.slice(0, 200)}`
    );

    return NextResponse.json(
      {
        success: false,
        error: `Erro ao traduzir classe: ${mappedCode}`,
        code: mappedCode,
        details: details.slice(0, 500),
      },
      { status }
    );
  }
}
