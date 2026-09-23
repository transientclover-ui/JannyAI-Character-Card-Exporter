# JannyAI Character Card Exporter v0.5.0-beta

By **transientclover** · MIT license · based on the supplied v0.4.1-beta userscript.

Install the complete `JannyAI-Character-Card-Exporter-v0.5.0-beta.user.js` in Tampermonkey as the replacement for the previous version. Keep only one version enabled, then reload the character page. This package has not been published to Greasy Fork.

Use **Export Real Card** to open the existing exporter dialog. JSON and Raw backup work without a portrait request. Enable the portrait checkbox for PNG export; the structured portrait URL is selected initially and you can still choose a different image using the preview and selector.

## Changes

- Read the native Download button's `astro-island[props]` first; decode Astro primitives, nested objects, arrays, null, and `[0]` (undefined). The component hash is not hardcoded. Match the character UUID to the page.
- Preserve source strings exactly, including HTML, CR/LF, blank lines, trailing spaces, Unicode, and template placeholders. Do not split structured fields on labels inside character text.
- Preserve the existing hidden-text extractor as an explicitly reported fallback. It retains its earlier whitespace normalization. Unknown non-JSON Astro types cause fallback instead of guessed conversion; the original props are retained.
- Use ordinary credential-free CORS `fetch`, bounded streaming, `createImageBitmap`, and canvas PNG encoding. No `GM_xmlhttpRequest`, `@connect`, third-party proxy, or external script dependencies.
- Keep the existing UI, raw backup, JSON export, portrait selector, signature checks, size/dimension limits, CRC validation, and PNG read-back verification. Portrait-request errors leave JSON export available.
- Write Base64-encoded UTF-8 CCv2 JSON in a `tEXt` chunk named `chara`, immediately after `IHDR`. Parse the finished PNG and compare its embedded JSON exactly before initiating a download.

## Field mapping

| Structured source | Export destination |
|---|---|
| `character.name` | `data.name` |
| `character.personality` | `data.description` — the actual character definition |
| `character.description` | HTML introduction retained unchanged at the start of `data.creator_notes`, and in the source extension |
| `character.scenario` | `data.scenario` |
| `character.firstMessage` | `data.first_mes` |
| `character.exampleDialogs` | `data.mes_example` |
| `character.creatorName` | `data.creator`; matching profile-link text is a reported fallback |
| `character.creatorId` | `data.extensions.jannyai_harvester.creator_id` |
| `character.id` | `data.extensions.jannyai_harvester.source_uuid` |
| `imageUrl` | Portrait default and `data.extensions.jannyai_harvester.image_url` |
| `character.tags[].name` | `data.tags`; original tag objects also retained |

As in the previous exporter, CCv2 `data.personality` is an empty string because the complete definition is already in `data.description`. This avoids duplicating the same definition in the prompt. The source's separate HTML introduction is not used as that definition.

Every source character field, including fields without a CCv2 equivalent, remains in `data.extensions.jannyai_harvester.source_props`. The original `props` attribute string is in `source_props_serialized` and the component snapshots in `source_islands`; these preserve even undefined wrappers that ordinary JSON omits. Raw backup also retains these properties and the legacy hidden-text capture when available. Fields are not silently replaced by cleaned hidden text.

## Validation and limits

See `TEST-RESULTS.md` and `NICK-COMPARISON.md`. Local tests pass, including actual captured Nick properties and real cross-origin image/canvas conversion from a local test page. **No claim is made that this release has been installed and tested in Tampermonkey on live JannyAI.** Page policies and extensions can differ from the tested local origin.

Portrait requests have a 20-second timeout and a 12 MiB input limit; decoded dimensions must be at most 4096 on either side and at most 16 million pixels. PNG output is a new encoding; original image metadata is not copied. A failed `fetch` does not reveal whether CORS, network conditions, site policy, or an extension caused the failure, so the error lists those possibilities. There is no security bypass or `no-cors` retry.

Run the dependency-free local checks with Node.js:

```sh
node --check JannyAI-Character-Card-Exporter-v0.5.0-beta.user.js
node --check tests/round-trip.cjs
node tests/round-trip.cjs
```

The package contains a public character-props fixture for reproducibility, not authentication cookies or tokens. The fixture's top-level `userId` is Astro's undefined marker `[0]`.

Format reference: [Character Card V2 specification](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md).
