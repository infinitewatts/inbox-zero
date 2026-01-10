"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon, RefreshCwIcon, CheckIcon } from "lucide-react";
import { cn } from "@/utils";
import { EMAIL_ACCOUNT_HEADER } from "@/utils/config";

type SmartReply = {
  text: string;
  tone: "positive" | "neutral" | "decline";
};

type SmartRepliesProps = {
  emailAccountId: string;
  emailContent: string;
  subject?: string;
  senderName?: string;
  onSelect: (text: string) => void;
  disabled?: boolean;
};

const toneStyles = {
  positive: "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900",
  neutral: "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
  decline: "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900",
};

export function SmartReplies({
  emailAccountId,
  emailContent,
  subject,
  senderName,
  onSelect,
  disabled,
}: SmartRepliesProps) {
  const [replies, setReplies] = useState<SmartReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const fetchReplies = useCallback(async () => {
    if (!emailContent.trim() || disabled) return;

    setIsLoading(true);
    setError(null);
    setSelectedIndex(null);

    try {
      const res = await fetch("/api/ai/smart-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [EMAIL_ACCOUNT_HEADER]: emailAccountId,
        },
        body: JSON.stringify({
          emailContent: emailContent.slice(0, 2000),
          subject,
          senderName,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate replies");
      }

      const data = await res.json();
      setReplies(data.replies || []);
    } catch (err) {
      console.error("Smart replies error:", err);
      setError("Couldn't generate suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [emailAccountId, emailContent, subject, senderName, disabled]);

  useEffect(() => {
    if (emailContent.trim().length > 50) {
      fetchReplies();
    }
  }, []);

  const handleSelect = (reply: SmartReply, index: number) => {
    setSelectedIndex(index);
    onSelect(reply.text);
  };

  if (!emailContent.trim() || disabled) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
          Quick replies
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={fetchReplies}
          disabled={isLoading}
        >
          <RefreshCwIcon className={cn("mr-1 h-3 w-3", isLoading && "animate-spin")} />
          {isLoading ? "Generating..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-muted-foreground">{error}</p>
      )}

      {replies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {replies.map((reply, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(reply, index)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                toneStyles[reply.tone],
                selectedIndex === index && "ring-2 ring-blue-500 ring-offset-1",
              )}
            >
              {selectedIndex === index && <CheckIcon className="h-3 w-3 text-blue-600" />}
              <span className="max-w-[200px] truncate">{reply.text}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && replies.length === 0 && (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-32 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      )}
    </div>
  );
}
