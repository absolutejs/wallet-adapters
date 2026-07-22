# @absolutejs/wallet-stripe

Stripe Checkout funding and webhook normalization for `@absolutejs/wallet`.

The package publishes an AbsoluteJS Manifest contract 2 implementation of
`wallet/funding-adapter`, including its Stripe SDK and secret requirements, so
hosts can discover and wire it without maintaining a provider-specific
registry.

`toWalletFundingEvent()` bridges a verified normalized action into Wallet
0.7's atomic provider-event contract. The wallet store owns idempotency,
double-entry application, liability balances, dispute freezing, and reviewed
reactivation; the Stripe adapter never mutates host state itself.
`verifyAndNormalizeWebhook()` keeps the provider event type inside the adapter,
and Checkout returns only the stable hosted-session ID and URL rather than a
Stripe SDK object.

The adapter creates closed-loop funding Checkout sessions, verifies Stripe signatures,
and converts paid sessions, final refunds, disputes, and won disputes into stable,
idempotent wallet actions. It never mutates an application database: the host applies
the action through its wallet store in the same transaction and validates that the
provider identity belongs to the local owner.

Live marketplace funding should remain disabled until the payment provider has approved
the application model. A successful client redirect is never proof of payment; only a
verified webhook action may credit a wallet.
