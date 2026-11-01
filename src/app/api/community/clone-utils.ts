import { communityComments, items, npcs, rpgClasses, spells, worlds } from "@/lib/db/schema";

export const CONTENT_ALLOWLIST: Record<string, readonly string[]> = {
  spell: ["name", "description", "level", "school", "castingTime", "range", "components", "duration", "damage", "imageUrl"],
  item: ["name", "description", "type", "rarity", "weight", "cost", "properties", "imageUrl", "iconUrl"],
  class: ["name", "description", "initialItems", "proficiencies", "imageUrl"],
  npc: ["name", "description", "race", "role", "personality", "secrets", "imageUrl", "tokenUrl"],
  world: ["name", "description", "theme", "lore", "imageUrl", "mapUrl"],
};

export function sanitizePayload(contentType: string, payload: unknown): Record<string, unknown> {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return Object.fromEntries((CONTENT_ALLOWLIST[contentType] ?? []).filter((key) => key in source).map((key) => [key, source[key]]));
}

export function isModified(original: unknown, modified: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(modified);
}

export function entityTable(contentType: string) {
  return { spell: spells, item: items, class: rpgClasses, npc: npcs, world: worlds }[contentType as "spell" | "item" | "class" | "npc" | "world"];
}

export { communityComments };
