import useSWR from "swr";
import type { ComposeTemplatesResponse } from "@/app/api/user/compose-templates/route";

export function useComposeTemplates() {
  const { data, isLoading, error, mutate } = useSWR<ComposeTemplatesResponse>(
    "/api/user/compose-templates",
  );

  return {
    templates: data?.templates ?? [],
    defaultPersona: data?.defaultPersona ?? null,
    isLoading,
    error,
    mutate,
  };
}
