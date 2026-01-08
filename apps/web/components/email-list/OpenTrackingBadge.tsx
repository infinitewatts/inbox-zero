"use client";

import { useState } from "react";
import useSWR from "swr";
import { MailCheckIcon, MailIcon, ChevronDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils";
import { env } from "@/env";
import type { ParsedMessage } from "@/utils/types";

type RecipientStatus = {
  recipient: string;
  opened: boolean;
  openCount: number;
  firstOpened: string | null;
  lastOpened: string | null;
};

type TrackingStatus = {
  emailId: string;
  recipients: RecipientStatus[];
};

async function fetchTrackingStatus(emailId: string): Promise<TrackingStatus | null> {
  if (!env.NEXT_PUBLIC_EMAIL_TRACKER_URL) return null;

  try {
    const res = await fetch(`${env.NEXT_PUBLIC_EMAIL_TRACKER_URL}/api/status/${emailId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getFirstName(email: string): string {
  const name = email.split("@")[0];
  return name.split(".")[0];
}

function getTrackingIdFromMessage(message: ParsedMessage): string | null {
  // Check for our custom tracking header
  const headers = message.headers as Record<string, string | undefined>;
  const trackingId = headers["x-inbox-zero-tracking-id"];
  if (trackingId) return trackingId;

  // Fallback: try to extract from tracking pixel in HTML
  if (message.textHtml) {
    const match = message.textHtml.match(/t\.affordablesolar\.io\/v1\/([^.]+)\.gif/);
    if (match) return match[1];
  }

  return null;
}

type OpenTrackingBadgeProps = {
  message: ParsedMessage;
  className?: string;
};

export function OpenTrackingBadge({ message, className }: OpenTrackingBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show for sent messages
  const isSent = message.labelIds?.includes("SENT");
  const trackingId = isSent ? getTrackingIdFromMessage(message) : null;

  const { data: status } = useSWR(
    trackingId ? `tracking-${trackingId}` : null,
    () => fetchTrackingStatus(trackingId!),
    {
      refreshInterval: 30000, // Refresh every 30s
      revalidateOnFocus: true,
    }
  );

  if (!status || status.recipients.length === 0) {
    return null;
  }

  const openedRecipients = status.recipients.filter((r) => r.opened);
  const totalOpens = status.recipients.reduce((sum, r) => sum + r.openCount, 0);
  const hasOpens = openedRecipients.length > 0;

  if (!hasOpens) {
    // Show "Not opened" indicator for sent emails
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <MailIcon className="h-3.5 w-3.5" />
        <span>Not opened</span>
      </div>
    );
  }

  // Format the inline text
  const firstOpened = openedRecipients[0];
  const inlineText = openedRecipients.length === 1
    ? `Opened by ${getFirstName(firstOpened.recipient)}`
    : `Opened by ${openedRecipients.length} recipients`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors",
            className
          )}
        >
          <MailCheckIcon className="h-3.5 w-3.5" />
          <span>{inlineText}</span>
          <ChevronDownIcon className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="end"
        sideOffset={4}
      >
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email opened {totalOpens} {totalOpens === 1 ? "time" : "times"}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {status.recipients.map((recipient) => (
            <RecipientRow key={recipient.recipient} recipient={recipient} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RecipientRow({ recipient }: { recipient: RecipientStatus }) {
  if (!recipient.opened) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border-b last:border-0">
        <span className="text-sm text-muted-foreground truncate max-w-[140px]">
          {recipient.recipient}
        </span>
        <span className="text-xs text-muted-foreground">Not opened</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate max-w-[140px]">
          {recipient.recipient}
        </span>
        <span className="text-xs text-muted-foreground">
          {recipient.openCount}x
        </span>
      </div>
      {recipient.lastOpened && (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatTime(recipient.lastOpened)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatTimeAgo(recipient.lastOpened)})
          </span>
        </div>
      )}
    </div>
  );
}
