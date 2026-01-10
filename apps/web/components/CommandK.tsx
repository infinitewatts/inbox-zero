"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useAtomValue } from "jotai";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useComposeModal } from "@/providers/ComposeModalProvider";
import { refetchEmailListAtom, emailNavigationAtom } from "@/store/email";
import { archiveEmails } from "@/store/archive-queue";
import { useDisplayedEmail } from "@/hooks/useDisplayedEmail";
import { useAccount } from "@/providers/EmailAccountProvider";
import { useCommandPaletteCommands } from "@/hooks/useCommandPaletteCommands";
import { fuzzySearch } from "@/lib/commands/fuzzy-search";
import type { Command, CommandSection } from "@/lib/commands/types";
import { prefixPath } from "@/utils/path";

const SECTION_ORDER: CommandSection[] = [
  "actions",
  "navigation",
  "rules",
  "accounts",
  "settings",
];

const SECTION_LABELS: Record<CommandSection, string> = {
  actions: "Actions",
  navigation: "Navigation",
  rules: "Rules",
  accounts: "Switch Account",
  settings: "Settings",
};

export function CommandK() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  const { emailAccountId } = useAccount();
  const { threadId, showEmail } = useDisplayedEmail();
  const refreshEmailList = useAtomValue(refetchEmailListAtom);
  const emailNavigation = useAtomValue(emailNavigationAtom);
  const { onOpen: onOpenComposeModal } = useComposeModal();
  const { commands, isLoading } = useCommandPaletteCommands();

  // track "g" key for go-to shortcuts (g+i for inbox, g+s for sent, etc.)
  const [pendingGoTo, setPendingGoTo] = React.useState(false);

  const onArchive = React.useCallback(() => {
    if (threadId) {
      const threadIds = [threadId];
      archiveEmails({
        threadIds,
        onSuccess: () => {
          return refreshEmailList?.refetch({ removedThreadIds: threadIds });
        },
        emailAccountId,
      });
      showEmail(null);
    }
  }, [refreshEmailList, threadId, showEmail, emailAccountId]);

  // build action commands that include archive and compose
  const actionCommands = React.useMemo<Command[]>(() => {
    const actions: Command[] = [];

    if (threadId) {
      actions.unshift({
        id: "archive",
        label: "Archive",
        description: "Archive current email",
        icon: ArchiveIcon,
        shortcut: "E",
        section: "actions",
        priority: 0,
        keywords: ["archive", "remove", "delete"],
        action: () => onArchive(),
      });
    }

    return actions;
  }, [threadId, onArchive]);

  // combine action commands with dynamic commands
  const allCommands = React.useMemo(() => {
    return [...actionCommands, ...commands];
  }, [actionCommands, commands]);

  // filter commands with fuzzy search
  const filteredCommands = React.useMemo(() => {
    if (!search.trim()) {
      return allCommands;
    }
    return fuzzySearch(search, allCommands);
  }, [allCommands, search]);

  // group commands by section
  const groupedCommands = React.useMemo(() => {
    const groups: Record<CommandSection, Command[]> = {
      actions: [],
      navigation: [],
      rules: [],
      accounts: [],
      settings: [],
    };

    for (const command of filteredCommands) {
      groups[command.section].push(command);
    }

    return groups;
  }, [filteredCommands]);

  // execute command
  const executeCommand = React.useCallback((command: Command) => {
    setOpen(false);
    setSearch("");
    command.action();
  }, []);

  // memoized handlers to avoid re-renders
  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  }, []);

  const commandProps = React.useMemo(
    () => ({
      // disable cmdk's built-in filter since we use custom fuzzy search
      shouldFilter: false,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== "Escape") {
          e.stopPropagation();
        }
      },
    }),
    [],
  );

  // navigation helpers
  const goToNextEmail = React.useCallback(() => {
    if (!emailNavigation) return;
    const { threads, currentThreadId, openThread } = emailNavigation;
    if (threads.length === 0) return;

    if (!currentThreadId) {
      openThread(threads[0].id);
      return;
    }

    const currentIndex = threads.findIndex((t) => t.id === currentThreadId);
    if (currentIndex < threads.length - 1) {
      openThread(threads[currentIndex + 1].id);
    }
  }, [emailNavigation]);

  const goToPrevEmail = React.useCallback(() => {
    if (!emailNavigation) return;
    const { threads, currentThreadId, openThread } = emailNavigation;
    if (threads.length === 0) return;

    if (!currentThreadId) {
      openThread(threads[threads.length - 1].id);
      return;
    }

    const currentIndex = threads.findIndex((t) => t.id === currentThreadId);
    if (currentIndex > 0) {
      openThread(threads[currentIndex - 1].id);
    }
  }, [emailNavigation]);

  // keyboard shortcuts
  React.useEffect(() => {
    let goToTimeout: ReturnType<typeof setTimeout> | null = null;

    const down = (e: KeyboardEvent) => {
      // cmd+k to toggle palette
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // don't handle other shortcuts when palette is open
      if (open) return;

      // escape to close email preview
      if (e.key === "Escape") {
        if (pendingGoTo) {
          setPendingGoTo(false);
          return;
        }
        if (threadId) {
          e.preventDefault();
          showEmail(null);
        }
        return;
      }

      // only handle shortcuts when focus is on body
      if (document?.activeElement?.tagName !== "BODY") return;

      // handle g+key go-to shortcuts
      if (pendingGoTo) {
        setPendingGoTo(false);
        if (goToTimeout) clearTimeout(goToTimeout);

        const goToRoutes: Record<string, `/${string}`> = {
          i: "/mail?type=inbox",
          s: "/mail?type=sent",
          d: "/mail?type=draft",
          t: "/mail?type=trash",
          a: "/mail?type=all",
        };

        const route = goToRoutes[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          router.push(prefixPath(emailAccountId, route));
        }
        return;
      }

      // g starts go-to mode
      if (e.key === "g" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPendingGoTo(true);
        toast.info("Go to: i=inbox, s=sent, d=drafts, t=trash, a=all", {
          duration: 1500,
          id: "goto-mode",
        });
        goToTimeout = setTimeout(() => setPendingGoTo(false), 1500);
        return;
      }

      // j for next email
      if (e.key === "j" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goToNextEmail();
        return;
      }

      // k for previous email
      if (e.key === "k" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goToPrevEmail();
        return;
      }

      // e for archive
      if ((e.key === "e" || e.key === "E") && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onArchive();
        return;
      }

      // c for compose
      if ((e.key === "c" || e.key === "C") && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenComposeModal();
        return;
      }

      // / for Ask assistant
      if (e.key === "/" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push(prefixPath(emailAccountId, "/automation"));
        return;
      }
    };

    document.addEventListener("keydown", down);

    return () => {
      document.removeEventListener("keydown", down);
      if (goToTimeout) clearTimeout(goToTimeout);
    };
  }, [
    open,
    onArchive,
    onOpenComposeModal,
    threadId,
    showEmail,
    router,
    emailAccountId,
    pendingGoTo,
    goToNextEmail,
    goToPrevEmail,
  ]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      commandProps={commandProps}
    >
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            {SECTION_ORDER.map((section, index) => {
              const sectionCommands = groupedCommands[section];
              if (sectionCommands.length === 0) return null;

              const showSeparator =
                index > 0 &&
                SECTION_ORDER.slice(0, index).some(
                  (s) => groupedCommands[s].length > 0,
                );

              return (
                <React.Fragment key={section}>
                  {showSeparator && <CommandSeparator />}
                  <CommandGroup heading={SECTION_LABELS[section]}>
                    {sectionCommands.map((command) => (
                      <CommandItem
                        key={command.id}
                        value={`${command.id} ${command.label} ${command.keywords?.join(" ") || ""}`}
                        onSelect={() => executeCommand(command)}
                      >
                        {command.icon && (
                          <command.icon className="mr-2 h-4 w-4" />
                        )}
                        <div className="flex flex-1 flex-col">
                          <span>{command.label}</span>
                          {command.description && (
                            <span className="text-xs text-muted-foreground">
                              {command.description}
                            </span>
                          )}
                        </div>
                        {command.shortcut && (
                          <CommandShortcut>{command.shortcut}</CommandShortcut>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              );
            })}
          </>
        )}
      </CommandList>
      <div className="flex flex-wrap items-center justify-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            j/k
          </kbd>
          next/prev
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            e
          </kbd>
          archive
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            c
          </kbd>
          compose
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            g
          </kbd>
          go to...
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            /
          </kbd>
          ask AI
        </span>
      </div>
    </CommandDialog>
  );
}
