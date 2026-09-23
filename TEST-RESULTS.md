# v0.5.5-beta test results

PASS: JavaScript syntax check.
PASS: All 13 existing extraction, source preservation, PNG/CRC, fetch failure/limit and fallback checks.
PASS: Protected-constructor simulation: removing either previous byte-copy fix reproduces the exception; the retained fixes pass.
PASS: Default-on normalization, exact requested separator output, all five character-text fields, untouched record/source props, preservation of code blocks, punctuation/emphasis and CRLF, and idempotence.
PASS: Both export modes round-trip through PNG chara metadata to identical JSON; decoded cards have CCv2 spec/version and required field types.
PASS: Native Messaging bridge sends only bytes/file type, accepts only clean/threat outcomes, and rejects unavailable companion errors. The exporter has no GM network/storage permissions, token, or loopback endpoint.
PASS: Framed Native Messaging host using the installed `clamscan` reports benign JSON clean, detects the EICAR test string, and rejects a non-PNG/JSON request.

Showdown 2.1.0 with SillyTavern core converter options renders each of these previously H2 passages as a paragraph:
1. You laugh. He doesn’t.
2. The realization hits like a sniper round: He’s not joking.
3. You hold him until his systems reset.

No heading tags remain in the normalized Nick greeting. Its other nonblank text lines remain identical and in the original order. The bundled fixture was used, not a new site capture.

Renderer sources checked during this task series:
- https://github.com/SillyTavern/SillyTavern/blob/release/package.json
- https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js

Test environment: Omarchy Linux 7.2.3-zen1-3-zen, Node.js 26.8.2, Python 3.14.7, and ClamAV 1.5.4. Firefox, Firefox Nightly, Tampermonkey, Windows, and macOS were not installed or tested in this release environment.

Limits: renderer-level testing only, without app extensions or custom CSS. No live SillyTavern import, Firefox Nightly/Tampermonkey execution, native-host registration, signed-XPI installation, portrait CORS request, or browser download verification. The Firefox test simulates constructor protection and the bridge test models page-message results; neither is a live browser-extension test. The included XPI is unsigned and not a permanently installable Firefox Release artifact.

Detailed machine-readable results are in tests/.
