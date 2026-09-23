'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const host = path.join(__dirname, '../native-host/jannyai_clamav_host.py');
const child = spawn('python3', [host], { stdio: ['pipe', 'pipe', 'pipe'] });
let buffered = Buffer.alloc(0);
const responses = [];
child.stdout.on('data', data => {
  buffered = Buffer.concat([buffered, data]);
  while (buffered.length >= 4) {
    const size = buffered.readUInt32LE(0);
    if (buffered.length < size + 4) return;
    responses.push(JSON.parse(buffered.subarray(4, size + 4).toString('utf8')));
    buffered = buffered.subarray(size + 4);
  }
});
function send(message) {
  const data = Buffer.from(JSON.stringify(message));
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(data.length);
  child.stdin.write(Buffer.concat([prefix, data]));
}
function next() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Native host did not respond.')), 35000);
    const check = () => {
      if (!responses.length) return setTimeout(check, 5);
      clearTimeout(timer);
      resolve(responses.shift());
    };
    check();
  });
}
(async () => {
  send({ fileType: 'json', data: Buffer.from('{"name":"safe character"}').toString('base64') });
  assert.deepEqual(await next(), { status: 'clean' });
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  send({ fileType: 'png', data: Buffer.from(eicar).toString('base64') });
  const threat = await next();
  assert.equal(threat.status, 'threat');
  assert.match(threat.threat, /Eicar/i);
  send({ fileType: 'path', data: Buffer.from('safe').toString('base64') });
  assert.deepEqual(await next(), { status: 'failed', message: 'Expected png or json file type.' });
  child.stdin.end();
  await new Promise((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(Error(`Host exited ${code}`))); });
  console.log('PASS: framed Native Messaging host scans clean data, detects EICAR, and rejects non-PNG/JSON requests.');
})().catch(error => { child.kill('SIGTERM'); console.error(error); process.exitCode = 1; });
