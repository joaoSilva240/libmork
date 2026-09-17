// =============================================================================
// Libmork — Centralized Query Keys
// =============================================================================

export const queryKeys = {
  classes: {
    all: ["classes"] as const,
    detail: (id: string) => ["classes", id] as const,
  },
  races: {
    all: ["races"] as const,
    detail: (id: string) => ["races", id] as const,
  },
  content: {
    byType: (type: string) => ["content", type] as const,
    detail: (type: string, id: string) => ["content", type, id] as const,
  },
  characterContent: {
    byType: (characterId: string, type: string) =>
      ["characters", characterId, "content", type] as const,
  },
  classBenefits: (classId: string) => ["classes", classId, "benefits"] as const,
  player: {
    campaigns: () => ["player", "campaigns"] as const,
  },
} as const;
