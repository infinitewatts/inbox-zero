"use client";

import { useEffect } from "react";
import {
  BrainIcon,
  CheckCircle2Icon,
  ClockIcon,
  InfoIcon,
  MessageSquareReplyIcon,
  RefreshCwIcon,
  SmileIcon,
  FrownIcon,
  MehIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThreadAnalysis } from "@/hooks/useThreadAnalysis";
import { ThreadSentiment, ThreadNextAction } from "@/generated/prisma/enums";

type ThreadIntelligenceProps = {
  threadId: string;
  autoAnalyze?: boolean;
  variant?: "compact" | "expanded";
};

const sentimentConfig: Record<
  ThreadSentiment,
  { label: string; icon: typeof SmileIcon; color: string }
> = {
  [ThreadSentiment.POSITIVE]: {
    label: "Positive",
    icon: SmileIcon,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  [ThreadSentiment.NEUTRAL]: {
    label: "Neutral",
    icon: MehIcon,
    color: "text-slate-600 bg-slate-50 border-slate-200",
  },
  [ThreadSentiment.NEGATIVE]: {
    label: "Negative",
    icon: FrownIcon,
    color: "text-red-600 bg-red-50 border-red-200",
  },
  [ThreadSentiment.MIXED]: {
    label: "Mixed",
    icon: MehIcon,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
};

const nextActionConfig: Record<
  ThreadNextAction,
  { label: string; icon: typeof ClockIcon; color: string }
> = {
  [ThreadNextAction.TO_REPLY]: {
    label: "Reply needed",
    icon: MessageSquareReplyIcon,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  [ThreadNextAction.AWAITING]: {
    label: "Awaiting response",
    icon: ClockIcon,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  [ThreadNextAction.FYI]: {
    label: "FYI",
    icon: InfoIcon,
    color: "text-slate-600 bg-slate-50 border-slate-200",
  },
  [ThreadNextAction.DONE]: {
    label: "Done",
    icon: CheckCircle2Icon,
    color: "text-green-600 bg-green-50 border-green-200",
  },
};

export function ThreadIntelligence({
  threadId,
  autoAnalyze = true,
  variant = "compact",
}: ThreadIntelligenceProps) {
  const { analysis, isLoading, isAnalyzing, analyze } =
    useThreadAnalysis(threadId);

  useEffect(() => {
    if (autoAnalyze && !analysis && !isLoading && !isAnalyzing) {
      analyze();
    }
  }, [autoAnalyze, analysis, isLoading, isAnalyzing, analyze]);

  if (isLoading || isAnalyzing) {
    return <ThreadIntelligenceLoading variant={variant} />;
  }

  if (!analysis) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => analyze()}
          >
            <BrainIcon className="h-3 w-3" />
            Analyze
          </Button>
        </TooltipTrigger>
        <TooltipContent>Analyze this thread with AI</TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "compact") {
    return <ThreadIntelligenceCompact analysis={analysis} />;
  }

  return (
    <ThreadIntelligenceExpanded
      analysis={analysis}
      onRefresh={() => analyze(true)}
      isRefreshing={isAnalyzing}
    />
  );
}

function ThreadIntelligenceLoading({
  variant,
}: {
  variant: "compact" | "expanded";
}) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

type AnalysisData = NonNullable<
  ReturnType<typeof useThreadAnalysis>["analysis"]
>;

function ThreadIntelligenceCompact({ analysis }: { analysis: AnalysisData }) {
  const sentiment = sentimentConfig[analysis.sentiment];
  const nextAction = nextActionConfig[analysis.nextAction];
  const SentimentIcon = sentiment.icon;
  const ActionIcon = nextAction.icon;

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`h-5 gap-1 px-1.5 text-[10px] ${nextAction.color}`}
          >
            <ActionIcon className="h-3 w-3" />
            {nextAction.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <p className="font-medium">{nextAction.label}</p>
            {analysis.nextActionNote && (
              <p className="text-xs text-muted-foreground">
                {analysis.nextActionNote}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`h-5 gap-1 px-1.5 text-[10px] ${sentiment.color}`}
          >
            <SentimentIcon className="h-3 w-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{sentiment.label} tone</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ThreadIntelligenceExpanded({
  analysis,
  onRefresh,
  isRefreshing,
}: {
  analysis: AnalysisData;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const sentiment = sentimentConfig[analysis.sentiment];
  const nextAction = nextActionConfig[analysis.nextAction];
  const SentimentIcon = sentiment.icon;
  const ActionIcon = nextAction.icon;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BrainIcon className="h-4 w-4 text-muted-foreground" />
          Thread Intelligence
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCwIcon
                className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh analysis</TooltipContent>
        </Tooltip>
      </div>

      <p className="text-sm">{analysis.summary}</p>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={`gap-1 ${nextAction.color}`}>
          <ActionIcon className="h-3.5 w-3.5" />
          {nextAction.label}
        </Badge>

        <Badge variant="outline" className={`gap-1 ${sentiment.color}`}>
          <SentimentIcon className="h-3.5 w-3.5" />
          {sentiment.label}
        </Badge>

        {analysis.participantCount > 1 && (
          <Badge variant="outline" className="gap-1">
            {analysis.participantCount} participants
          </Badge>
        )}
      </div>

      {analysis.nextActionNote && (
        <p className="text-xs text-muted-foreground">
          {analysis.nextActionNote}
        </p>
      )}

      {analysis.keyTopics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.keyTopics.map((topic) => (
            <Badge
              key={topic}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              {topic}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
