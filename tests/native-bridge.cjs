'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../JannyAI-Character-Card-Exporter-v0.5.6-beta.user.js'), 'utf8');
const footer = '  install(); new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });';

function scanWith(result) {
  const listeners = new Set();
  let request;
  const window = {
    addEventListener(type, listener) { if (type === 'message') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'message') listeners.delete(listener); },
    postMessage(message, origin) {
      if (message.channel !== 'jannyai-clamav-native-scan-v1') return;
      request = message;
      setTimeout(() => {
        for (const listener of listeners) listener({ source: window, origin, data: { channel: 'jannyai-clamav-native-accept-v1', id: message.id } });
        for (const listener of listeners) listener({ source: window, origin, data: { channel: 'jannyai-clamav-native-result-v1', id: message.id, ...result } });
      }, 0);
    }
  };
  const sandbox = { TextEncoder, TextDecoder, Uint8Array, Blob, btoa, atob, setTimeout, clearTimeout, window,
    location: { origin: 'https://jannyai.com' }, crypto: { randomUUID: () => 'native-request-12345678' } };
  vm.runInNewContext(source.replace(footer, 'globalThis.api = { scanLocally };'), sandbox);
  return sandbox.api.scanLocally(new Uint8Array([1, 2, 3]), 'png').then(value => ({ value, request }));
}
(async () => {
  const clean = await scanWith({ status: 'clean' });
  assert.equal(clean.value.status, 'clean');
  assert.equal(clean.request.fileType, 'png');
  assert.equal(clean.request.data, 'AQID');
  const threat = await scanWith({ status: 'threat', threat: 'Eicar-Test-Signature' });
  assert.equal(threat.value.status, 'threat');
  await assert.rejects(() => scanWith({ status: 'failed', message: 'Native host unavailable' }), /Native host unavailable/);
  assert.match(source, /Firefox ClamAV Companion is unavailable/);
  assert.match(source, /@grant        none/);
  assert.doesNotMatch(source, /GM_xmlhttpRequest|127\.0\.0\.1|Bearer /);
  console.log('PASS: Native Messaging bridge transmits only bytes/file type, accepts clean/threat, and rejects unavailable companions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
