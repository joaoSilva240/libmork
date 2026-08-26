import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spells } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { extractErrorCode, getStatusForCode, TranslationErrorCode } from "@/lib/server/ninerouter";

type RouteContext = { params: Promise<{ spellId: string }> };

/**
 * Spell-specific system prompt for precise terminology translation.
 * Maintains PF2e structural terminology mapping.
 */
const SPELL_SYSTEM_PROMPT = `You are a translation assistant specialized in tabletop RPG systems, specifically Pathfinder 2nd Edition (PF2e).
Your task is to translate the provided spell details from English to Portuguese (pt-BR).
You MUST keep the terminology structure of Pathfinder 2e (for example: "saving throw" -> "salvamento", "reflex" -> "reflexos", "fortitude" -> "fortitude", "will" -> "vontade", "basic reflex" -> "reflexo básico", "heightened" -> "graduação", "action" -> "ação", etc.).

You must respond with a JSON object containing the translated values for the following fields:
- name
- description
- range
- target
- area
- castingTime
- damageType
- duration
- extraEffect

Keep the formatting clean and preserve any game mechanics accurately. Do not add any conversational text or explanation outside the JSON object.`;

export async function POST(request: NextRequest, { params }: RouteContext) {
  const start = Date.now();
  let spellIdForLog = "unknown";

  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado", code: "unauthenticated" },
        { status: 401 }
      );
    }

    const { spellId } = await params;
    spellIdForLog = spellId;

    const [spell] = await db.select().from(spells).where(eq(spells.id, spellId)).limit(1);

    if (!spell) {
      return NextResponse.json(
        { success: false, error: "Magia não encontrada", code: "not_found" },
        { status: 404 }
      );
    }

    if (spell.translation) {
      return NextResponse.json({
        success: true,
        translation: spell.translation,
      });
    }

    // Normalize spell data for translation
    const spellForTranslation = {
      name: spell.name,
      description: spell.description || "",
      range: spell.range,
      target: spell.target,
      area: spell.area,
      castingTime: spell.castingTime,
      damageType: spell.damageType,
      duration: spell.duration,
      extraEffect: spell.extraEffect,
    };

    const translation = await translateContentWithLLM("spell", spellForTranslation, SPELL_SYSTEM_PROMPT);

    await db.update(spells).set({ translation }).where(eq(spells.id, spellId));

    const durationMs = Date.now() - start;
    console.log(`[translateSpell] spellId=${spellId} durationMs=${durationMs} success`);

    return NextResponse.json({ success: true, translation });

  } catch (error) {
    const durationMs = Date.now() - start;
    const err = error as { code?: string; status?: number; message?: string; causeCode?: string };
    const rawCode = err?.code ?? extractErrorCode(error);
    const isTranslationCode = typeof rawCode === "string" && rawCode.startsWith("translation_provider_");
    const mappedCode: TranslationErrorCode = isTranslationCode ? (rawCode as TranslationErrorCode) : "translation_provider_unreachable";

    // Determine HTTP status code
    let status = isTranslationCode ? getStatusForCode(mappedCode) : 502;

    // Truncate details for safety (never expose KEY)
    const details = (err?.message || "").slice(0, 500);

    // Log error with granular code
    if (status >= 500) {
      console.error(
        `[translateSpell] spellId=${spellIdForLog} durationMs=${durationMs} error.code=${mappedCode} ` +
        `cause=${err?.causeCode || ""} status=${status} details=${details.slice(0, 200)}`
      );
    } else {
      console.warn(
        `[translateSpell] spellId=${spellIdForLog} durationMs=${durationMs} error.code=${mappedCode} status=${status}`
      );
    }

    // Build client-facing error message
    let clientError: string = mappedCode;
    if (mappedCode.startsWith("translation_provider_http_")) {
      const snippet = details.includes(":") ? details.split(":").slice(1).join(":").trim().slice(0, 200) : "";
      clientError = `${mappedCode}: ${snippet}`;
    }

    return NextResponse.json(
      { success: false, error: clientError, code: mappedCode, details: details.slice(0, 500) },
      { status }
    );
  }
}