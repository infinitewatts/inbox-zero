"use client";

import { env } from "@/env";
import Script from "next/script";

type LemonAffiliateWindow = Window & {
  lemonSqueezyAffiliateConfig?: {
    store: string;
    debug: boolean;
  };
  createLemonSqueezyAffiliate?: () => void;
};

export function LemonScript() {
  const storeId = env.NEXT_PUBLIC_LEMON_STORE_ID;
  if (!storeId) return null;

  return (
    <Script
      src="/vendor/lemon/affiliate.js"
      defer
      onError={(e) => {
        console.error("Failed to load Lemon Squeezy affiliate script:", e);
      }}
      onLoad={() => {
        if (!window) return;

        const lemonWindow = window as LemonAffiliateWindow;
        lemonWindow.lemonSqueezyAffiliateConfig = {
          store: storeId,
          debug: true,
        };

        lemonWindow.createLemonSqueezyAffiliate?.();
      }}
    />
  );
}
