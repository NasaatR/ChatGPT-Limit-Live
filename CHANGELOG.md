# Changelog

## 1.8.0 — 2026-10-29

- Redesign Overview around allowance, saved resets and page-widget controls with a compact footer and clearer Refreshes in / Use by labels. Keep reset titles and exact expirations visible; move fallback/history explanations into History & help and remove unavailable-history clutter from hover.
- Replace the long settings surface with keyboard-accessible Widget, Colors, Hover, App and Backup categories. Keep navigation visible while scrolling, group color controls by purpose, and preview widget appearance using current allowance. Category changes flush/close the color editor; language changes preserve the selected category. Existing preference/import schemas stay compatible.
- Consolidate the shared stylesheet, removing superseded layouts and repeated overrides (about 29% less CSS); preserve circle/Pill geometry, dark neutrals, manual colors, drag bounds, tooltip bounds and reduced motion.
- Observe only the completion status of successful same-origin reset-consume requests. Emit a debounced refresh hint without reading/cloning bodies; bypass young usage/detail caches for an independent GET. Preserve backoff, account validation and normal polling. No reset is performed by the extension.
- Research: the native web-sidebar Work indicator was documented August 7, 2026. Inspect its rounded accessible percentage/menu and verify Manage usage reaches Settings → Usage in a signed-in browser. Do not infer decimal/server data from its ring or couple functionality to native labels.
- Validation: 157 automated cases and syntax checks. Built-in ChatGPT navigation was observed live; extension Chrome APIs/events remain mocked. Extension visual QA was blocked because the browser could not reach the local preview server; no live reset was consumed.

## 1.7.0 — 2026-10-23

- Replace the retired `/codex/settings/usage` destination with the current official `https://chatgpt.com/settings/usage`; label the action Open Usage and include a manual Settings → Usage fallback plus account/workspace guidance. Signed-in navigation remains unverified here.
- Compact hover details while preserving readable text, scheduled refresh countdown/date and freshness. Show banked-reset titles and full expiration dates directly on hover. Group identical offers, order by expiry, highlight deadlines within 48 hours and mark expired/missing/incomplete metadata.
- Show last account reset as unavailable: inspected schemas expose grant/expiration fields, not reset-use timestamps. Point to the desktop app’s banked-reset History; do not infer history from allowance changes.
- Recheck optional credit details once at a known expiry before the five-minute cache ends, without repeated expiry-triggered calls. Reuse bounded locale-specific date formatters.
- Align canonical repository links with the NasaatR account rename and add the small Made by Nasaat credit in Settings. Preserve existing settings and permissions.
- Validation: 151 automated cases plus syntax checks. DOM/Chrome/server boundaries are mocked; real Chrome visuals and live-account reset/navigation behavior remain unverified.

## 1.6.0 — 2026-10-17

- Show available-reset titles and expiration dates without a disclosure; include year/time zone and direct Usage links on reset cards and a compact Limits & resets button.
- Add a capsule-shaped remaining-allowance outline to Pill mode, with shared progress/track colors, stale/zero/full states and resize-aware geometry.
- Default number weight to Bold 700; migrate former standard weights while preserving explicit current choices. Keep v1.5 JSON imports compatible and restore their exact font weight.
- Move Track color directly below Show track, including inline editor autosave feedback, and slightly tighten popup spacing without reducing readable type.
- Reuse bounded Intl percentage formatters and sanitized snapshots; compare publication state/focus/badge instead of repeating payload serialization. Retain time-based freshness checks.
- Skip unchanged SVG writes; update Pill geometry only for size/stroke changes and disconnect its resize observer on shutdown.
- Validation: 143 automated cases plus syntax checks. Chrome visual/interaction and live-account reset integration remain unverified here.

## 1.5.0 — 2026-10-17

- Brighten percentage/progress defaults; use a 5 px arc, medium 500 weight, visible track and soft shadow. Migrate former standard values without losing manual colors or positions.
- Remove hide controls from both page circle and pill; keep visibility in the toolbar popup.
- Replace the compact dropdown with a 400 px Overview/Settings layout, larger controls, grouped paired fields, keyboard tabs and preserved section/scroll state on localization.
- Default to English; persist English/Russian/browser-language selection and apply it live to popup, percentage formatting and hover details.
- Redesign hover details with clearer hierarchy, larger text, explicit reset countdown/date and adjustable 12–20 px typography / 240–420 px width.
- Add versioned JSON export/import for all preferences, bounded strict validation, pending-edit flush, storage-error rollback and Undo import until the next manual edit. Backups exclude account/usage/session data.
- Dispose old color-editor key listeners during language changes and retain coalesced writes and in-place usage rendering.
- Validation: 129 automated cases plus syntax checks. Actual Chrome visual/interaction and native file download/import dialogs remain unverified here.

## 1.4.0 — 2026-10-17

- Default to 50 px with a 32–150 px range; migrate the previous default and clamp older custom sizes without resetting colors or placement.
- Darken the widget and popup with neutral ChatGPT-style grays and fit arc thickness to small circles.
- Replace the OS color picker with an inline editor: swatches, RGB, HEX, optional eyedropper, Done/Escape, per-color reset and visible autosave state.
- Autosave complete HEX input without blur; coalesce slider writes and flush the final edit on closing. Preserve rollback and visible errors on failed storage.
- Display server-provided banked reset counts and optional expiration details; distinguish unavailable data from zero.
- Cache optional reset details per account for five minutes, limit their request to three seconds, and preserve usage/counts when that request fails. Read-only: activation opens the official Usage page for review and confirmation.
- Validation: 113 automated cases plus syntax checks; actual Chrome UI/eyedropper and live-account reset integration remain unverified here.

## 1.3.0 — 2026-10-17

- Default to a 90 px dark percentage-only circle; move arc to the outer edge with no default track or shadow.
- Move window/reset/freshness details into a styled, bounded hover/focus tooltip with Escape dismissal and hover persistence.
- Add exact 48–320 px sizing, independent validated colors/HEX inputs, color presets, and separate color reset.
- Add manual arc width/caps, numeric scale/weight/decimals, background opacity, track/shadow/alerts, tooltip timing and 30–300 second polling.
- Replace the malformed settings glyph with a symmetric SVG cog.
- Migrate the former 148 px default while preserving other custom diameters; appearance reset preserves mode, placement, monitoring and usage.
- Render tooltip content only while open, retain in-place UI updates and coalesced pointer movement.
- Respect longer user-selected polling intervals in hidden tabs.
- Validation: 92 automated cases plus syntax checks. The redesigned UI is not target-verified in Chrome here.

## 1.2.0 — 2026-10-17

- Replace the floating card with a circular remaining-allowance meter.
- Drag from any free part of the circle or pill; keep buttons and keyboard controls usable.
- Add an immediately visible 96–240 px circle-size slider to the popup, with old-size migration.
- Update circle text and SVG attributes in place; coalesce pointer movement by animation frame and throttle generation-state DOM checks.
- Avoid unchanged toolbar repaint calls and serialize settings writes to prevent rapid-edit data loss.
- Preserve modes, themes, account isolation, polling, stale/error states and safe storage behavior.
- First publication to this repository, with a versioned ZIP and SHA-256 checksum in downloads/.
- Validation: 73 automated cases and syntax checks. New UI not target-verified in Chrome here.

## 1.1.0 — 2026-10-17

- Shared widget/popup design, persisted bounded dragging, panel/pill/icon-only modes.
- Per-tab and selected-source toolbar percentages, lifecycle-safe session snapshots and freshness checks.

## 1.0.0 — 2026-10-17

- Automatic server-backed Work/Codex allowance, duration-aware windows and account/workspace isolation.
