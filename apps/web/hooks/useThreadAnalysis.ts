import useSWR from "swr";
import { useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import type { ThreadAnalysisResponse } from "@/app/api/user/thread-analysis/route";
import { analyzeThreadAction } from "@/utils/actions/thread-analysis";
import { useAccount } from "@/providers/EmailAccountProvider";

export function useThreadAnalysis(threadId: string | null | undefined) {
  const { emailAccountId } = useAccount();

  const { data, isLoading, error, mutate } = useSWR<ThreadAnalysisResponse>(
    threadId ? `/api/user/thread-analysis?threadId=${threadId}` : null,
  );

  const { execute, isExecuting } = useAction(
    analyzeThreadAction.bind(null, emailAccountId),
    { onSuccess: () => mutate() },
  );

  const analyze = useCallback(
    (forceRefresh = false) => {
      if (!threadId) return;
      execute({ threadId, forceRefresh });
    },
    [execute, threadId],
  );

  return {
    analysis: data,
    isLoading,
    isAnalyzing: isExecuting,
    error,
    analyze,
    mutate,
  };
}
