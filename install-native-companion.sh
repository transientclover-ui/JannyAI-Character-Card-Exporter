#!/usr/bin/env bash
set -euo pipefail

for command in python3 clamscan; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/jannyai-clamav-companion"
manifest_dir="$HOME/.mozilla/native-messaging-hosts"
host_path="$install_dir/jannyai_clamav_host.py"
manifest_path="$manifest_dir/io.github.transientclover.jannyai_clamav.json"

install -d -m 700 "$install_dir" "$manifest_dir"
install -m 700 "$source_dir/native-host/jannyai_clamav_host.py" "$host_path"
python3 - "$host_path" "$manifest_path" <<'PY'
import json
import sys

with open(sys.argv[2], 'w', encoding='utf-8') as destination:
    json.dump({
        'name': 'io.github.transientclover.jannyai_clamav',
        'description': 'JannyAI Character Card Exporter local ClamAV scanner',
        'path': sys.argv[1],
        'type': 'stdio',
        'allowed_extensions': ['jannyai-clamav-scanner@transientclover.github.io']
    }, destination, indent=2)
    destination.write('\n')
PY
chmod 600 "$manifest_path"
printf 'Installed Native Messaging host manifest: %s\n' "$manifest_path"
printf 'Install the signed JannyAI ClamAV Companion XPI in Firefox, then reload JannyAI.\n'
