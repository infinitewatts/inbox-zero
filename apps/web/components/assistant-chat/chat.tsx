"use client";

import { useEffect, useState } from "react";
import { HistoryIcon, Loader2, PlusIcon, SparklesIcon } from "lucide-react";
import { Messages } from "./messages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChats } from "@/hooks/useChats";
import { LoadingContent } from "@/components/LoadingContent";
import { Tooltip } from "@/components/Tooltip";
import { useChat } from "@/providers/ChatProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { useLocalStorage } from "usehooks-ts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

const MAX_MESSAGES = 20;

function ChatErrorFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircleIcon className="h-12 w-12 text-red-500" />
      <div>
        <h3 className="text-lg font-medium">Something went wrong</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The chat encountered an error. Try refreshing the page.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => window.location.reload()}
        className="gap-2"
      >
        <RefreshCwIcon className="h-4 w-4" />
        Refresh page
      </Button>
    </div>
  );
}

export function Chat({ open }: { open: boolean }) {
  const {
    chat,
    chatId,
    input,
    setInput,
    handleSubmit,
    setNewChat,
    context,
    setContext,
  } = useChat();
  const { messages, status, stop } = chat;
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    "",
  );

  useEffect(() => {
    if (open && !chatId) {
      setNewChat();
    }
  }, [open, chatId, setNewChat]);

  // Sync input with localStorage
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  // Load from localStorage on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
  useEffect(() => {
    if (localStorageInput) {
      setInput(localStorageInput);
    }
  }, []);

  return (
    <ErrorBoundary fallback={<ChatErrorFallback />}>
      <div className="flex h-full min-w-0 flex-col bg-gradient-to-t from-blue-50/80 from-0% via-blue-50/20 via-15% to-transparent to-30% dark:from-blue-950/20 dark:via-blue-950/5 dark:to-transparent">
        <div className="flex items-center justify-between border-b border-border/50 bg-background/80 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <SidebarTrigger name="chat-sidebar" />
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NewChatButton />
            <ChatHistoryDropdown />
          </div>
        </div>

        {messages.length > MAX_MESSAGES && (
          <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <span>Chat is getting long.</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 border-amber-300 bg-amber-100 text-xs hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900"
              onClick={setNewChat}
            >
              Start new chat
            </Button>
          </div>
        )}

        <Messages status={status} messages={messages} setInput={setInput} />

        <div className="mx-auto w-full px-4 pb-4 md:max-w-3xl md:pb-6">
          {context && (
            <div className="mb-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs dark:border-blue-800 dark:bg-blue-950/50">
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  Fixing:
                </span>
                <span className="max-w-[300px] truncate text-blue-600 dark:text-blue-400">
                  {context.message.headers.subject}
                </span>
                <button
                  type="button"
                  aria-label="Remove context"
                  className="ml-1 rounded-full p-0.5 text-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800"
                  onClick={() => setContext(null)}
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <PromptInput
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && status === "ready") {
                handleSubmit();
                setLocalStorageInput("");
              }
            }}
            className="relative"
          >
            <PromptInputTextarea
              value={input}
              placeholder="Message..."
              onChange={(e) => setInput(e.currentTarget.value)}
              className="pr-12"
            />
            <PromptInputSubmit
              status={
                status === "streaming"
                  ? "streaming"
                  : status === "submitted"
                    ? "submitted"
                    : "ready"
              }
              disabled={(!input.trim() && !context) || status !== "ready"}
              className="absolute bottom-1 right-1"
              onClick={(e) => {
                if (status === "streaming") {
                  e.preventDefault();
                  stop();
                }
              }}
            />
          </PromptInput>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function NewChatButton() {
  const { setNewChat } = useChat();

  return (
    <Tooltip content="Start a new conversation">
      <Button variant="ghost" size="icon" onClick={setNewChat}>
        <PlusIcon className="size-5" />
        <span className="sr-only">New Chat</span>
      </Button>
    </Tooltip>
  );
}

function ChatHistoryDropdown() {
  const { setChatId } = useChat();
  const [shouldLoadChats, setShouldLoadChats] = useState(false);
  const { data, error, isLoading, mutate } = useChats(shouldLoadChats);

  return (
    <DropdownMenu>
      <Tooltip content="View previous conversations">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onMouseEnter={() => setShouldLoadChats(true)}
            onClick={() => mutate()}
          >
            <HistoryIcon className="size-5" />
            <span className="sr-only">Chat History</span>
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <LoadingContent
          loading={isLoading}
          error={error}
          loadingComponent={
            <DropdownMenuItem
              disabled
              className="flex items-center justify-center"
            >
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading chats...
            </DropdownMenuItem>
          }
          errorComponent={
            <DropdownMenuItem disabled>Error loading chats</DropdownMenuItem>
          }
        >
          {data && data.chats.length > 0 ? (
            data.chats.map((chatItem) => (
              <DropdownMenuItem
                key={chatItem.id}
                onSelect={() => {
                  setChatId(chatItem.id);
                }}
              >
                {chatItem.preview || "New conversation"}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              No previous chats found
            </DropdownMenuItem>
          )}
        </LoadingContent>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
