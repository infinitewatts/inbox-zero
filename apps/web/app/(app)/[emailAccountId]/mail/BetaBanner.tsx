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
    <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Beta
        </Badge>
        <span className="text-muted-foreground">
          Mail is in beta and not intended as a full email client replacement
          yet.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => setBannerVisible(false)}
      >
        <XIcon className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
