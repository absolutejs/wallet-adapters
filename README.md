# AbsoluteJS wallet adapters

Provider integrations for `@absolutejs/wallet`. Financial policy and double-entry
accounting remain in the wallet core; adapters normalize external provider events into
idempotent wallet actions.

## Stripe

`@absolutejs/wallet-stripe` provides Checkout funding, verified webhook normalization, refunds, and dispute actions while leaving balances, reservations, allowances, and double-entry policy in `@absolutejs/wallet`.

```sh
bun add @absolutejs/wallet @absolutejs/wallet-stripe stripe
```

See the package README for Checkout session creation, webhook signature verification, idempotency keys, refunds, disputes, and reconciliation.
