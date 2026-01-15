"use client";

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

function ErrorToolCard({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
      <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}

// Email action tool card with icon
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

// Search results card
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

// Generic tool renderer for simple input/output tools
function renderSimpleTool<T extends { toolCallId: string; state: string }>({
  part,
  loadingText,
  completedText,
  CompletedComponent,
}: {
  part: T;
  loadingText: string;
  completedText?: string;
  CompletedComponent?: React.ComponentType<{ part: T }>;
}) {
  const { toolCallId, state } = part;

  if (state === "input-available") {
    return <BasicToolInfo key={toolCallId} text={loadingText} />;
  }

  if (state === "output-available") {
    const output = (part as T & { output: unknown }).output as Record<
      string,
      unknown
    >;
    if (output && "error" in output) {
      return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
    }
    if (CompletedComponent) {
      return <CompletedComponent key={toolCallId} part={part} />;
    }
    if (completedText) {
      return <BasicToolInfo key={toolCallId} text={completedText} />;
    }
  }

  return null;
}

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

  // === Rule & Settings Tools ===

  if (part.type === "tool-getUserRulesAndSettings") {
    return renderSimpleTool({
      part,
      loadingText: "Reading rules and settings...",
      completedText: "Read rules and settings",
    });
  }

  if (part.type === "tool-getLearnedPatterns") {
    return renderSimpleTool({
      part,
      loadingText: "Reading learned patterns...",
      completedText: "Read learned patterns",
    });
  }

  if (part.type === "tool-createRule") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <BasicToolInfo
          key={toolCallId}
          text={`Creating rule "${part.input.name}"...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <CreatedRuleToolCard
          key={toolCallId}
          args={part.input}
          ruleId={output.ruleId}
        />
      );
    }
  }

  if (part.type === "tool-updateRuleConditions") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <BasicToolInfo
          key={toolCallId}
          text={`Updating rule "${part.input.ruleName}" conditions...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <UpdatedRuleConditions
          key={toolCallId}
          args={part.input}
          ruleId={output.ruleId}
          originalConditions={output.originalConditions}
          updatedConditions={output.updatedConditions}
        />
      );
    }
  }

  if (part.type === "tool-updateRuleActions") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <BasicToolInfo
          key={toolCallId}
          text={`Updating rule "${part.input.ruleName}" actions...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <UpdatedRuleActions
          key={toolCallId}
          args={part.input}
          ruleId={output.ruleId}
          originalActions={output.originalActions}
          updatedActions={output.updatedActions}
        />
      );
    }
  }

  if (part.type === "tool-updateLearnedPatterns") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <BasicToolInfo
          key={toolCallId}
          text={`Updating learned patterns for rule "${part.input.ruleName}"...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <UpdatedLearnedPatterns
          key={toolCallId}
          args={part.input}
          ruleId={output.ruleId}
        />
      );
    }
  }

  if (part.type === "tool-updateAbout") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return <BasicToolInfo key={toolCallId} text="Updating about..." />;
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return <UpdateAbout key={toolCallId} args={part.input} />;
    }
  }

  if (part.type === "tool-addToKnowledgeBase") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <BasicToolInfo key={toolCallId} text="Adding to knowledge base..." />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return <AddToKnowledgeBase key={toolCallId} args={part.input} />;
    }
  }

  // === Email Tools ===

  if (part.type === "tool-searchEmails") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={SearchIcon}
          text={`Searching for "${part.input.query}"...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <SearchResultsCard
          key={toolCallId}
          found={output.found}
          hasMore={output.hasMore}
        />
      );
    }
  }

  if (part.type === "tool-getThreadSummary") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text="Loading email details..."
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text={`Loaded thread: ${output.subject || "No subject"}`}
          success
        />
      );
    }
  }

  if (part.type === "tool-archiveThread") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={ArchiveIcon}
          text="Archiving email..."
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={ArchiveIcon}
          text="Email archived"
          success
        />
      );
    }
  }

  if (part.type === "tool-trashThread") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={Trash2Icon}
          text="Moving to trash..."
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={Trash2Icon}
          text="Moved to trash"
          success
        />
      );
    }
  }

  if (part.type === "tool-labelThread") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={TagIcon}
          text={`Adding label "${part.input.labelName}"...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={TagIcon}
          text={`Labeled as "${part.input.labelName}"`}
          success
        />
      );
    }
  }

  if (part.type === "tool-markSpam") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={AlertTriangleIcon}
          text="Marking as spam..."
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={AlertTriangleIcon}
          text="Marked as spam"
          success
        />
      );
    }
  }

  if (part.type === "tool-markRead") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text={`Marking as ${part.input.read ? "read" : "unread"}...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text={`Marked as ${part.input.read ? "read" : "unread"}`}
          success
        />
      );
    }
  }

  if (part.type === "tool-composeEmail") {
    const { toolCallId, state } = part;
    if (state === "input-available") {
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text={`Drafting email to ${part.input.to}...`}
        />
      );
    }
    if (state === "output-available") {
      const { output } = part;
      if ("error" in output) {
        return <ErrorToolCard key={toolCallId} error={String(output.error)} />;
      }
      return (
        <EmailActionToolCard
          key={toolCallId}
          icon={MailIcon}
          text={output.draftId ? "Draft created in inbox" : "Email composed"}
          success
        />
      );
    }
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
