import { NextResponse } from "next/server";
import { heartAwakeningSchema, HeartAwakeningInput } from "@/lib/validators/character";
import { getNinerouterConfig, queryNinerouter } from "@/lib/server/ninerouter";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { rpgClasses, rpgRaces } from "@/lib/db/schema";

interface DbClassItem {
  id: string;
  name: string;
  description: string | null;
}

interface DbRaceItem {
  id: string;
  name: string;
  description: string | null;
}

interface AwakeningResponse {
  prophecy: string;
  attributes: {
    forca: number;
    destreza: number;
    vigor: number;
    inteligencia: number;
    empatia: number;
  };
  suggestedClass: string;
  suggestedRace?: string;
  suggestedTrait: string;
}

function calculateFallback(
  body: HeartAwakeningInput,
  dbClasses: DbClassItem[],
  dbRaces: DbRaceItem[]
): AwakeningResponse {
  // Base attributes: 8 each (total 40) + 8 bonus points = 48 total
  const attrs = {
    forca: 8,
    destreza: 8,
    vigor: 8,
    inteligencia: 8,
    empatia: 8,
  };

  // Chosen relic (+3 / +2 / +1)
  if (body.chosenRelic === "conflito") {
    attrs.forca += 3;
    attrs.vigor += 2;
    attrs.destreza += 1;
  } else if (body.chosenRelic === "salvaguarda") {
    attrs.vigor += 3;
    attrs.empatia += 2;
    attrs.forca += 1;
  } else if (body.chosenRelic === "segredo") {
    attrs.inteligencia += 3;
    attrs.destreza += 2;
    attrs.empatia += 1;
  }

  // q1Origin bonus (+1)
  if (body.q1Origin === "carta") {
    attrs.inteligencia += 1;
  } else if (body.q1Origin === "moeda") {
    attrs.empatia += 1;
  } else if (body.q1Origin === "amuleto") {
    attrs.vigor += 1;
  }

  // q2Impulse bonus (+1)
  if (body.q2Impulse === "colina") {
    attrs.forca += 1;
  } else if (body.q2Impulse === "floresta") {
    attrs.destreza += 1;
  } else if (body.q2Impulse === "mar") {
    attrs.empatia += 1;
  }

  // Determine highest attribute
  const highest = Object.entries(attrs).sort((a, b) => b[1] - a[1])[0][0];

  // Try to match registered DB class names prioritize DB classes
  let suggestedClass = "";
  if (dbClasses.length > 0) {
    const desiredKeyword =
      highest === "forca"
        ? ["guerreiro", "bárbaro", "paladino", "fighter", "barbarian"]
        : highest === "destreza"
        ? ["ladino", "patrulheiro", "caçador", "rogue", "ranger"]
        : highest === "vigor"
        ? ["guardião", "defensor", "guardian", "paladino"]
        : highest === "inteligencia"
        ? ["mago", "místico", "feiticeiro", "wizard", "sorcerer", "alquimista"]
        : ["bardo", "clérigo", "bard", "cleric"];

    const found = dbClasses.find((c) =>
      desiredKeyword.some((kw) => c.name.toLowerCase().includes(kw))
    );
    suggestedClass = found ? found.name : dbClasses[0].name;
  } else {
    if (highest === "forca") suggestedClass = "Guerreiro";
    else if (highest === "destreza") suggestedClass = "Ladino";
    else if (highest === "vigor") suggestedClass = "Guardião";
    else if (highest === "inteligencia") suggestedClass = "Mago";
    else if (highest === "empatia") suggestedClass = "Bardo";
  }

  // Pick suggested race prioritize DB races
  let suggestedRace: string | undefined = undefined;
  if (dbRaces.length > 0) {
    // Pick race based on q2Impulse or q1Origin
    const desiredRaceKeyword =
      body.q2Impulse === "floresta"
        ? ["elfo", "elf", "silvestre"]
        : body.q2Impulse === "colina"
        ? ["anão", "dwarf", "humano"]
        : ["humano", "human", "tritão", "marino"];

    const foundRace = dbRaces.find((r) =>
      desiredRaceKeyword.some((kw) => r.name.toLowerCase().includes(kw))
    );
    suggestedRace = foundRace ? foundRace.name : dbRaces[0].name;
  }

  // Deterministic poetic prophecy based on choices
  const originText =
    body.q1Origin === "carta"
      ? "Nascido sob o signo das palavras não ditas e cartas esquecidas"
      : body.q1Origin === "moeda"
      ? "Marcado pela troca do destino e pela moeda do viajante"
      : "Protegido por amuletos de eras ancestrais";

  const impulseText =
    body.q2Impulse === "colina"
      ? "teu espírito busca os picos inabaláveis sob o firmamento"
      : body.q2Impulse === "floresta"
      ? "teus passos ressoam nos segredos sussurrados pelas árvores"
      : "tua alma anseia pelas marés e pelo mistério dos abismos profundos";

  const endText =
    body.q3End === "luzes"
      ? "Guia-te pelas luzes distantes que cortam a escuridão da noite."
      : body.q3End === "cidade"
      ? "Encontrarás teu verdadeiro propósito entre as pedras e o ruído da cidade."
      : "Forjarás teu poder no fogo do rancor, transformando dor em força indomável.";

  const relicText = `Ao escolher o ${body.chosenRelic} e abrir mão do ${body.sacrificedRelic}, teu destino foi selado.`;

  const prophecy = `${originText}, ${impulseText}. ${relicText} ${endText}`;

  const suggestedTrait = `Despertar do Coração: Marcas do ${body.chosenRelic}`;

  return {
    prophecy,
    attributes: attrs,
    suggestedClass,
    suggestedRace,
    suggestedTrait,
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = heartAwakeningSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const inputData = parsed.data;

    // Fetch classes and races registered in DB
    const dbClasses: DbClassItem[] = await db
      .select({ id: rpgClasses.id, name: rpgClasses.name, description: rpgClasses.description })
      .from(rpgClasses);

    const dbRaces: DbRaceItem[] = await db
      .select({ id: rpgRaces.id, name: rpgRaces.name, description: rpgRaces.description })
      .from(rpgRaces);

    // Format classes and races for AI context
    const classesFormatted =
      dbClasses.length > 0
        ? dbClasses
            .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
            .join("\n")
        : "Nenhuma classe cadastrada no momento.";

    const racesFormatted =
      dbRaces.length > 0
        ? dbRaces.map((r) => `- ${r.name}`).join("\n")
        : "Nenhuma raça cadastrada no momento.";

    // Check if 9Router is configured
    const cfg = getNinerouterConfig();
    if (!cfg.hasKey) {
      logger.info("9Router não configurado ou sem chave. Usando fallback determinístico.");
      return NextResponse.json(calculateFallback(inputData, dbClasses, dbRaces));
    }

    const systemPrompt = `Você é o Oráculo do Despertar do Coração em um RPG de fantasia dark/misteriosa.
Sua missão é interpretar as escolhas sagradas do jogador e gerar uma profecia poética e a distribuição de atributos do personagem.

Classes Disponíveis no Sistema:
${classesFormatted}

Raças/Ancestralidades Disponíveis no Sistema:
${racesFormatted}

Regras de Saída (JSON estrito):
- "prophecy": string em português, poética, evocativa, de 3 a 5 frases, integrando a relíquia escolhida (${inputData.chosenRelic}), a relíquia sacrificada (${inputData.sacrificedRelic}), a origem (${inputData.q1Origin}), o impulso (${inputData.q2Impulse}) e o fim (${inputData.q3End}).
- "attributes": objeto JSON com exatamente 5 chaves ("forca", "destreza", "vigor", "inteligencia", "empatia"). Cada chave deve ter valor inteiro >= 8. A SOMA TOTAL DOS 5 ATRIBUTOS DEVE SER EXATAMENTE 48.
- "suggestedClass": DEVE obrigatoriamente ser o NOME EXATO de uma das classes listadas acima.
- "suggestedRace": (opcional) DEVE obrigatoriamente ser o NOME EXATO de uma das raças listadas acima, se aplicável ao conceito.
- "suggestedTrait": um traço único sugestivo (ex: "Olhar do Destino", "Coração Selado").

Retorne APENAS o JSON válido no seguinte formato:
{
  "prophecy": "...",
  "attributes": { "forca": 10, "destreza": 8, "vigor": 10, "inteligencia": 12, "empatia": 8 },
  "suggestedClass": "...",
  "suggestedRace": "...",
  "suggestedTrait": "..."
}`;

    const userPrompt = JSON.stringify(inputData);

    try {
      const aiResponseText = await queryNinerouter(systemPrompt, userPrompt, {
        responseFormatJson: true,
      });

      const jsonMatch = aiResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? aiResponseText;
      const parsedAi = JSON.parse(jsonMatch.trim()) as AwakeningResponse;

      // Validate attributes sum is exactly 48
      if (
        parsedAi.attributes &&
        typeof parsedAi.attributes.forca === "number" &&
        typeof parsedAi.attributes.destreza === "number" &&
        typeof parsedAi.attributes.vigor === "number" &&
        typeof parsedAi.attributes.inteligencia === "number" &&
        typeof parsedAi.attributes.empatia === "number"
      ) {
        const sum =
          parsedAi.attributes.forca +
          parsedAi.attributes.destreza +
          parsedAi.attributes.vigor +
          parsedAi.attributes.inteligencia +
          parsedAi.attributes.empatia;

        if (sum === 48 && parsedAi.prophecy && parsedAi.suggestedClass && parsedAi.suggestedTrait) {
          return NextResponse.json({
            prophecy: parsedAi.prophecy,
            attributes: {
              forca: parsedAi.attributes.forca,
              destreza: parsedAi.attributes.destreza,
              vigor: parsedAi.attributes.vigor,
              inteligencia: parsedAi.attributes.inteligencia,
              empatia: parsedAi.attributes.empatia,
            },
            suggestedClass: parsedAi.suggestedClass,
            ...(parsedAi.suggestedRace ? { suggestedRace: parsedAi.suggestedRace } : {}),
            suggestedTrait: parsedAi.suggestedTrait,
          });
        }
      }

      logger.warn("Soma de atributos da IA diferente de 48 ou formato inválido. Usando fallback.");
      return NextResponse.json(calculateFallback(inputData, dbClasses, dbRaces));
    } catch (aiErr) {
      logger.warn({ err: aiErr }, "Erro ao chamar IA 9Router no Despertar do Coração. Usando fallback.");
      return NextResponse.json(calculateFallback(inputData, dbClasses, dbRaces));
    }
  } catch (error) {
    logger.error({ err: error }, "Erro interno no endpoint de despertar");
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
