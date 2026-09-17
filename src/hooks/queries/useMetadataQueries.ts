import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/apiClient";
import { queryKeys } from "@/lib/client/queryKeys";
import type { RpgClass, RpgRace, Skill, Spell } from "@/types";

type ApiListResponse<T> = {
  data: T[];
};

export function useClassesQuery() {
  return useQuery({
    queryKey: queryKeys.classes.all,
    queryFn: () => apiFetch<ApiListResponse<RpgClass>>("/api/classes"),
  });
}

export function useRacesQuery() {
  return useQuery({
    queryKey: queryKeys.races.all,
    queryFn: () => apiFetch<ApiListResponse<RpgRace>>("/api/races"),
  });
}

export function useContentByTypeQuery(type: "skills"): ReturnType<typeof useQuery<ApiListResponse<Skill>>>;
export function useContentByTypeQuery(type: "spells"): ReturnType<typeof useQuery<ApiListResponse<Spell>>>;
export function useContentByTypeQuery<T = unknown>(type: string): ReturnType<typeof useQuery<ApiListResponse<T>>>;
export function useContentByTypeQuery(type: string) {
  return useQuery({
    queryKey: queryKeys.content.byType(type),
    queryFn: () => apiFetch<ApiListResponse<unknown>>(`/api/content/${type}`),
    enabled: Boolean(type),
  });
}
