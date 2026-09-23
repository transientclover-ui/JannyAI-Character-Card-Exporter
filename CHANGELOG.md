# v0.5.5-beta

- Replace the manual loopback helper/token workflow with an automatic Firefox Native Messaging companion.
- Add the one-time native-host installer, Firefox companion extension source, and XPI review artifact. Firefox starts the host only when an opted-in export needs scanning.
- Remove the local TCP listener and user-managed bearer token entirely.
- Restrict the companion content bridge to JannyAI character pages, validate sender tabs in the extension background, and allow-list the companion extension in the native-host manifest.
- Retain default-off scanning and clean/threat/failure download blocking semantics.

# v0.5.4-beta

- Add an optional, default-off local ClamAV scan before JSON, PNG, and raw JSON downloads.
- Add the separate token-authenticated loopback helper (`clamav-helper.mjs`); it streams bytes to local `clamscan`, accepts no caller-provided paths, and exposes no unauthenticated scanning endpoint.
- Report exactly whether an export was not scanned, had no known threats detected, had a detected threat, or failed scanning. Threats and failures block the download rather than being reported clean.
- Add legacy and modern Tampermonkey GM request support and explicit unavailable-API failures for Firefox Nightly compatibility.
- Add client and real-`clamscan` integration tests, including EICAR detection and unavailable-scanner failure handling.

# v0.5.3-beta

- Enable conservative SillyTavern normalization by default for CCv2 JSON and PNG.
- Canonicalize standalone repeated-hyphen scene dividers to `---`, separated from narration by blank lines.
- Preserve source backups, source extensions, prose, emphasis, and existing paragraph breaks.
- Retain the formatting checkbox as an opt-out, the Firefox constructor fix, and all existing extraction and portrait features.
- Add explicit checks for all three oversized Nick narration passages and decoded CCv2 fields.

Not published to Greasy Fork or elsewhere.
