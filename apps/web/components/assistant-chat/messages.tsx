import { useEffect, useRef } from "react";
import { Overview } from "./overview";
import { MessagePart } from "./message-part";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@/components/assistant-chat/types";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import { useStickToBottomContext } from "use-stick-to-bottom";

interface MessagesProps {
  status: UseChatHelpers<ChatMessage>["status"];
  messages: Array<ChatMessage>;
  setInput: (input: string) => void;
}

export function Messages({ status, messages, setInput }: MessagesProps) {
  return (
    <Conversation className="flex min-w-0 flex-1">
      <MessagesContent
        status={status}
        messages={messages}
        setInput={setInput}
      />
      <ConversationScrollButton />
    </Conversation>
  );
}

// Inner component that can use the scroll context
function MessagesContent({
  status,
  messages,
  setInput,
}: {
  status: MessagesProps["status"];
  messages: MessagesProps["messages"];
  setInput: MessagesProps["setInput"];
}) {
  const { scrollToBottom, isAtBottom } = useStickToBottomContext();
  const prevMessageCount = useRef(messages.length);

  // Scroll to bottom when user sends a new message (to see the AI response)
  // The library handles scrolling during streaming via resize="smooth"
  // Note: We only depend on messages.length, not messages array (reference changes every render)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const isNewUserMessage =
      messages.length > prevMessageCount.current &&
      lastMessage?.role === "user";

    if (isNewUserMessage && !isAtBottom) {
      scrollToBottom();
    }

    prevMessageCount.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages array ref changes each render, use length only
  }, [messages.length, isAtBottom, scrollToBottom]);

  return (
    <ConversationContent className="flex flex-col gap-6 pt-0 h-full">
      {messages.length === 0 && <Overview setInput={setInput} />}

      {messages.map((message) => (
        <Message from={message.role} key={message.id}>
          <MessageContent>
            {message.parts?.map((part, index) => (
              <MessagePart
                key={`${message.id}-${index}`}
                part={part}
                isStreaming={status === "streaming"}
                messageId={message.id}
                partIndex={index}
              />
            ))}
          </MessageContent>
        </Message>
      ))}

      {status === "submitted" &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && (
          <Message from="assistant">
            <MessageContent>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader />
                <span>Thinking...</span>
              </div>
            </MessageContent>
          </Message>
        )}
    </ConversationContent>
  );
}
