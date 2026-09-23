# JannyAI Character Card Exporter v0.5.6-beta

Install `JannyAI-Character-Card-Exporter-v0.5.6-beta.user.js` in Tampermonkey in place of a previous exporter version, then reload the character page. Run only one exporter version.

## Optional local ClamAV scanning

Scanning is disabled by default. The exporter can scan CCv2 JSON, PNG cards, and raw JSON backups before downloading them when **Scan exports locally with ClamAV before downloading** is enabled.

After one-time companion installation, ordinary use is simply: enable scanning, export, and download after a clean result. Firefox, Chrome, and Chromium start the Native Messaging host automatically for each opted-in scan; there is no terminal launch, local web service, token, or recurring setup. See [NATIVE-COMPANION.md](NATIVE-COMPANION.md) for Firefox and [CHROMIUM-COMPANION.md](CHROMIUM-COMPANION.md) for Linux Chrome/Chromium registration and testing limits.

Results are explicit: **Not scanned**, **No known threats detected**, **Threat detected**, or **Scanning failed**. An unavailable companion, timeout, protocol error, missing ClamAV, or ClamAV failure never produces a clean result and prevents that export attempt from downloading. Users who do not install the companion or ClamAV can leave scanning off and continue exporting normally.

## Tested platforms and limitations

| Platform | Status |
|---|---|
| Omarchy Linux 7.2.3-zen1-3-zen, Node.js 26.8.2, Python 3.14.7, ClamAV 1.5.4 | Automated source, extraction, formatting, Native Messaging protocol, and live `clamscan` clean/EICAR tests passed. |
| Chromium 152.0.7977.82 on Linux | The MV3 companion loaded in a headless browser session. Its manifest and Chrome/Chromium installer are covered by automated tests. No live JannyAI/Tampermonkey export or Chromium native-host registration was tested. |
| Google Chrome, Firefox, Firefox Nightly, and Tampermonkey | Not installed or tested in this release environment. Firefox-specific tests are simulations, not browser-extension tests. |
| Windows and macOS | Not tested. |
| Firefox Native Messaging host registration and signed companion XPI | Not tested. The bundled companion XPI is unsigned and is **not** a permanently installable Firefox Release artifact. |

“Normalize formatting for SillyTavern” is now checked by default each time the dialog opens. JSON and PNG exports use the same normalized character text. Uncheck it if you need the previous formatting. Raw backup is always independent of this choice.

Standalone contiguous runs of three or more hyphens become `---` with a blank line above and below where adjacent content exists. Existing blank lines, paragraph breaks, line endings, wording, dialogue, punctuation within prose, and intentional emphasis are preserved. No AI rewriting or remote text processing is used.

Applies to description, personality, scenario, first_mes and mes_example. Source properties, raw backup data, and creator notes containing original HTML/provenance are untouched. Fenced code and indented code are skipped; inline hyphens, lists, quoted dividers and one/two-hyphen lines are unchanged. A three-or-more-hyphen Setext underline is ambiguous with a scene divider and is treated as a divider; other heading syntax remains unchanged.

The structured extractor, fallback extractor, portrait processing, metadata checks, and Firefox byte-copy fix are retained. No GM_xmlhttpRequest dependency or additional browser privileges.

See CHANGELOG.md and TEST-RESULTS.md. README-v0.5.1.md and historical-v0.5.0 retain earlier diagnosis/history, not current verification claims.

## Local tests
With Node.js, run from the extracted folder:
```
npm install --ignore-scripts --no-audit --no-fund
node --check JannyAI-Character-Card-Exporter-v0.5.5-beta.user.js
npm test
```
Showdown is a test-only dependency; the installed userscript has no added dependencies.
