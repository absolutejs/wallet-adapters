import { defineManifest } from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";

export const manifest = defineManifest<Record<never, never>, Record<never, never>>()({
  contract: 1,
  identity: {
    accent: "#635bff",
    category: "commerce",
    description: "Stripe Checkout funding and verified funding, refund, dispute, and dispute-reversal normalization for closed-loop AbsoluteJS wallets.",
    docsUrl: "https://github.com/absolutejs/wallet-adapters/tree/main/stripe",
    name: "@absolutejs/wallet-stripe",
    tagline: "Trust the signed event, not the redirect.",
  },
  settings: Type.Object({}), slots: {}, tools: {}, wiring: [],
});
