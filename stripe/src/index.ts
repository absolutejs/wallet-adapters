import { cents, steamLikeWalletPolicy, type WalletFundingEvent, type WalletPolicy } from "@absolutejs/wallet";
import type Stripe from "stripe";

export type StripeWalletMetadata = { userSub: string; ownerId: string };
export type StripeWalletAction =
  | { kind: "fund"; eventId: string; ownerId: string; userSub: string; amountCents: number; idempotencyKey: string; paymentRef: string }
  | { kind: "refund"; eventId: string; ownerId: string; userSub: string; amountCents: number; idempotencyKey: string; paymentRef: string; freeze: false }
  | { kind: "dispute"; eventId: string; ownerId: string; userSub: string; amountCents: number; idempotencyKey: string; paymentRef: string; freeze: true }
  | { kind: "dispute-reversal"; eventId: string; ownerId: string; userSub: string; amountCents: number; idempotencyKey: string; paymentRef: string; freeze: true }
  | { kind: "ignored"; eventId: string; reason: string };

export type FundingCheckoutInput = {
  amountCents: number;
  ownerId: string;
  userSub: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  productName?: string;
  description?: string;
  statement?: string;
  currency?: string;
};

type StripeClient = Pick<Stripe, "checkout" | "paymentIntents" | "webhooks">;
export type AdapterOptions = { stripe: StripeClient; webhookSecret: string; policy?: WalletPolicy };

const metadata = (raw: Stripe.Metadata | null | undefined): StripeWalletMetadata | null => {
  if (raw?.kind !== "wallet_funding") return null;
  const userSub = raw.user_sub?.trim(); const ownerId = raw.owner_id?.trim() || raw.player_id?.trim();
  return userSub && ownerId ? { userSub, ownerId } : null;
};

const paymentIntentId = (value: string | Stripe.PaymentIntent | null) => typeof value === "string" ? value : value?.id ?? null;

export const createStripeWalletAdapter = ({ stripe, webhookSecret, policy = steamLikeWalletPolicy }: AdapterOptions) => {
  const identityForIntent = async (value: string | Stripe.PaymentIntent | null) => {
    const intent = typeof value === "string" ? await stripe.paymentIntents.retrieve(value) : value;
    const identity = intent ? metadata(intent.metadata) : null;
    return identity && intent ? { ...identity, paymentIntentId: intent.id } : null;
  };

  const normalizeEvent = async (event: Stripe.Event): Promise<StripeWalletAction> => {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object; const identity = metadata(session.metadata);
        if (!identity || session.payment_status !== "paid") return { kind: "ignored", eventId: event.id, reason: "not a paid wallet funding session" };
        if (session.amount_total == null) throw new Error("Stripe wallet funding session has no total");
        const amountCents = cents(session.amount_total, "funding amount");
        if (amountCents < policy.minimumFundingCents || amountCents > policy.maximumTransactionCents) throw new Error("Stripe wallet funding amount is outside policy");
        const ref = paymentIntentId(session.payment_intent) ?? session.id;
        return { kind: "fund", eventId: event.id, ...identity, amountCents, idempotencyKey: `stripe:wallet:${session.id}`, paymentRef: ref };
      }
      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object;
        if (refund.status !== "succeeded") return { kind: "ignored", eventId: event.id, reason: "refund is not final" };
        const identity = await identityForIntent(paymentIntentId(refund.payment_intent));
        if (!identity) return { kind: "ignored", eventId: event.id, reason: "refund is unrelated to wallet funding" };
        return { kind: "refund", eventId: event.id, ...identity, amountCents: -cents(refund.amount, "refund amount"), idempotencyKey: `stripe:refund:${refund.id}`, paymentRef: refund.id, freeze: false };
      }
      case "charge.dispute.created": {
        const dispute = event.data.object; const identity = await identityForIntent(paymentIntentId(dispute.payment_intent));
        if (!identity) return { kind: "ignored", eventId: event.id, reason: "dispute is unrelated to wallet funding" };
        return { kind: "dispute", eventId: event.id, ...identity, amountCents: -cents(dispute.amount, "dispute amount"), idempotencyKey: `stripe:dispute:${dispute.id}:opened`, paymentRef: dispute.id, freeze: true };
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object;
        if (dispute.status !== "won") return { kind: "ignored", eventId: event.id, reason: "dispute did not return funds" };
        const identity = await identityForIntent(paymentIntentId(dispute.payment_intent));
        if (!identity) return { kind: "ignored", eventId: event.id, reason: "dispute is unrelated to wallet funding" };
        return { kind: "dispute-reversal", eventId: event.id, ...identity, amountCents: cents(dispute.amount, "dispute amount"), idempotencyKey: `stripe:dispute:${dispute.id}:won`, paymentRef: dispute.id, freeze: true };
      }
      default: return { kind: "ignored", eventId: event.id, reason: "event is unrelated to wallet funding" };
    }
  };

  return {
    async createFundingCheckout(input: FundingCheckoutInput) {
      const amountCents = cents(input.amountCents, "funding amount");
      if (amountCents < policy.minimumFundingCents || amountCents > policy.maximumTransactionCents) throw new Error("wallet funding amount is outside policy");
      const commonMetadata = { kind: "wallet_funding", user_sub: input.userSub, owner_id: input.ownerId, amount_cents: String(amountCents) };
      return stripe.checkout.sessions.create({
        mode: "payment", customer: input.customerId, client_reference_id: input.userSub,
        payment_method_types: ["card"], billing_address_collection: "required", customer_update: { address: "auto", name: "auto" },
        line_items: [{ quantity: 1, price_data: { currency: input.currency ?? policy.currency.toLowerCase(), unit_amount: amountCents, product_data: { name: input.productName ?? "Wallet deposit", description: input.description ?? "Closed-loop balance; not redeemable for cash." } } }],
        payment_intent_data: { description: input.statement ?? "Closed-loop wallet funding", metadata: commonMetadata }, metadata: commonMetadata,
        success_url: input.successUrl, cancel_url: input.cancelUrl, expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        custom_text: { submit: { message: "Funds stay inside this application and cannot be withdrawn or redeemed for cash." } },
      });
    },
    verifyWebhook: (payload: string, signature: string) => stripe.webhooks.constructEventAsync(payload, signature, webhookSecret),
    normalizeEvent,
  };
};

export type StripeWalletAdapter = ReturnType<typeof createStripeWalletAdapter>;

export const toWalletFundingEvent = (
  action: StripeWalletAction,
  accounts: { accountId: string; clearingAccountId: string },
): WalletFundingEvent | null => {
  if (action.kind === "ignored") return null;
  return {
    ...accounts,
    amountCents: Math.abs(action.amountCents),
    idempotencyKey: action.idempotencyKey,
    kind: action.kind === "fund" ? "funding" : action.kind,
    paymentRef: action.paymentRef,
  };
};
