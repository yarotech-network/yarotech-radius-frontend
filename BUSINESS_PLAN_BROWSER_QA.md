# Business subscription browser QA

Date: 7 September 2026. Target: local frontend at localhost:5173 and the running Django API, PostgreSQL, Chromium, and configured Paystack test account. No production deployment or real-money charge was performed.

## Results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Owner login and subscription page | PASS | Real QA account authenticated and saw no subscription. |
| Checkout initialization | PASS | Subscribe created a pending payment and opened Paystack hosted checkout. |
| Hosted payment completion and provider redirect | BLOCKED | Cloudflare security verification stopped automated Chromium before the payment form. No attempt was made to bypass it. |
| Confirmed-payment return | PASS | Previously confirmed local test payment displayed Payment confirmed and purchased allowances through the actual API. |
| Browser reload | PASS | Confirmation and subscription data remained visible. |
| Mobile layout | PASS | 390px viewport had no document horizontal overflow. |
| Verification failure and keyboard retry | PASS, injected failure | Browser interception presented a stale pending GET and one 503 verification response. Confirmation remained absent until Enter on Check now retried against the real verification API. |
| Duplicate verification | PASS | Two simultaneous real POST requests returned the same successful subscription. Database expiry was unchanged and exactly one period remained attached to the payment. |
| Anonymous return and login | PASS | Login was required; signing in retained the reference query and resumed pending-payment tracking. |
| Browser runtime errors | PASS | No page errors during confirmed-return, reload, mobile and retry scenarios. |

The existing confirmed payment was not reset or modified to simulate pending. Failure injection tested browser recovery only; actual provider failure and missing-webhook fulfillment were covered by the prior backend tests. This run does not establish live webhook delivery or an end-to-end hosted payment redirect.

## Cleanup

The temporary QA tenant and account were disabled, its password made unusable, and browser-test refresh sessions revoked. Temporary credential files were removed and Chromium closed. The uncompleted QA payment record remains as test history; existing customer subscriptions were preserved.

## Remaining manual check

In a normal browser, using the configured TEST Paystack account and a chosen QA workspace, subscribe and complete hosted checkout with the provider's official test details. Confirm the browser returns to Settings > Subscription, shows Payment confirmed and purchased allowances, and refreshing does not extend the subscription again. Use only the official test credentials from https://paystack.com/docs/payments/test-payments/. Production payment and deployment validation remain separate.
