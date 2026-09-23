# Privacy Policy

**Effective date: September 22, 2026**

JannyAI Character Card Exporter is a local browser userscript. This policy describes the exporter and its optional JannyAI ClamAV Companion extensions and Native Messaging host. It does not describe JannyAI, Tampermonkey or another userscript manager, your browser, ClamAV, image hosts, or any service those products provide.

## Data the software handles

To produce an export, the exporter reads the character information available in the JannyAI character page. Depending on the export you choose, this can include character names and metadata; description, personality, scenario, greeting, and example-message text; creator notes and source properties; raw character JSON; and the selected portrait image. The software also uses the current JannyAI character-page URL to operate on the supported page.

## Local processing and exports

Export creation, formatting normalization, character-card construction, and portrait processing occur in the browser. The exporter can retrieve a page-selected portrait image to include it in a PNG card; that request goes to the image's existing source as needed to create the export, not to this project's operator. The finished JSON, PNG, or raw JSON backup is downloaded through your browser and is retained according to your browser and device settings. The exporter does not operate a project server or store exported cards.

## Optional local ClamAV scanning

Scanning is disabled by default. If you enable **Scan exports locally with ClamAV before downloading**, the selected JSON or PNG export is sent only through the following local Native Messaging flow:

1. The exporter sends the selected export's bytes and its type (`json` or `png`) to the companion's same-origin content-script bridge on the open JannyAI character page.
2. The Firefox, Chrome, or Chromium companion verifies that the request comes from an HTTPS `jannyai.com` or `www.jannyai.com` `/characters/` tab, then sends those bytes to the locally registered Native Messaging host.
3. The host supplies the bytes to the locally installed `clamscan` program over standard input. It accepts no caller-provided file path, opens no network port, and does not execute card content.
4. The host returns only a scan status (`clean`, `threat`, or `failed`), and a detected threat name when ClamAV reports one. A failed or unavailable scan does not produce a clean result and blocks that download attempt.

The scan data is handled in memory and through the local `clamscan` process for that request. The Native Messaging host does not save card contents, scan requests, or scan results. Its installer stores only the host program and browser registration manifest on your device; it does not store character data.

## No remote uploads, analytics, or tracking

The exporter, companion extensions, and Native Messaging host do not upload character data, card images, scan data, scan results, or identifiers to the project operator or another analytics provider. They do not include analytics, telemetry, advertising, tracking pixels, or a remote scanning service. Native Messaging uses local standard input/output between the browser and the installed host; it is not an Internet connection.

## Firefox and Chromium companions

Both companions are restricted to JannyAI character pages and use Native Messaging only after an opted-in scan request. The Firefox host manifest allow-lists the companion's Firefox extension ID. The Chrome/Chromium host manifest allow-lists the installed companion's Chrome extension origin. This limits which extension can start the local host, but it does not change the browser's, JannyAI's, ClamAV's, or any image host's own data practices.

## Scope and limitations

This policy covers the software distributed in this repository. It does not cover data you provide to or that is independently collected by JannyAI, a userscript or browser-extension manager, your browser, operating system, ClamAV, downloaded files, or external image sources. Those services and tools may retain data or make network requests under their own policies and configuration. Review their documentation and privacy policies before use.
