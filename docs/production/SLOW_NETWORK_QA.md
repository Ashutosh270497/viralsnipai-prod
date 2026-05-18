# Slow Network QA

Use browser devtools or Playwright throttling against staging.

## Scenarios

- Sign in/sign up on Slow 3G and Fast 3G.
- Upload file with artificial throttling.
- Paste YouTube URL and wait for ingest.
- Generate clips for a short source.
- Save transcript changes.
- Queue export and poll status.

## Expected UX

- Buttons disable during in-flight mutations.
- Long operations show progress or "This may take a few minutes."
- Failed operations show retry guidance.
- Spinners never run forever without status.
- Duplicate clicks do not queue duplicate expensive jobs.
- Export polling recovers from temporary network errors.

## Pass Criteria

- User always knows whether the app is working, waiting, failed, or ready.
- No raw HTTP/stack errors are shown.
- Refreshing the page after long jobs recovers project/export state.
