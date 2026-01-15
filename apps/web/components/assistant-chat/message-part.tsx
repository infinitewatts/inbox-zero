"use client";

import type React from "react";
import { Response } from "@/components/ai-elements/response";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  AddToKnowledgeBase,
  BasicToolInfo,
  CreatedRuleToolCard,
  UpdateAbout,
  UpdatedLearnedPatterns,
  UpdatedRuleActions,
  UpdatedRuleConditions,
} from "@/components/assistant-chat/tools";
import type { ChatMessage } from "@/components/assistant-chat/types";
import {
  ArchiveIcon,
  CheckCircleIcon,
  MailIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
  AlertTriangleIcon,
} from "lucide-react";

interface MessagePartProps {
  part: ChatMessage["parts"][0];
  isStreaming: boolean;
  messageId: string;
  partIndex: number;
}

// === UI Components ===

function ErrorToolCard({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
      <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function EmailActionToolCard({
  icon: Icon,
  text,
  success,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  success?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{text}</span>
      {success && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
    </div>
  );
}

function SearchResultsCard({
  found,
  hasMore,
}: {
  found: number;
  hasMore: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-sm">
      <SearchIcon className="h-4 w-4 text-muted-foreground" />
      <span>
        Found {found} email{found !== 1 ? "s" : ""}
        {hasMore ? " (more available)" : ""}
      </span>
    </div>
  );
}

// === Tool Configuration Types ===

type ToolInput = Record<string, unknown>;
type ToolOutput = Record<string, unknown>;

type ToolConfig = {
  icon?: React.ComponentType<{ className?: string }>;
  loadingText: string | ((input: ToolInput) => string);
  successText?: string | ((input: ToolInput, output: ToolOutput) => string);
  SuccessComponent?: React.ComponentType<{
    input: ToolInput;
    output: ToolOutput;
    toolCallId: string;
  }>;
};

// === Tool Configurations ===

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // Simple read-only tools
  "tool-getUserRulesAndSettings": {
    loadingText: "Reading rules and settings...",
    successText: "Read rules and settings",
  },
  "tool-getLearnedPatterns": {
    loadingText: "Reading learned patterns...",
    successText: "Read learned patterns",
  },

  // Rule management tools with custom success components
  "tool-createRule": {
    loadingText: (input) => `Creating rule "${input.name}"...`,
    SuccessComponent: ({ input, output, toolCallId }) => (
      <CreatedRuleToolCard
        key={toolCallId}
        args={input as Parameters<typeof CreatedRuleToolCard>[0]["args"]}
        ruleId={output.ruleId as string}
      />
    ),
  },
  "tool-updateRuleConditions": {
    loadingText: (input) => `Updating rule "${input.ruleName}" conditions...`,
    SuccessComponent: ({ input, output, toolCallId }) => (
      <UpdatedRuleConditions
        key={toolCallId}
        args={input as Parameters<typeof UpdatedRuleConditions>[0]["args"]}
        ruleId={output.ruleId as string}
        originalConditions={
          output.originalConditions as Parameters<
            typeof UpdatedRuleConditions
          >[0]["originalConditions"]
        }
        updatedConditions={
          output.updatedConditions as Parameters<
            typeof UpdatedRuleConditions
          >[0]["updatedConditions"]
        }
      />
    ),
  },
  "tool-updateRuleActions": {
    loadingText: (input) => `Updating rule "${input.ruleName}" actions...`,
    SuccessComponent: ({ input, output, toolCallId }) => (
      <UpdatedRuleActions
        key={toolCallId}
        args={input as Parameters<typeof UpdatedRuleActions>[0]["args"]}
        ruleId={output.ruleId as string}
        originalActions={
          output.originalActions as Parameters<
            typeof UpdatedRuleActions
          >[0]["originalActions"]
        }
        updatedActions={
          output.updatedActions as Parameters<
            typeof UpdatedRuleActions
          >[0]["updatedActions"]
        }
      />
    ),
  },
  "tool-updateLearnedPatterns": {
    loadingText: (input) =>
      `Updating learned patterns for rule "${input.ruleName}"...`,
    SuccessComponent: ({ input, output, toolCallId }) => (
      <UpdatedLearnedPatterns
        key={toolCallId}
        args={input as Parameters<typeof UpdatedLearnedPatterns>[0]["args"]}
        ruleId={output.ruleId as string}
      />
    ),
  },
  "tool-updateAbout": {
    loadingText: "Updating about...",
    SuccessComponent: ({ input, toolCallId }) => (
      <UpdateAbout
        key={toolCallId}
        args={input as Parameters<typeof UpdateAbout>[0]["args"]}
      />
    ),
  },
  "tool-addToKnowledgeBase": {
    loadingText: "Adding to knowledge base...",
    SuccessComponent: ({ input, toolCallId }) => (
      <AddToKnowledgeBase
        key={toolCallId}
        args={input as Parameters<typeof AddToKnowledgeBase>[0]["args"]}
      />
    ),
  },

  // Email search tools
  "tool-searchEmails": {
    icon: SearchIcon,
    loadingText: (input) => `Searching for "${input.query}"...`,
    SuccessComponent: ({ output, toolCallId }) => (
      <SearchResultsCard
        key={toolCallId}
        found={output.found as number}
        hasMore={output.hasMore as boolean}
      />
    ),
  },
  "tool-getThreadSummary": {
    icon: MailIcon,
    loadingText: "Loading email details...",
    successText: (_input, output) =>
      `Loaded thread: ${(output.subject as string) || "No subject"}`,
  },

  // Email action tools
  "tool-archiveThread": {
    icon: ArchiveIcon,
    loadingText: "Archiving email...",
    successText: "Email archived",
  },
  "tool-trashThread": {
    icon: Trash2Icon,
    loadingText: "Moving to trash...",
    successText: "Moved to trash",
  },
  "tool-markSpam": {
    icon: AlertTriangleIcon,
    loadingText: "Marking as spam...",
    successText: "Marked as spam",
  },
  "tool-labelThread": {
    icon: TagIcon,
    loadingText: (input) => `Adding label "${input.labelName}"...`,
    successText: (input) => `Labeled as "${input.labelName}"`,
  },
  "tool-markRead": {
    icon: MailIcon,
    loadingText: (input) => `Marking as ${input.read ? "read" : "unread"}...`,
    successText: (input) => `Marked as ${input.read ? "read" : "unread"}`,
  },
  "tool-composeEmail": {
    icon: MailIcon,
    loadingText: (input) => `Drafting email to ${input.to}...`,
    successText: (_input, output) =>
      output.draftId ? "Draft created in inbox" : "Email composed",
  },
};

// === Generic Tool Renderer ===

function renderToolFromConfig(
  part: {
    type: string;
    toolCallId: string;
    state: string;
    input?: ToolInput;
    output?: ToolOutput;
  },
  config: ToolConfig,
): React.ReactNode {
  const { toolCallId, state, input = {}, output } = part;

  // Loading state
  if (state === "input-available") {
    const text =
      typeof config.loadingText === "function"
        ? config.loadingText(input)
        : config.loadingText;

    return config.icon ? (
      <EmailActionToolCard key={toolCallId} icon={config.icon} text={text} />
    ) : (
      <BasicToolInfo key={toolCallId} text={text} />
    );
  }

  // Success/error state
  if (state === "output-available" && output) {
    // Handle errors
    if ("error" in output) {
      return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
    }

    // Custom success component
    if (config.SuccessComponent) {
      return (
        <config.SuccessComponent
          key={toolCallId}
          input={input}
          output={output}
          toolCallId={toolCallId}
        />
      );
    }

    // Success text
    if (config.successText) {
      const text =
        typeof config.successText === "function"
          ? config.successText(input, output)
          : config.successText;

      return config.icon ? (
        <EmailActionToolCard
          key={toolCallId}
          icon={config.icon}
          text={text}
          success
        />
      ) : (
        <BasicToolInfo key={toolCallId} text={text} />
      );
    }
  }

  return null;
}

// === Main Component ===

export function MessagePart({
  part,
  isStreaming,
  messageId,
  partIndex,
}: MessagePartProps) {
  const key = `${messageId}-${partIndex}`;

  // Text content
  if (part.type === "text") {
    if (!part.text) return null;
    return <Response key={key}>{part.text}</Response>;
  }

  // Reasoning/thinking
  if (part.type === "reasoning") {
    if (!part.text || part.text === "[REDACTED]") return null;
    return (
      <Reasoning key={key} isStreaming={isStreaming} className="w-full">
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  // Tool rendering via config map
  const config = TOOL_CONFIGS[part.type];
  if (config) {
    return renderToolFromConfig(
      part as {
        type: string;
        toolCallId: string;
        state: string;
        input?: ToolInput;
        output?: ToolOutput;
      },
      config,
    );
  }

  // Unknown tool type - don't silently fail
  if (part.type.startsWith("tool-")) {
    return (
      <BasicToolInfo
        key={key}
        text={`Tool: ${part.type.replace("tool-", "")}`}
      />
    );
  }

  return null;
}
