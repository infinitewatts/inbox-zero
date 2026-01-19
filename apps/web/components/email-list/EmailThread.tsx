import { useEffect, useMemo, useRef, useState } from "react";
import type { ThreadMessage } from "@/components/email-list/types";
import { EmailMessage } from "@/components/email-list/EmailMessage";

export function EmailThread({
  messages,
  refetch,
  showReplyButton,
  autoOpenReplyForMessageId,
  topRightComponent,
  onSendSuccess,
  withHeader,
}: {
  messages: ThreadMessage[];
  refetch: () => void;
  showReplyButton: boolean;
  autoOpenReplyForMessageId?: string;
  topRightComponent?: React.ReactNode;
  onSendSuccess?: (messageId: string, threadId: string) => void;
  withHeader?: boolean;
}) {
  // Place draft messages as replies to their parent message
  // Sort by date to ensure most recent is last
  const organizedMessages = useMemo(() => {
    const drafts = new Map<string, ThreadMessage>();
    const regularMessages: ThreadMessage[] = [];
    const standaloneDrafts: ThreadMessage[] = [];

    messages?.forEach((message) => {
      if (message.labelIds?.includes("DRAFT")) {
        const parentId =
          message.headers.references?.split(" ").pop() ||
          message.headers["in-reply-to"];
        if (parentId) {
          drafts.set(parentId, message);
        } else {
          // Standalone draft with no parent - treat as a regular message
          standaloneDrafts.push(message);
        }
      } else {
        regularMessages.push(message);
      }
    });

    // If there are no regular messages, treat standalone drafts as regular messages
    const messagesToDisplay =
      regularMessages.length > 0 ? regularMessages : standaloneDrafts;

    // Sort by date ascending so most recent is last
    messagesToDisplay.sort((a, b) => {
      const dateA = new Date(a.headers.date).getTime();
      const dateB = new Date(b.headers.date).getTime();
      return dateA - dateB;
    });

    return messagesToDisplay.map((message) => ({
      message,
      draftMessage: drafts.get(message.headers["message-id"] || ""),
    }));
  }, [messages]);

  const lastMessageId = organizedMessages.at(-1)?.message.id;
  const hasInitialized = useRef(false);

  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  // Expand the most recent message when messages load
  useEffect(() => {
    if (lastMessageId && !hasInitialized.current) {
      setExpandedMessageIds(new Set([lastMessageId]));
      hasInitialized.current = true;
    }
  }, [lastMessageId]);

  return (
    <div className="flex-1 overflow-auto bg-muted p-4">
      {withHeader && (
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold text-foreground">
            {messages[0]?.headers.subject}
          </div>
          {topRightComponent && (
            <div className="flex items-center gap-2">{topRightComponent}</div>
          )}
        </div>
      )}
      <ul className="mt-4 space-y-2 sm:space-y-4">
        {organizedMessages.map(({ message, draftMessage }) => {
          const defaultShowReply =
            autoOpenReplyForMessageId === message.id || Boolean(draftMessage);
          return (
            <EmailMessage
              key={message.id}
              message={message}
              showReplyButton={showReplyButton}
              refetch={refetch}
              defaultShowReply={defaultShowReply}
              draftMessage={draftMessage}
              expanded={expandedMessageIds.has(message.id)}
              onExpand={() => {
                setExpandedMessageIds((prev) => {
                  if (prev.has(message.id)) return prev;
                  return new Set(prev).add(message.id);
                });
              }}
              onSendSuccess={(messageId) => {
                setExpandedMessageIds((prev) => {
                  if (prev.has(messageId)) return prev;
                  return new Set(prev).add(messageId);
                });

                onSendSuccess?.(messageId, message.threadId);
              }}
              generateNudge={defaultShowReply && !draftMessage?.textHtml}
            />
          );
        })}
      </ul>
    </div>
  );
}
