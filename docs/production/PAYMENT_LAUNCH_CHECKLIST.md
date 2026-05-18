# Payment Launch Checklist

Razorpay must be verified manually before V1 public launch.

## Test Mode

- [ ] Checkout opens from billing page.
- [ ] Successful payment activates the correct plan.
- [ ] Failed payment shows a friendly error.
- [ ] Cancelled payment leaves user on current plan.
- [ ] Webhook signature verification accepts valid events.
- [ ] Webhook signature verification rejects invalid signatures.
- [ ] Webhook retry does not duplicate subscription records.
- [ ] `subscriptionTier` updates after success.
- [ ] Usage limits change after plan activation.
- [ ] Invoice/receipt email is sent by Razorpay.

## Production Mode

- [ ] `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` are from the same live account.
- [ ] `RAZORPAY_KEY_SECRET` is live and stored only in production env.
- [ ] `RAZORPAY_WEBHOOK_SECRET` matches the production webhook.
- [ ] Webhook URL points to production domain.
- [ ] Plan IDs match current pricing.
- [ ] Support email is visible for billing failures.

Payment is not launch-ready until this checklist is completed on staging and production live keys are verified without charging unintended customers.
