"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  MailOpenIcon,
  RefreshCwIcon,
  BellIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/Badge";
import { PageHeading, SectionDescription } from "@/components/Typography";
import { env } from "@/env";
import { cn } from "@/utils";

type OpenEvent = {
  open_id: number;
  opened_at: string;
  ip_address: string;
  user_agent: string;
  is_bot: number;
  bot_reason: string | null;
  pixel_id: string;
  email_id: string;
  recipient: string;
  subject: string;
  sent_at: string;
};

type ActivityResponse = {
  opens: OpenEvent[];
  newCount: number;
  timestamp: string;
};

async function fetchActivity(
  limit = 50,
  includeBots = false,
): Promise<ActivityResponse | null> {
  if (!env.NEXT_PUBLIC_EMAIL_TRACKER_URL) return null;

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (includeBots) params.set("includeBots", "true");
    const res = await fetch(
      `${env.NEXT_PUBLIC_EMAIL_TRACKER_URL}/api/activity?${params.toString()}`,
      {
        headers: env.NEXT_PUBLIC_EMAIL_TRACKER_API_KEY
          ? { "X-API-Key": env.NEXT_PUBLIC_EMAIL_TRACKER_API_KEY }
          : {},
      },
    );
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
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFullTime(dateString: string): string {
  return new Date(dateString).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEmailDomain(email: string): string {
  return email.split("@")[1] || "";
}

function getInitials(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function ActivityPage() {
  const [isPolling, setIsPolling] = useState(true);
  const [includeBots, setIncludeBots] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR(
    ["email-activity", includeBots],
    () => fetchActivity(100, includeBots),
    {
      refreshInterval: isPolling ? 10_000 : 0, // Poll every 10s when enabled
      revalidateOnFocus: true,
    },
  );

  // Mark current timestamp as "seen" when viewing
  useEffect(() => {
    if (data?.timestamp) {
      setLastSeen(data.timestamp);
    }
  }, [data?.timestamp]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  if (!env.NEXT_PUBLIC_EMAIL_TRACKER_URL) {
    return (
      <div className="p-6">
        <PageHeading>Email Open Activity</PageHeading>
        <Card className="p-6 mt-4">
          <p className="text-muted-foreground">
            Email tracking is not configured. Set{" "}
            <code className="bg-muted px-1 rounded">
              NEXT_PUBLIC_EMAIL_TRACKER_URL
            </code>{" "}
            in your environment.
          </p>
        </Card>
      </div>
    );
  }

  const opens = data?.opens || [];
  const newOpens = lastSeen
    ? opens.filter((o) => new Date(o.opened_at) > new Date(lastSeen))
    : [];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading>Email Open Activity</PageHeading>
          <SectionDescription>
            Real-time feed of when your emails are opened
          </SectionDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPolling(!isPolling)}
            className={cn(isPolling && "text-green-600")}
          >
            <BellIcon className="h-4 w-4 mr-1" />
            {isPolling ? "Live" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeBots((prev) => !prev)}
          >
            {includeBots ? "Include proxies" : "Humans only"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCwIcon
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {isLoading && opens.length === 0 ? (
        <Card className="p-8 text-center">
          <RefreshCwIcon className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading activity...</p>
        </Card>
      ) : opens.length === 0 ? (
        <Card className="p-8 text-center">
          <MailOpenIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-lg font-medium">No opens yet</p>
          <p className="text-muted-foreground mt-1">
            When someone opens an email you sent, it will appear here
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {opens.map((open, index) => {
            const isNew =
              newOpens.length > 0 &&
              newOpens.some((n) => n.open_id === open.open_id);
            const isPrevSameEmail =
              index > 0 && opens[index - 1].email_id === open.email_id;

            return (
              <OpenEventCard
                key={open.open_id}
                open={open}
                isNew={isNew}
                showEmailContext={!isPrevSameEmail}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpenEventCard({
  open,
  isNew,
  showEmailContext,
}: {
  open: OpenEvent;
  isNew: boolean;
  showEmailContext: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-4 transition-colors",
        isNew &&
          "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {getInitials(open.recipient)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{open.recipient}</span>
            {isNew && (
              <Badge color="green" className="text-xs">
                New
              </Badge>
            )}
            {!!open.is_bot && (
              <span title={open.bot_reason || "Proxy open"}>
                <Badge color="yellow" className="text-xs">
                  Proxy
                </Badge>
              </span>
            )}
          </div>

          {showEmailContext && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {open.subject || "(no subject)"}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <MailOpenIcon className="h-3 w-3" />
            <span>Opened {formatTimeAgo(open.opened_at)}</span>
            <span className="opacity-50">•</span>
            <span>{formatFullTime(open.opened_at)}</span>
          </div>
        </div>

        {/* Time */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-medium text-muted-foreground">
            {formatTimeAgo(open.opened_at)}
          </p>
          <p className="text-xs text-muted-foreground opacity-60">
            {getEmailDomain(open.recipient)}
          </p>
        </div>
      </div>
    </Card>
  );
}
