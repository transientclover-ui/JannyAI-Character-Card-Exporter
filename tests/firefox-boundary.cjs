'use strict';
// Deterministic model of protected constructor access, not a Firefox emulator.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const path = require('node:path');
const footer = '  install(); new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });';
function protectedView(v) {
  Object.defineProperty(v, 'constructor', { get() { throw Error('Permission denied to access property "constructor"'); } });
  return v;
}
function BrowserArray(arg, ...rest) {
  const v = new Uint8Array(arg, ...rest);
  return arg instanceof ArrayBuffer ? protectedView(v) : v;
}
BrowserArray.from = Uint8Array.from.bind(Uint8Array);
class BrowserEncoder { encode(s) { return protectedView(new TextEncoder().encode(s)); } }
async function run(source) {
  let closed = false;
  const context = {Uint8Array:BrowserArray, TextEncoder:BrowserEncoder, TextDecoder, Blob, btoa, atob,
    document:{createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob([base]))})},
    createImageBitmap:async()=>({width:1,height:1,close(){closed=true;}})};
  vm.runInNewContext(source.replace(footer,'globalThis.api = {utf8, b64, sanitizedPNG, parsePNG, embedAndVerify, chunk, concat, SIG, put32};'),context);
  const a=context.api;
  assert.equal(a.b64(a.utf8('Hello 🕵️')),Buffer.from('Hello 🕵️').toString('base64'));
  const ihdr=new Uint8Array(13);a.put32(ihdr,0,1);a.put32(ihdr,4,1);ihdr[8]=8;ihdr[9]=6;
  const base=a.concat(a.SIG,a.chunk('IHDR',ihdr),a.chunk('IDAT',zlib.deflateSync(Buffer.from([0,1,2,3,255]))),a.chunk('IEND',new Uint8Array()));
  const clean=await a.sanitizedPNG(base);
  assert(closed);
  const card={spec:'chara_card_v2',data:{name:'Unicode 🕵️',description:'  exact\r\n text  '}};
  assert.equal(a.parsePNG(a.embedAndVerify(clean,card)).card,JSON.stringify(card));
}
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../JannyAI-Character-Card-Exporter-v0.5.6-beta.user.js'),'utf8');
 // Remove each fix separately: both regression controls must fail.
 await assert.rejects(()=>run(source.replace('localBytes(encoder.encode(s))','encoder.encode(s)')),/Permission denied/);
 await assert.rejects(()=>run(source.replace('localBytes(new Uint8Array(await blob.arrayBuffer()))','new Uint8Array(await blob.arrayBuffer())')),/Permission denied/);
 await run(source);
 console.log('PASS: both unpatched boundary controls fail; patched encoding and mocked canvas metadata round-trip pass. Live Firefox/Tampermonkey not tested.');
})().catch(e=>{console.error(e);process.exitCode=1});
