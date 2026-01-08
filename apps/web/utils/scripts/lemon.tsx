"use client";

import { env } from "@/env";
import Script from "next/script";

type LemonSqueezyWindow = Window & {
  lemonSqueezyAffiliateConfig?: {
    store: string;
    debug?: boolean;
  };
  createLemonSqueezyAffiliate?: () => void;
};

export function LemonScript() {
  if (!env.NEXT_PUBLIC_LEMON_STORE_ID) return null;

  return (
    <Script
      src="/vendor/lemon/affiliate.js"
      defer
      onError={(e) => {
        console.error("Failed to load Lemon Squeezy affiliate script:", e);
      }}
      onLoad={() => {
        if (!window) return;
        const lemonWindow = window as LemonSqueezyWindow;
        lemonWindow.lemonSqueezyAffiliateConfig = {
          store: env.NEXT_PUBLIC_LEMON_STORE_ID,
          debug: true,
        };

        lemonWindow.createLemonSqueezyAffiliate?.();
      }}
    />
  );
}
