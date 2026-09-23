'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'chromium-companion');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const background = fs.readFileSync(path.join(extension, 'background.js'), 'utf8');
const bridge = fs.readFileSync(path.join(extension, 'bridge.js'), 'utf8');
const installer = path.join(root, 'install-chromium-native-companion.sh');
const extensionId = 'abcdefghijklmnopabcdefghijklmnop';

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['nativeMessaging']);
assert.deepEqual(manifest.host_permissions, ['https://jannyai.com/characters/*', 'https://www.jannyai.com/characters/*']);
assert.equal(manifest.background.service_worker, 'background.js');
assert.match(background, /sendNativeMessage/);
assert.match(background, /trustedSender/);
assert.match(bridge, /event\.origin !== location\.origin/);
assert.match(bridge, /sendMessage/);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'jannyai-chromium-native-test-'));
try {
  for (const browser of ['chrome', 'chromium']) {
    const result = spawnSync('bash', [installer, '--browser', browser, '--extension-id', extensionId], {
      cwd: root,
      env: { ...process.env, HOME: temporary, XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_DATA_HOME: path.join(temporary, 'data') },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    const manifestPath = path.join(temporary, 'config', browser === 'chrome' ? 'google-chrome' : 'chromium', 'NativeMessagingHosts', 'io.github.transientclover.jannyai_clamav.json');
    const registration = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(registration.name, 'io.github.transientclover.jannyai_clamav');
    assert.equal(registration.type, 'stdio');
    assert.deepEqual(registration.allowed_origins, [`chrome-extension://${extensionId}/`]);
    assert.equal(registration.path, path.join(temporary, 'data', 'jannyai-clamav-companion', 'jannyai_clamav_host.py'));
  }
  const invalid = spawnSync('bash', [installer, '--browser', 'chromium', '--extension-id', 'invalid'], { cwd: root, encoding: 'utf8' });
  assert.equal(invalid.status, 2);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log('PASS: Chromium MV3 companion validates JannyAI-only access and installs Chrome/Chromium Linux Native Messaging manifests with an allow-listed extension origin.');
