# Test results — v0.5.0-beta

Tested on 2026-09-22. No extension was installed and nothing was published.

## Syntax and local tests: PASS

Both the complete userscript and the test runner pass `node --check` (Node.js 26.8.2). `node tests/round-trip.cjs` passes **13 test groups**. Exact results are in `tests/local-results.json`.

Coverage includes recursive Astro decoding, the real logged-out `[0]` wrapper, malformed/unsupported values, source UUID validation, empty/null fields, exact whitespace/Unicode preservation, all 18 actual Nick character fields, preserved additional metadata, structured-first selection, and legacy fallback with a visible diagnostic.

PNG tests write and independently parse a valid 1×1 image, verify PNG CRCs and decompressed pixels, require `IHDR` first, decode Base64 `chara`, and compare the resulting JSON exactly. Corrupt CRCs, metadata before IHDR, duplicate `chara`, and truncated files are rejected. Streamed image responses exercise success, HTTP failure, ambiguous network/CORS failure, empty response, and oversize rejection.

## Real browser APIs against the live portrait: PASS from localhost

The Codex in-app browser loaded a local test fixture at `http://127.0.0.1:8765`, containing Nick's exact captured props and the actual release userscript. A separate local test harness invoked the release's same extraction and PNG functions.

- Anonymous cross-origin `Image` load from `image.jannyai.com`: succeeded, 640 × 360.
- Canvas `getImageData`: succeeded; the tested canvas was not tainted.
- Canvas `toBlob('image/png')`: succeeded, 311,749 bytes.
- Release's ordinary credential-free CORS `fetch`: succeeded, 18,338 bytes of WebP.
- Release's `createImageBitmap` and canvas conversion: succeeded.
- Nick CCv2 PNG: 640 × 360, 366,732 bytes; `IHDR` first; embedded JSON matched exactly.
- Independent Python verification of the saved browser-generated PNG: all chunk CRCs valid; all 18 source character fields retained; the serialized props string matched the live capture exactly.

PNG chunk order was `IHDR`, `tEXt(chara)`, contiguous `IDAT` chunks, `IEND`. Evidence summary: `tests/browser-results.json`.

A separate public HTTP request with `Origin: https://jannyai.com` received HTTP 200 and `Access-Control-Allow-Origin: *`. This supports ordinary credential-free CORS access, but it is not a browser test under JannyAI's own page policies.

## Preserved UI: exercised in the local browser fixture

The real release script installed its floating button and opened the existing modal. Structured field lengths and creator appeared correctly. The portrait checkbox, preview, default structured portrait selection, PNG export action, Raw backup action, and JSON action were exercised. The PNG action completed metadata verification and initiated its download.

A simulated browser `fetch` rejection produced the message identifying CORS/site policy/network/extensions as possible causes without pretending to distinguish them. The controls remained usable, and unchecking the portrait option allowed the JSON action to complete validation and initiate its download. The modal layout was visually inspected.

The browser-generated PNG was separately saved from the local harness and parsed. Native OS file-save completion for each modal download action was not independently established.

## Not tested / not claimed

- Installation and full end-to-end operation in Tampermonkey on live JannyAI.
- Cross-origin requests and canvas execution from the actual `https://jannyai.com` browser origin; the supported browser evaluation interface is read-only, so execution was tested in the local fixture instead.
- Every possible character, browser, CSP configuration, or future Astro serializer type. Unsupported non-JSON wrappers trigger the documented fallback with original props retained.
- Third-party card-client import compatibility beyond CCv2 structure and PNG round-trip validation.
- JannyAI's original native PNG-download handler, antivirus scanning, or identity authentication of user-selected images.

No security protections or CORS settings were changed.
