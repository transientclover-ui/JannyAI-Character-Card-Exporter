# Chrome and Chromium Native Messaging companion

The optional ClamAV toggle in the userscript is shared with Firefox. On Linux Chrome and Chromium use this MV3 companion; Firefox continues to use the separate Firefox companion described in [NATIVE-COMPANION.md](NATIVE-COMPANION.md).

## One-time Linux installation

1. Extract the beta archive and open the browser extension page:
   - Chrome: `chrome://extensions`
   - Chromium: `chromium://extensions`
2. Enable **Developer mode**, choose **Load unpacked**, and select the extracted `chromium-companion` directory.
3. Copy the 32-character extension ID displayed by the browser.
4. Register the same ID with the matching browser:

   ```sh
   ./install-chromium-native-companion.sh --browser chrome --extension-id YOUR_EXTENSION_ID
   # or
   ./install-chromium-native-companion.sh --browser chromium --extension-id YOUR_EXTENSION_ID
   ```

5. Reload the JannyAI character page, enable **Scan exports locally with ClamAV before downloading**, and export normally.

The installer requires Linux `python3` and `clamscan`. It copies the shared Native Messaging host into `~/.local/share/jannyai-clamav-companion/` and writes an allow-listed manifest to one of:

| Browser | Manifest directory |
|---|---|
| Chrome | `~/.config/google-chrome/NativeMessagingHosts/` |
| Chromium | `~/.config/chromium/NativeMessagingHosts/` |

The manifest allows only the extension origin shown in step 3. The host accepts PNG or JSON bytes only, never a filesystem path, uses no TCP listener, does not execute card content, and does not upload data.

## Testing scope

The MV3 companion loaded in headless Chromium 152.0.7977.82 on Linux. Its manifest, JannyAI-only sender checks, and Chrome/Chromium registration manifests are covered by automated tests. A live JannyAI/Tampermonkey export, native-host registration in Chromium, Google Chrome, Windows, and macOS have not been tested. This beta does not claim support for untested platforms.
