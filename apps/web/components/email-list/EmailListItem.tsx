import {
  type ForwardedRef,
  type MouseEventHandler,
  forwardRef,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import clsx from "clsx";
import { ActionButtons } from "@/components/ActionButtons";
import { PlanBadge } from "@/components/PlanBadge";
import type { Thread } from "@/components/email-list/types";
import { extractNameFromEmail, participant } from "@/utils/email";
import { Checkbox } from "@/components/Checkbox";
import { EmailDate } from "@/components/email-list/EmailDate";
import { decodeSnippet } from "@/utils/gmail/decode";
import { useIsInAiQueue } from "@/store/ai-queue";
import { Button } from "@/components/ui/button";
import { findCtaLink } from "@/utils/parse/parseHtml.client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { internalDateToDate } from "@/utils/date";

export const EmailListItem = forwardRef(
  (
    props: {
      userEmail: string;
      provider: string;
      thread: Thread;
      opened: boolean;
      selected: boolean;
      splitView: boolean;
      onClick: MouseEventHandler<HTMLLIElement>;
      closePanel: () => void;
      onSelected: (id: string) => void;
      onPlanAiAction: (thread: Thread) => void;
      onArchive: (thread: Thread) => void;
      refetch: () => void;
    },
    ref: ForwardedRef<HTMLLIElement>,
  ) => {
    const { provider, thread, splitView, onSelected } = props;

    const lastMessage = thread.messages?.[thread.messages.length - 1];

    const isUnread = useMemo(() => {
      return lastMessage?.labelIds?.includes("UNREAD");
    }, [lastMessage?.labelIds]);

    const preventPropagation = useCallback(
      (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation(),
      [],
    );

    const onRowSelected = useCallback(
      () => onSelected(props.thread.id!),
      [onSelected, props.thread.id],
    );

    const isPlanning = useIsInAiQueue(props.thread.id);

    if (!lastMessage) return null;

    const decodedSnippet = decodeSnippet(thread.snippet || lastMessage.snippet);

    const cta = findCtaLink(lastMessage.textHtml);

    return (
      <ErrorBoundary extra={{ props, cta, decodedSnippet }}>
        <li
          ref={ref}
          className={clsx(
            "group relative cursor-pointer border-l-2 py-2 transition-colors duration-100",
            {
              "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900":
                !props.selected && !props.opened && isUnread,
              "border-l-transparent bg-slate-50/50 hover:bg-slate-100/70 dark:bg-slate-900/30 dark:hover:bg-slate-800/50":
                !props.selected && !props.opened && !isUnread,
              "border-l-blue-500 bg-blue-50 dark:bg-blue-950/50": props.selected,
              "border-l-blue-600 bg-blue-100/80 dark:bg-blue-900/50": props.opened,
            },
          )}
          onClick={props.onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              props.onClick(e as any);
            }
          }}
        >
          <div className="px-3">
            <div className="mx-auto flex">
              {/* left */}
              <div
                className={clsx(
                  "flex flex-1 items-center overflow-hidden whitespace-nowrap text-[13px] leading-5",
                  {
                    "font-medium": isUnread,
                  },
                )}
              >
                <div
                  className="flex shrink-0 items-center"
                  onClick={preventPropagation}
                  onKeyDown={preventPropagation}
                >
                  <Checkbox
                    checked={!!props.selected}
                    onChange={onRowSelected}
                  />
                </div>

                <div className="ml-3 w-40 min-w-0 shrink-0 overflow-hidden truncate text-foreground">
                  {extractNameFromEmail(
                    participant(lastMessage, props.userEmail),
                  )}{" "}
                  {thread.messages.length > 1 ? (
                    <span className="font-normal">
                      ({thread.messages.length})
                    </span>
                  ) : null}
                </div>
                {!splitView && (
                  <>
                    <span className="mx-2 text-muted-foreground/40">—</span>
                    <div className="min-w-0 overflow-hidden truncate text-foreground/90">
                      {lastMessage.headers.subject}
                    </div>
                    <div className="ml-2 mr-4 flex flex-1 items-center overflow-hidden truncate font-normal text-muted-foreground">
                      {decodedSnippet}
                    </div>
                    {cta && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="ml-1 h-6 shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                        asChild
                      >
                        <Link href={cta.ctaLink} target="_blank">
                          {cta.ctaText}
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* right */}
              <div className="flex items-center justify-between">
                <div className="relative flex items-center">
                  <div
                    className="absolute right-0 z-20 hidden group-hover:block"
                    // prevent email panel being opened when clicking on action buttons
                    onClick={preventPropagation}
                    onKeyDown={preventPropagation}
                  >
                    <ActionButtons
                      threadId={thread.id!}
                      shadow
                      isPlanning={isPlanning}
                      onPlanAiAction={() => props.onPlanAiAction(thread)}
                      onArchive={() => {
                        props.onArchive(thread);
                        props.closePanel();
                      }}
                      refetch={props.refetch}
                    />
                  </div>
                  <EmailDate
                    date={internalDateToDate(lastMessage?.internalDate)}
                  />
                </div>

                {!!thread.plan && (
                  <div className="ml-3 flex items-center space-x-2 whitespace-nowrap">
                    <PlanBadge plan={thread.plan} provider={provider} />
                  </div>
                )}
              </div>
            </div>

            {splitView && (
              <div className="mt-1 whitespace-nowrap text-[13px] leading-5">
                <div className="min-w-0 overflow-hidden truncate font-medium text-foreground/90">
                  {lastMessage.headers.subject}
                </div>
                <div className="mt-0.5 flex flex-1 items-center overflow-hidden truncate font-normal text-muted-foreground">
                  {decodedSnippet}
                </div>
                {cta && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1.5 h-6 text-xs"
                    asChild
                  >
                    <Link href={cta.ctaLink} target="_blank">
                      {cta.ctaText}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </li>
      </ErrorBoundary>
    );
  },
);

EmailListItem.displayName = "EmailListItem";
