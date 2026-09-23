'use strict';
const api = globalThis.browser || globalThis.chrome;
const HOST = 'io.github.transientclover.jannyai_clamav';
const REQUEST = 'jannyai-clamav-native-scan-v1';
const MAX_BASE64_BYTES = 23 * 1024 * 1024;

function trustedSender(sender) {
  try {
    const url = new URL(sender.tab?.url || sender.url);
    return url.protocol === 'https:' && ['jannyai.com', 'www.jannyai.com'].includes(url.hostname) && url.pathname.startsWith('/characters/');
  } catch (_) {
    return false;
  }
}
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!trustedSender(sender) || !request || request.type !== REQUEST || !/^[a-zA-Z0-9_-]{8,128}$/.test(request.id || '') ||
      !['png', 'json'].includes(request.fileType) || typeof request.data !== 'string' || request.data.length > MAX_BASE64_BYTES) {
    sendResponse({ status: 'failed', message: 'Invalid local scanner request.' });
    return false;
  }
  api.runtime.sendNativeMessage(HOST, { fileType: request.fileType, data: request.data }, result => {
    const error = api.runtime.lastError;
    if (error) return sendResponse({ status: 'failed', message: `Native host unavailable: ${error.message}` });
    sendResponse(result && ['clean', 'threat', 'failed'].includes(result.status) ? result : { status: 'failed', message: 'Native host returned an invalid result.' });
  });
  return true;
});
