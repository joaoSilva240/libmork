// =============================================================================
// Libmork — Mapeamento central de motores de regras para rótulos e fluxos de UI
// =============================================================================

export type CreationSystem = "libmork" | "missing_zero" | "fallout_2d20";

/** Rótulo legível do motor de regras exibido em convites e detalhes de campanha. */
export function getRulesEngineLabel(engine: string): string {
  switch (engine) {
    case "d20_mod":
      return "d20 + modificador";
    case "dual_d20_sum":
      return "2d20 somado";
    case "missing_zero":
      return "MISSING — Edição ZERO";
    case "fallout_2d20":
      return "Fallout 2d20";
    default:
      return engine;
  }
}

/** Sistema de criação de ficha correspondente ao motor da campanha. */
export function getCreationSystem(engine: string): CreationSystem {
  if (engine === "missing_zero") return "missing_zero";
  if (engine === "fallout_2d20") return "fallout_2d20";
  return "libmork";
}

/** Termo usado para se referir às fichas daquele sistema (singular/plural). */
export function getCharacterNoun(engine: string): { singular: string; plural: string } {
  const system = getCreationSystem(engine);
  if (system === "missing_zero") return { singular: "habitante", plural: "habitantes" };
  if (system === "fallout_2d20") return { singular: "sobrevivente", plural: "sobreviventes" };
  return { singular: "personagem", plural: "personagens" };
}

/** Monta a URL de criação de ficha já direcionada ao sistema da campanha. */
export function getCharacterCreationHref(engine: string, campaignId?: string | null): string {
  const params = new URLSearchParams();
  params.set("system", getCreationSystem(engine));
  if (campaignId) params.set("campaignId", campaignId);
  return `/player/characters/new?${params.toString()}`;
}