'use strict';
const api = globalThis.browser || globalThis.chrome;
const REQUEST = 'jannyai-clamav-native-scan-v1';
const ACCEPT = 'jannyai-clamav-native-accept-v1';
const RESULT = 'jannyai-clamav-native-result-v1';
const MAX_BASE64_BYTES = 23 * 1024 * 1024;

window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const request = event.data;
  if (!request || request.channel !== REQUEST || !/^[a-zA-Z0-9_-]{8,128}$/.test(request.id || '') ||
      !['png', 'json'].includes(request.fileType) || typeof request.data !== 'string' || request.data.length > MAX_BASE64_BYTES) return;
  window.postMessage({ channel: ACCEPT, id: request.id }, location.origin);
  api.runtime.sendMessage({ type: REQUEST, id: request.id, fileType: request.fileType, data: request.data }, result => {
    const error = api.runtime.lastError;
    window.postMessage({ channel: RESULT, id: request.id, ...(error ? { status: 'failed', message: `Companion extension failed: ${error.message}` } : result) }, location.origin);
  });
});
