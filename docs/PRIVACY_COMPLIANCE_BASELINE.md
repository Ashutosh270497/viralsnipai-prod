# Privacy & Compliance Baseline

This document defines the operational privacy and compliance baseline for ViralSnipAI as implemented in the current codebase. It is intended to keep engineering, product, and public legal copy aligned.

It is **not** a claim of full GDPR, CCPA, ISO, or enterprise legal certification. It is the implementation baseline the product must follow.

## 1. Data Categories

### Account identity
- User email
- authentication identifiers
- selected niche / onboarding preferences
- subscription tier and billing state

### Connected account credentials
- OAuth tokens and refresh tokens for connected providers where required
- connected platform identifiers and usernames
- token expiry metadata

### User-provided media and project assets
- uploaded videos
- YouTube-ingested assets
- thumbnails, logos, watermark assets
- project-level files used in creator workflows

### Generated and derived content
- scripts, titles, thumbnails, hooks, content ideas
- transcripts, transcript translations, caption files
- SnipRadar drafts, replies, remixes, research captures, relationship notes

### Billing and reconciliation data
- Razorpay customer/subscription identifiers
- billing cycle and subscription status
- webhook event records required for reconciliation and debugging

### Operational and usage telemetry
- usage logs
- per-feature credit consumption
- job status metadata
- error and processing diagnostics needed to operate the platform

## 2. Third-Party Processors

The current implementation may use these processors or provider categories:

- Supabase
- Vercel
- OpenRouter and routed model providers
- OpenAI direct APIs where a workflow still uses them
- Google APIs
- X
- Razorpay
- storage backends such as local storage, Supabase Storage, or S3-compatible object storage

Provider usage must remain limited to the scopes and APIs required for the enabled workflows.

## 3. Retention Baseline

### Active accounts
- Account records, project data, generated content, and connected-provider metadata are retained while the account remains active.

### User-managed content
- Uploaded assets and generated outputs remain available until the user deletes them, the related project is deleted, or account-removal cleanup is executed.

### Billing and webhook records
- Billing metadata and webhook event logs may be retained after cancellation where required for reconciliation, fraud prevention, tax, and operational audit trails.

### Temporary processing files
- Temporary FFmpeg, transcription, and voice-translation working files should be cleaned up on a best-effort basis after job completion or failure.
- The product must not assume temporary cleanup is perfect; cleanup may also happen asynchronously.

## 4. Deletion and Account Removal Behavior

### User-initiated deletion requests
- Account deletion requests should remove or schedule removal of account-linked product data that is not required to be retained for billing, fraud, or reconciliation.

### Immediate deletion targets
- session and connected-provider access for the current account
- product access for the deleted account
- user-visible content where direct deletion is supported by the workflow

### Data that may be retained longer
- webhook event logs
- billing identifiers and transaction-linked records
- limited operational logs required for abuse prevention, reconciliation, or incident review

### Asynchronous cleanup
- storage assets
- temporary processing files
- derived background-job artifacts

Account-removal behavior should be described as **best-effort plus asynchronous cleanup**, not as an instantaneous guarantee across every backing service.

## 5. Consent and Connected Account Behavior

- Google, X, and other provider connections are user-initiated.
- Tokens are used only for the product workflows the user enables.
- If a user revokes access on the provider side or a token expires permanently, the product should require re-authentication.
- Read-only/manual fallback flows should avoid storing elevated credentials where they are not needed.

## 6. Operational Boundaries

- This baseline is the product-operating contract for implementation and documentation alignment.
- It does not replace formal legal review or enterprise compliance work.
- If a feature needs stronger regulatory treatment, that feature must add a more specific policy and data-handling review before launch.
