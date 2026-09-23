# v0.5.1-beta: Firefox PNG byte-boundary fix

## Diagnosis
The original script has no explicit `.constructor` access. The leading suspects are implicit typed-array species lookups:

1. `sanitizedPNG`: `new Uint8Array(await blob.arrayBuffer())`, followed immediately by `parsePNG(out)` and its first `bytes.subarray(0, 8)` call.
2. `utf8`: `encoder.encode(s)` returns browser-owned bytes; `b64(utf8(json))` later calls `bytes.subarray(...)` while preparing chara metadata.

Firefox can protect the constructor of these cross-compartment views. Mozilla reports describe this exact exception and these patterns:
- https://bugzilla.mozilla.org/show_bug.cgi?id=1868675
- https://bugzilla.mozilla.org/show_bug.cgi?id=1681809

This is a likely diagnosis, not a confirmed live stack trace. With `@grant none`, the actual execution realm depends on the userscript manager and injection configuration. Astro extraction parses a DOM attribute string with JSON.parse and reconstructs ordinary objects; it is a weaker suspect for a PNG-only failure. Fetch chunks were already copied by concat into a new allocation.

## Fix
`localBytes` allocates a new Uint8Array by length and copies numeric bytes using indexed reads. Apply this at both TextEncoder and canvas Blob boundaries before any subarray call. It neither accesses a foreign constructor nor reuses the foreign backing buffer. Export errors now report the stage that failed.

No browser settings, privileges, unsafeWindow, injection settings, network policy, or CORS bypass were added. JSON, raw export, structured extraction, hidden-text fallback, UI, attribution, and license are retained. Only the version fields change in exported data.

## Verification and limits
- Node syntax check passes.
- All 13 existing checks pass: structured extraction, source preservation, whitespace/Unicode, the bundled Nick fixture's 18 character fields, PNG round-trip, independent chunk/CRC and image-data validation, malformed PNG rejection, fallback, and fetch failure/size handling.
- New firefox-boundary.cjs simulates a protected constructor on TextEncoder output and ArrayBuffer-backed views. Removing either corresponding fix fails with the target exception; both fixes together pass base64 conversion and a mocked-canvas PNG metadata round-trip.
- This simulation does not emulate Firefox Xray wrappers. No live Firefox/Tampermonkey reproduction, current portrait CORS check, real canvas conversion, browser download, or character-app import was performed. The Nick fixture is bundled historical data, not a fresh site capture.
- Prior package documentation and results are retained under historical-v0.5.0; they are not new verification claims.

## Install
Update the existing userscript with JannyAI-Character-Card-Exporter-v0.5.1-beta.user.js, reload the character page, select the portrait and export PNG. Avoid running both versions simultaneously. If it still fails, the displayed export stage and Firefox console stack trace will help locate the remaining boundary.

## Reproduce local checks
```
node --check JannyAI-Character-Card-Exporter-v0.5.1-beta.user.js
node tests/round-trip.cjs
node tests/firefox-boundary.cjs
```
