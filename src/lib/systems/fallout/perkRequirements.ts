import { getFalloutAttributeShortLabel } from "./rules";
import type { FalloutAttribute } from "./types";

const REQUIREMENT_TOKEN_ATTRIBUTES: Record<string, FalloutAttribute> = {
  STR: "str",
  FOR: "str",
  PER: "per",
  END: "end",
  RES: "end",
  CHA: "cha",
  CAR: "cha",
  INT: "int",
  AGI: "agi",
  LUC: "luc",
  LCK: "luc",
  SOR: "luc",
};

const REQUIREMENT_TOKENS = /\b(STR|FOR|PER|END|RES|CHA|CAR|INT|AGI|LUC|LCK|SOR)\b/gi;
const REQUIREMENT_MINIMUMS =
  /\b(STR|FOR|PER|END|RES|CHA|CAR|INT|AGI|LUC|LCK|SOR|Level|Nível|Nivel)\s*(\d+)/gi;

/** Atributos S.P.E.C.I.A.L. citados no texto de requisitos (grafias PT e EN). */
export function getPerkRequirementAttributes(
  requirements: string | null | undefined,
): FalloutAttribute[] {
  if (!requirements) return [];
  const found = new Set<FalloutAttribute>();
  for (const match of requirements.matchAll(REQUIREMENT_TOKENS)) {
    const attribute = REQUIREMENT_TOKEN_ATTRIBUTES[match[1].toUpperCase()];
    if (attribute) found.add(attribute);
  }
  return [...found];
}

/** Parcelas não atendidas do requisito, em PT-BR, para o aviso informativo em âmbar. */
export function getUnmetPerkRequirements(
  requirements: string | null | undefined,
  attributes: Record<FalloutAttribute, number>,
  level: number,
): string[] {
  if (!requirements) return [];
  const unmet: string[] = [];
  for (const match of requirements.matchAll(REQUIREMENT_MINIMUMS)) {
    const token = match[1].toUpperCase();
    const minimum = Number(match[2]);
    if (token === "LEVEL" || token === "NÍVEL" || token === "NIVEL") {
      if (level < minimum) unmet.push(`Nível ${minimum}`);
      continue;
    }
    const attribute = REQUIREMENT_TOKEN_ATTRIBUTES[token];
    if (attribute && attributes[attribute] < minimum) {
      unmet.push(`${getFalloutAttributeShortLabel(attribute)} ${minimum}`);
    }
  }
  return unmet;
}
