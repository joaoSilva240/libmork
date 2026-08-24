import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spells } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

const NINEROUTER_URL = process.env.NINEROUTER_URL || "http://100.83.170.1:20128/v1";
const NINEROUTER_MODEL = process.env.NINEROUTER_MODEL || "ollama/gpt-oss:120b";

type RouteContext = { params: Promise<{ spellId: string }> };

async function translateSpellWithLLM(spellData: {
  name: string;
  description: string;
  range: string | null;
  target: string | null;
  area: string | null;
  castingTime: string | null;
  damageType: string | null;
  duration: string | null;
  extraEffect: string | null;
}): Promise<any> {
  const ninerouterKey = process.env.NINEROUTER_KEY?.trim();
  if (!ninerouterKey) {
    throw new Error(
      "NINEROUTER_KEY precisa ser configurada no arquivo .env.local"
    );
  }

  const url = `${NINEROUTER_URL}/chat/completions`;
  const systemPrompt = `You are a translation assistant specialized in tabletop RPG systems, specifically Pathfinder 2nd Edition (PF2e).
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

  const userPrompt = JSON.stringify(spellData);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ninerouterKey}`,
    },
    body: JSON.stringify({
      model: NINEROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      stream: false
    }),
  });

  if (!response.ok) {
    let upstreamMessage = "Resposta sem mensagem do upstream";
    try {
      const responseText = await response.text();
      if (responseText.trim()) {
        upstreamMessage = responseText.trim();
      }
    } catch {
      // Mantém uma mensagem segura caso a leitura do corpo falhe.
    }

    throw new Error(
      `9Router API error: status ${response.status}; mensagem: ${upstreamMessage}`
    );
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from 9Router");
  }

  let cleanContent = content.trim();
  
  // Tenta extrair o bloco markdown do JSON (```json ... ``` ou ``` ... ```)
  const match = cleanContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanContent = match[1].trim();
  } else {
    // Caso não encontre um bloco de código par, remove backticks soltos do início/fim
    cleanContent = cleanContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  
  // Garantia adicional: extrai tudo que estiver entre o primeiro caractere JSON válido ({ ou [) e o último (} ou ])
  const firstBrace = cleanContent.indexOf("{");
  const firstBracket = cleanContent.indexOf("[");
  const startIdx = firstBrace !== -1 && firstBracket !== -1 
    ? Math.min(firstBrace, firstBracket) 
    : firstBrace !== -1 
    ? firstBrace 
    : firstBracket;

  const lastBrace = cleanContent.lastIndexOf("}");
  const lastBracket = cleanContent.lastIndexOf("]");
  const endIdx = lastBrace !== -1 && lastBracket !== -1
    ? Math.max(lastBrace, lastBracket)
    : lastBrace !== -1
    ? lastBrace
    : lastBracket;

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanContent = cleanContent.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleanContent);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { spellId } = await params;
    const [spell] = await db
      .select()
      .from(spells)
      .where(eq(spells.id, spellId))
      .limit(1);

    if (!spell) {
      return NextResponse.json(
        { success: false, error: "Magia não encontrada" },
        { status: 404 }
      );
    }

    if (spell.translation) {
      return NextResponse.json({
        success: true,
        translation: spell.translation,
      });
    }

    // Traduzir a magia
    const translation = await translateSpellWithLLM({
      name: spell.name,
      description: spell.description || "",
      range: spell.range,
      target: spell.target,
      area: spell.area,
      castingTime: spell.castingTime,
      damageType: spell.damageType,
      duration: spell.duration,
      extraEffect: spell.extraEffect,
    });

    // Atualizar no banco de dados
    await db
      .update(spells)
      .set({ translation })
      .where(eq(spells.id, spellId));

    return NextResponse.json({
      success: true,
      translation,
    });
  } catch (error) {
    console.error("Erro ao traduzir magia:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao traduzir magia via IA" },
      { status: 500 }
    );
  }
}
