const NINEROUTER_URL = process.env.NINEROUTER_URL || "http://100.83.170.1:20128/v1";
const NINEROUTER_MODEL = process.env.NINEROUTER_MODEL || "ollama/gpt-oss:120b";

export async function translateContentWithLLM(
  contentType: "spell" | "item",
  content: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const key = process.env.NINEROUTER_KEY?.trim();
  if (!key) throw new Error("translation_provider_unconfigured");

  const subject = contentType === "item" ? "item SF2e/PF2e" : "magia PF2e";
  const prompt = `Translate this tabletop RPG ${subject} from English to Brazilian Portuguese. Return JSON only, preserving the same fields. Translate name, description, and all relevant textual fields. Preserve technical SF2e/PF2e terms, numbers, formulas, units, proper names, and structured data. Do not add fields or commentary.`;
  const response = await fetch(`${NINEROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: NINEROUTER_MODEL,
      messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify(content) }],
      response_format: { type: "json_object" },
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`translation_provider_http_${response.status}`);
  const result = await response.json();
  const raw = result?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("translation_provider_empty");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? raw;
  return JSON.parse(fenced.trim()) as Record<string, unknown>;
}
