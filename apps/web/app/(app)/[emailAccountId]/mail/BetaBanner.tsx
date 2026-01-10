"use client";

import { XIcon } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function BetaBanner() {
  const [bannerVisible, setBannerVisible] = useLocalStorage<
    boolean | undefined
  >("mailBetaBannerVisibile", true);

  if (!bannerVisible || typeof window === "undefined") return null;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-amber-200/50 bg-amber-50/50 px-3 py-1 text-xs dark:border-amber-900/30 dark:bg-amber-950/20">
      <div className="flex items-center gap-1.5">
        <Badge
          variant="secondary"
          className="h-4 bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
        >
          Beta
        </Badge>
        <span className="text-amber-700/80 dark:text-amber-300/70">
          Mail is in early beta
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-amber-600 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/50"
        onClick={() => setBannerVisible(false)}
      >
        <XIcon className="h-3 w-3" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
