# @absolutejs/wallet-stripe

Stripe Checkout funding and webhook normalization for `@absolutejs/wallet`.

The adapter creates closed-loop funding Checkout sessions, verifies Stripe signatures,
and converts paid sessions, final refunds, disputes, and won disputes into stable,
idempotent wallet actions. It never mutates an application database: the host applies
the action through its wallet store in the same transaction and validates that the
provider identity belongs to the local owner.

Live marketplace funding should remain disabled until the payment provider has approved
the application model. A successful client redirect is never proof of payment; only a
verified webhook action may credit a wallet.
