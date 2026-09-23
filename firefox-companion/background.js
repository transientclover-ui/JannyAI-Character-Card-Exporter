'use strict';
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
browser.runtime.onMessage.addListener((request, sender) => {
  if (!trustedSender(sender) || !request || request.type !== REQUEST || !/^[a-zA-Z0-9_-]{8,128}$/.test(request.id || '') ||
      !['png', 'json'].includes(request.fileType) || typeof request.data !== 'string' || request.data.length > MAX_BASE64_BYTES) {
    return Promise.resolve({ status: 'failed', message: 'Invalid local scanner request.' });
  }
  return browser.runtime.sendNativeMessage(HOST, { fileType: request.fileType, data: request.data })
    .then(result => (result && ['clean', 'threat', 'failed'].includes(result.status) ? result : { status: 'failed', message: 'Native host returned an invalid result.' }))
    .catch(error => ({ status: 'failed', message: `Native host unavailable: ${error.message || error}` }));
});
