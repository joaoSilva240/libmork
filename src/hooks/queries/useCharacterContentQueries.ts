import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/apiClient";
import { queryKeys } from "@/lib/client/queryKeys";
import type { ContentType } from "@/lib/validators/content";

export type CharacterContentRow = {
  junction: {
    id: string;
    trained?: boolean;
    quantity?: number;
    permanent?: boolean;
  };
  content: Record<string, unknown>;
};

export type CharacterContentData = {
  linked: CharacterContentRow[];
  available: Record<string, unknown>[];
};

type ContentResponse = { data: CharacterContentData };
type BenefitsResponse = { data: unknown[] };

export function useCharacterContentQuery(
  characterId: string,
  type: ContentType,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.characterContent.byType(characterId, type),
    queryFn: () => apiFetch<ContentResponse>(`/api/characters/${characterId}/content/${type}`),
    enabled: Boolean(characterId && type) && (options?.enabled ?? true),
  });
}

export function useCharacterGalleryContentQuery(
  characterId: string,
  options?: { enabled?: boolean }
) {
  const enabled = Boolean(characterId) && (options?.enabled ?? true);
  const spells = useQuery({
    queryKey: queryKeys.characterContent.byType(characterId, "spells"),
    queryFn: () => apiFetch<ContentResponse>(`/api/characters/${characterId}/content/spells`),
    enabled,
  });
  const items = useQuery({
    queryKey: queryKeys.characterContent.byType(characterId, "items"),
    queryFn: () => apiFetch<ContentResponse>(`/api/characters/${characterId}/content/items`),
    enabled,
  });
  const conditions = useQuery({
    queryKey: queryKeys.characterContent.byType(characterId, "conditions"),
    queryFn: () => apiFetch<ContentResponse>(`/api/characters/${characterId}/content/conditions`),
    enabled,
  });

  return { spells, items, conditions };
}

export function useClassBenefitsQuery(
  characterClassId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.classBenefits(characterClassId ?? ""),
    queryFn: () => apiFetch<BenefitsResponse>(`/api/classes/${characterClassId}/benefits`),
    enabled: Boolean(characterClassId) && (options?.enabled ?? true),
  });
}
