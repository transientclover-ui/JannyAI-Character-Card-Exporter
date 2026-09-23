# Firefox Native Messaging companion

This companion provides automatic local ClamAV scanning without a terminal command, local web server, token, or persistent service during ordinary exports.

## One-time installation

1. Install the **signed** JannyAI ClamAV Companion XPI in Firefox.
2. Extract this package and run:

   ```sh
   ./install-native-companion.sh
   ```

   The installer requires `python3` and `clamscan`. It copies the Native Messaging host into `~/.local/share/jannyai-clamav-companion/` and writes an allow-listed manifest to `~/.mozilla/native-messaging-hosts/`.
3. Reload the JannyAI character page. Enable **Scan exports locally with ClamAV before downloading** when desired.

Firefox starts the host for each opted-in scan. It sends PNG or JSON bytes over standard input to `clamscan --no-summary -`; no port is opened, no card pathname is accepted, and card content is neither executed nor uploaded. `clamscan` exit 0 is **No known threats detected**, exit 1 is **Threat detected**, and every other outcome is **Scanning failed** and blocks that download.

## Security boundary

The Firefox companion has content-script access only to `https://jannyai.com/characters/*` and `https://www.jannyai.com/characters/*`. Its background process independently checks the sender tab URL before it may call Native Messaging. The native-host manifest allow-lists exactly `jannyai-clamav-scanner@transientclover.github.io`; other extensions and websites cannot start it. There is no local HTTP service.

The userscript/content-script bridge uses same-origin page messages because userscripts cannot access Native Messaging directly. As with any userscript that reads a page, scripts executing in a trusted JannyAI page can request a scan while that page is open. They cannot reach the host from arbitrary origins, supply a filesystem path, execute content, or change a failed/threat result into a clean response within the extension/native-host boundary.

## Firefox signing

Firefox Release requires a signed XPI for permanent installation. The `JannyAI-ClamAV-Companion-v0.5.5.xpi` included in this beta is intentionally unsigned and is for review with Firefox Nightly/Developer Edition’s temporary add-on workflow only. It is **not** a permanently installable production release. A production release needs the same reviewed extension submitted for Mozilla signing (an unlisted signed distribution is sufficient); the native host remains entirely local.

This release environment did not have Firefox, Firefox Nightly, or Tampermonkey installed. Native-host registration and browser-extension installation have not been tested; only the host protocol and live local `clamscan` execution were tested on Linux.
