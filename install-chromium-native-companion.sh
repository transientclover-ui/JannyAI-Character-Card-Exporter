#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --browser chrome|chromium --extension-id <32 lowercase a-p characters>" >&2
  exit 2
}

browser=''
extension_id=''
while (($#)); do
  case "$1" in
    --browser) browser=${2:-}; shift 2 ;;
    --extension-id) extension_id=${2:-}; shift 2 ;;
    *) usage ;;
  esac
done
[[ "$browser" == chrome || "$browser" == chromium ]] || usage
[[ "$extension_id" =~ ^[a-p]{32}$ ]] || usage
for command in python3 clamscan; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/jannyai-clamav-companion"
config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
case "$browser" in
  chrome) manifest_dir="$config_home/google-chrome/NativeMessagingHosts" ;;
  chromium) manifest_dir="$config_home/chromium/NativeMessagingHosts" ;;
esac
host_path="$install_dir/jannyai_clamav_host.py"
manifest_path="$manifest_dir/io.github.transientclover.jannyai_clamav.json"

install -d -m 700 "$install_dir" "$manifest_dir"
install -m 700 "$source_dir/native-host/jannyai_clamav_host.py" "$host_path"
python3 - "$host_path" "$manifest_path" "$extension_id" <<'PY'
import json
import sys

with open(sys.argv[2], 'w', encoding='utf-8') as destination:
    json.dump({
        'name': 'io.github.transientclover.jannyai_clamav',
        'description': 'JannyAI Character Card Exporter local ClamAV scanner',
        'path': sys.argv[1],
        'type': 'stdio',
        'allowed_origins': [f'chrome-extension://{sys.argv[3]}/']
    }, destination, indent=2)
    destination.write('\n')
PY
chmod 600 "$manifest_path"
printf 'Installed %s Native Messaging host manifest: %s\n' "$browser" "$manifest_path"
