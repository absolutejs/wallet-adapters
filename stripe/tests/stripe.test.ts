import { describe, expect, test } from "bun:test";
import { createStripeWalletAdapter } from "../src/index";
import { manifest } from "../src/manifest";
import type Stripe from "stripe";

const retrieved: Stripe.PaymentIntent = { id: "pi_wallet", object: "payment_intent", metadata: { kind: "wallet_funding", user_sub: "user:1", owner_id: "player:1" } } as unknown as Stripe.PaymentIntent;
const adapter = createStripeWalletAdapter({ webhookSecret: "whsec_test", stripe: {
  checkout: { sessions: { create: async (input: unknown) => ({ id: "cs_test", url: "https://checkout.test", input }) } } as never,
  paymentIntents: { retrieve: async () => retrieved } as never,
  webhooks: { constructEventAsync: async () => ({ id: "evt_verified" }) } as never,
} });
const event = <T extends Stripe.Event.Type>(type: T, object: unknown): Stripe.Event => ({ id: `evt_${type}`, type, data: { object }, livemode: false } as Stripe.Event);

describe("Stripe wallet adapter", () => {
  test("publishes a contract 2 funding implementation", () => {
    expect(manifest.contract).toBe(2);
    expect(manifest.implements).toEqual([
      expect.objectContaining({
        contract: "wallet/funding-adapter",
        factory: "createStripeWalletAdapter",
        from: "@absolutejs/wallet-stripe",
      }),
    ]);
  });
  test("normalizes paid checkout without trusting client callbacks", async () => {
    const action = await adapter.normalizeEvent(event("checkout.session.completed", { id: "cs_1", metadata: { kind: "wallet_funding", user_sub: "user:1", owner_id: "player:1" }, payment_status: "paid", amount_total: 500, payment_intent: "pi_wallet" }));
    expect(action).toMatchObject({ kind: "fund", ownerId: "player:1", amountCents: 500, idempotencyKey: "stripe:wallet:cs_1" });
  });
  test("normalizes final refunds once", async () => {
    const action = await adapter.normalizeEvent(event("refund.updated", { id: "re_1", status: "succeeded", amount: 125, payment_intent: "pi_wallet" }));
    expect(action).toMatchObject({ kind: "refund", amountCents: -125, idempotencyKey: "stripe:refund:re_1", freeze: false });
  });
  test("freezes on dispute and restores a won dispute", async () => {
    const opened = await adapter.normalizeEvent(event("charge.dispute.created", { id: "dp_1", amount: 500, payment_intent: "pi_wallet" }));
    const won = await adapter.normalizeEvent(event("charge.dispute.closed", { id: "dp_1", status: "won", amount: 500, payment_intent: "pi_wallet" }));
    expect(opened).toMatchObject({ kind: "dispute", amountCents: -500, freeze: true });
    expect(won).toMatchObject({ kind: "dispute-reversal", amountCents: 500, freeze: true });
  });
  test("ignores unrelated Stripe activity", async () => expect((await adapter.normalizeEvent(event("customer.subscription.updated", {}))).kind).toBe("ignored"));
});
