# Research and implementation notes — 2026-10-17

## Existing implementations inspected

1. https://github.com/nvidiarogforce-art/chatgpt-usage-limits-tracker
   - MIT, Copyright 2026 Nizomiddin.
   - Inspected content.js (blob 14527dbe4ba2a3fc552e0700c9f24b2f9a7b2cca), background.js and LICENSE through the connected GitHub reader.
   - Uses /api/auth/session and /backend-api/wham/usage. Already polls from content.js every 45 seconds, so not every existing project requires manual refresh.
   - content.js assigns primary_window to a fixed five-hour structure and secondary_window to weekly. Defaults absent used_percent to zero. Its initial widget state contains example percentages. These patterns are unsuitable for this task's weekly-only and account-isolation requirements.
2. https://github.com/arkenapps/ArkenLimitMonitor-ChatGPT
   - MIT, Copyright 2026 Arken Apps.
   - Inspected main tree 93a838b8766f1349a61bdcee87ce14b55a274ed5; extension/content.js, extension/usage-parser.js, LICENSE.
   - Uses the same authenticated usage endpoint; supports automatic polling, normalization, settings and explicit stale/error states. Shows that session-backed read-only quota requests are an established integration approach.
3. https://chromewebstore.google.com/detail/gpt-meter-%E2%80%94-chatgpt-usage/ajjafikjekdalmagmofjeljndjbpoihd
   - Store description advertises live toolbar meters, Business support and EN/RU. Store claims are not independent verification of behavior or privacy. Its source was not inspected and code was not reused.

The user's installed extension was not supplied, so no conclusion identifies its exact bug. The primary/secondary issue above is a concrete issue in the inspected tracker, not a claim about the user's unidentified extension.

## Official references

- https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex
  Work/Codex share included allowance; applicable windows depend on plan. Ordinary Chat allowances can be separate. The supported UI is Settings → Usage.
- https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes
  Business Premium seats have no five-hour usage limit; do not equate all Business seats with the same limits.
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
  Isolated scripts, MAIN-world script declarations and origin-specific matching.
- https://developer.chrome.com/docs/extensions/reference/api/storage
  Local extension storage and permission.

## Decision

The key integration was established by reading existing working-source patterns, rather than inventing an endpoint or counting prompts. A compact original implementation was selected instead of inheriting either complete UI: this avoids local quota estimates, sample percentages, fixed slot-to-period assumptions, and globally shared current-account state. No third-party source files or assets are redistributed. Endpoint names, response schema and standard session/header patterns are interoperability facts, not a copied codebase.

## Data flow

The MAIN bridge reports only account-context hints and activity. Treat it as an untrusted hint source, never a provider of quotas or tokens. It cannot choose an arbitrary destination URL or issue privileged extension commands. A compromised first-party page could spoof activity/context hints and affect availability; the page already owns that session. The isolated script fetches the session, uses a session account ID or token account claim when no observed workspace header exists, fetches usage with that account header, and rechecks session identity before applying the result. Tokens are never bridged, stored or logged.

User/workspace keys are hashed before entering the bounded local cache. Startup does not display cache until a live session identity has been established. A short cache helps coordinate same-account tabs; identity invalidation prevents applying a former context's response to the new context. Appearance reset touches only appearance fields.

## Limits of evidence

The live endpoint was not queried with the user's credentials. Session schema, endpoint access, native request-header conventions, browser policy, UI integration and actual quota matching still require target validation. Request/session events are observed through fetch, not XHR or WebSocket. A context change not observed through fetch is picked up by later session checks when represented there; otherwise opening the profile/workspace view or reloading is the recovery path. Background tab throttling and server lag make a strict real-time guarantee inappropriate.

The extension never purchases resets, sends messages, modifies workspaces, or sends prompts. All its network operations are allowlisted same-origin GET requests.


## v1.4.0: banked resets and inline color controls — 2026-10-17

- **Adopt read-only server metadata.** OpenAI’s [Codex backend client](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets.rs) and [types](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/types.rs) expose `rate_limit_reset_credits.available_count`, a details GET at `/wham/rate-limit-reset-credits`, and separate consume POST operations. The extension reads summary/details only; it strips credit IDs and never makes consume requests. The internal API can change. No account-specific live response was inspected for this revision.
- **Use the official confirmation flow.** [How banked Codex resets work](https://help.openai.com/en/articles/20001498) describes account-dependent banked resets, including eligible Business users, expiration, and confirmation in Usage. [Paid weekly resets](https://help.openai.com/en/articles/20001507-paid-weekly-work-and-codex-rate-limit-resets) are a separate offer for eligible personal Plus/Pro accounts, not a banked balance for Business. Do not infer either eligibility or a positive count from the plan name. Activation stays in the official Usage page because it consumes a benefit and changes usage timing; the direct internal mutation is deliberately not added without live integration validation.
- **Replace the native color modal.** Existing controls used `input[type=color]` with change-only saving and no app-owned close action. The replacement is inline with coalesced input autosave, explicit Done/Escape, HEX, swatches and RGB. [EyeDropper.open](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper/open) is optional, feature-detected, user-triggered and abortable; RGB/HEX remain available. Native Chrome eyedropper behavior is not verified in this environment.


## v1.7.0: Usage route, expiry and reset history — 2026-10-23

- **Replace the obsolete route from current first-party source.** The user observed `/codex/settings/usage` returning to ChatGPT home. The current official [Codex status card](https://github.com/openai/codex/blob/f3a90545aed3188ee1e5c119ec89a742de399cdc/codex-rs/tui/src/status/card.rs) sets `CHATGPT_USAGE_URL` to `https://chatgpt.com/settings/usage`. This is the new shared target for the popup action and reset cards. Unauthenticated retrieval of this route redirects to ChatGPT home; that does not prove signed-in success or failure. The extension includes the documented manual Settings → Usage path and matching-account guidance. No signed-in navigation was performed in this environment.
- **Separate availability, expiration, refresh and history.** The current first-party [reset-credit types](https://github.com/openai/codex/blob/f3a90545aed3188ee1e5c119ec89a742de399cdc/codex-rs/backend-client/src/types.rs) contain `available_count`, `status`, `reset_type`, `granted_at`, `expires_at`, title and description. They do not define a redeemed/used timestamp. The [backend client](https://github.com/openai/codex/blob/f3a90545aed3188ee1e5c119ec89a742de399cdc/codex-rs/backend-client/src/client/rate_limit_resets.rs) exposes usage/details GETs separately from consume POSTs. Existing allowlisted reads stay unchanged.
- **Do not manufacture the last account reset.** OpenAI’s updated [How resets work in Codex](https://help.openai.com/en/articles/20001498-how-resets-work-in-codex) documents desktop Settings → Usage & billing → History for 30-day banked-reset activity. Received means granted, not used. Paid/global resets are excluded; changing the next reset date alone cannot identify reset use. The extension therefore displays an explicit unavailable last-reset field rather than grant dates or a guessed `reset_at - window` date. This is a limit of the inspected endpoints, not a claim that OpenAI has no reset history.
- **Compact without dropping deadlines.** Shared reset-card rendering supplies exact local dates with year/time zone to Overview and hover. Duplicate title/expiry pairs are grouped with a count, earliest dates come first, and deadlines within 48 hours are emphasized. Unknown/incomplete dates stay unknown, and expired records never silently change the server’s available count. A crossed cached expiry triggers one early optional-details recheck; the checked timestamp prevents a query loop when the server still returns an expired record. Existing five-minute caching/backoff and zero/missing-count request suppression remain.


## v1.8.0: native sidebar indicator and interface clarity — 2026-10-29

- **Announcement date, not per-account rollout date.** OpenAI’s [August 7, 2026 release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) explicitly describe remaining Work usage in the web sidebar for eligible personal/Business users. The [August 3–7 What's new entry](https://learn.chatgpt.com/docs/whats-new) corroborates it and states that Work/Codex share limits and credits. Neither source establishes the enablement date for an individual account.
- **Observed native UI.** In a signed-in ChatGPT web page, the sidebar button had `aria-label="Usage"`, an `aria-description` containing a rounded weekly remainder, and a ring using `pathLength="100"`/`stroke-dashoffset`. Clicking it exposed weekly remaining usage and Manage usage; the latter reached `https://chatgpt.com/settings/usage?tab=overview`. Account-specific percentages, reset dates, workspace identifiers and unrelated page content are not included here. DOM inspection does not identify the native network endpoint or establish higher precision. No reset was activated.
- **Keep independent quota validation.** The extension does not infer percentages from SVG geometry or accept DOM/page messages as a quota source. Its authenticated GET, before/after session identity checks and account-scoped cache continue to supply usage. Native UI presence is not a reason to weaken these boundaries or change polling without evidence. Toolbar only mode lets the existing native indicator and extension badge coexist without a second page widget.
- **Respond to a native reset without consuming one.** The already verified reset-consume path can be recognized by the MAIN fetch lifecycle wrapper. Only same-origin POST completion with `response.ok` emits a debounced `reset` hint; no JSON/body is read or cloned, and the original promise is returned unchanged. The isolated script treats this as a cache-refresh revision, never quota data. It performs its own GET, invalidates both young usage and optional-detail caches for that refresh, and preserves error backoff. Reset responses were mocked; there was no live consume request.
- **Reduce cognitive and source complexity.** Allowance refresh and saved-reset expiration use distinct labels. Actual reset title/expiration remains visible; unavailable last-reset explanations live under History & help. Settings categories show one panel at a time with persistent navigation, live appearance preview and grouped color fields. A single consolidated stylesheet replaces previous accumulated layouts/overrides. Settings schema and manual overrides are preserved.
- **Verification boundary.** Built-in navigation was observed in Chrome. The local test-page URL returned connection refused from the browser, so the redesigned extension was not visually verified. Existing mocked-boundary integration tests were expanded for category focus, color flush across categories, preview updates, reset lifecycle hints, cache invalidation and untrusted-hint/backoff behavior.
