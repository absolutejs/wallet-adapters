import { defineImplementation, defineManifest } from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";
import type { AdapterOptions } from "./index";

export const manifest = defineManifest<AdapterOptions>()({
  contract: 2,
  discovery: {
    audiences: ["agent-hosts", "commerce-platforms", "application-developers"],
    intents: [
      "fund a closed-loop agent wallet with Stripe Checkout",
      "verify Stripe wallet webhooks",
      "normalize wallet refunds and disputes",
    ],
    keywords: ["wallet", "stripe", "checkout", "funding", "webhook", "agent-spend"],
    protocols: ["HTTPS", "Stripe Webhooks"],
  },
  identity: {
    accent: "#635bff",
    category: "commerce",
    description: "Stripe Checkout funding and verified funding, refund, dispute, and dispute-reversal normalization for closed-loop AbsoluteJS wallets.",
    docsUrl: "https://github.com/absolutejs/wallet-adapters/tree/main/stripe",
    name: "@absolutejs/wallet-stripe",
    tagline: "Trust the signed event, not the redirect.",
  },
  implements: [
    defineImplementation<AdapterOptions>()({
      contract: "wallet/funding-adapter",
      factory: "createStripeWalletAdapter",
      from: "@absolutejs/wallet-stripe",
      requires: {
        env: [
          {
            description: "Stripe secret API key",
            docsUrl: "https://docs.stripe.com/keys",
            example: "sk_live_xxxxxxxxx",
            key: "STRIPE_SECRET_KEY",
            secret: true,
          },
          {
            description: "Signing secret for the exact wallet webhook endpoint",
            docsUrl: "https://docs.stripe.com/webhooks/signatures",
            example: "whsec_xxxxxxxxx",
            key: "STRIPE_WALLET_WEBHOOK_SECRET",
            secret: true,
          },
        ],
        peers: [
          {
            name: "@absolutejs/wallet",
            range: ">=0.7.0 <0.8.0",
            reason: "Closed-loop wallet policy and journal",
          },
          {
            name: "stripe",
            range: ">=22.3.2 <23.0.0",
            reason: "Stripe Checkout and signed webhook SDK",
          },
        ],
      },
      settings: Type.Object({}),
      title: "Stripe wallet funding",
      wiring: {
        code: "createStripeWalletAdapter({ stripe: new Stripe(${env.STRIPE_SECRET_KEY}), webhookSecret: ${env.STRIPE_WALLET_WEBHOOK_SECRET} })",
        imports: [
          { from: "@absolutejs/wallet-stripe", names: ["createStripeWalletAdapter"] },
          { from: "stripe", names: ["default as Stripe"] },
        ],
      },
    }),
  ],
  settings: Type.Object({}),
  wiring: [],
});
