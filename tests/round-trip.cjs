'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const filename = path.join(__dirname, '../JannyAI-Character-Card-Exporter-v0.5.6-beta.user.js');
const source = fs.readFileSync(filename, 'utf8');
const footer = '  install(); new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });';
assert(source.includes(footer));
const sandbox = { TextEncoder, TextDecoder, Uint8Array, URL, Blob, AbortController, Response, TypeError,
  btoa, atob, setTimeout, clearTimeout, console,
  location: { href: 'https://jannyai.com/characters/4c785bd7-721e-47ce-bdd6-49f364a3d16a_character-test', pathname: '/characters/4c785bd7-721e-47ce-bdd6-49f364a3d16a_character-test' },
  document: { querySelectorAll: () => [] }
};
vm.runInNewContext(source.replace(footer, 'globalThis.testAPI = { decodeAstroProps, structuredRecord, harvest, split, clean, cardV2, parsePNG, embedAndVerify, imageBytes, signature, chunk, concat, SIG, crc32, get32, put32 };'), sandbox);
const a = sandbox.testAPI, results = [];
function check(name, fn) { fn(); results.push(name); }
function typed(value) {
  return Array.isArray(value) ? [1, value.map(typed)] : [0, value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typed(v)])) : value];
}
const c = { id: '4c785bd7-721e-47ce-bdd6-49f364a3d16a', creatorId: '08bbc627-6913-45ec-9e8e-73e0832fe5c5',
 name: ' Δ character 🕵️ ', description: '<p>Marketing &amp; HTML intro</p>', personality: '  exact\r\ntext\u00a0 \n\n\nScenario: literal content!  ',
 scenario: '', firstMessage: 'First Message: literal\n\n\n😀\r\n  ', exampleDialogs: 'Example Dialogs: literal\n \t',
 creatorName: 'Creator', tags: [{name: 'tag', id: 5}], extra: { preserve: [null, false, 0, ''] } };
const props = {character:c,imageUrl:'https://image.jannyai.com/portrait.webp'};
const serialized = JSON.stringify(Object.fromEntries(Object.entries(props).map(([k,v])=>[k,typed(v)])));
const decoded = a.decodeAstroProps(serialized);
const record = a.structuredRecord(decoded, {props:serialized,component:'/_astro/CharacterButtons.test.js'});
const card = a.cardV2(record, false);
check('Astro recursive primitive/object/array decode is lossless', ()=>assert.equal(JSON.stringify(decoded),JSON.stringify(props)));
check('Definition and HTML intro remain distinct; whitespace, Unicode and marker-like text unchanged', ()=>{
 assert.equal(card.data.description,c.personality); assert.equal(card.data.personality,'');
 assert.equal(card.data.scenario,c.scenario); assert.equal(card.data.first_mes,c.firstMessage); assert.equal(card.data.mes_example,c.exampleDialogs);
 assert(card.data.creator_notes.startsWith(c.description)); assert.equal(card.data.name,c.name);
});
check('All source fields and exact serialized props retained in CCv2', ()=>{
 assert.equal(JSON.stringify(card.data.extensions.jannyai_harvester.source_props),JSON.stringify(props));
 assert.equal(card.data.extensions.jannyai_harvester.source_props_serialized,serialized);
 assert.equal(card.data.extensions.jannyai_harvester.creator_id,c.creatorId);
});
check('Malformed and unsupported Astro values reject instead of being silently dropped', ()=>{
 for (const value of ['{"a":[99,"x"]}','{"a":[]}','{"a":[1,{}]}','[]','not json']) assert.throws(()=>a.decodeAstroProps(value));
 const undefinedProp=a.decodeAstroProps('{"userId":[0]}'); assert(Object.hasOwn(undefinedProp,'userId')); assert.equal(undefinedProp.userId,undefined);
});
check('Null source field is preserved with an explicit warning; missing and wrong UUID reject', ()=>{
 const nullable = a.structuredRecord({...props,character:{...c,scenario:null}},{props:serialized});
 assert.equal(nullable.scenario,''); assert(nullable.extraction_warnings.some(x=>x.includes('scenario'))); assert.equal(nullable.structured_props.character.scenario,null);
 assert.throws(()=>a.structuredRecord({...props,character:{...c,id:'00000000-0000-0000-0000-000000000000'}},{props:serialized}));
 const missing = {...c}; delete missing.firstMessage; assert.throws(()=>a.structuredRecord({...props,character:missing},{props:serialized}));
});
const ihdr = new Uint8Array(13); a.put32(ihdr,0,1); a.put32(ihdr,4,1); ihdr[8]=8; ihdr[9]=6;
const base = a.concat(a.SIG,a.chunk('IHDR',ihdr),a.chunk('IDAT',new Uint8Array(zlib.deflateSync(Buffer.from([0,255,0,128,255])))),a.chunk('IEND',new Uint8Array()));
const png = a.embedAndVerify(base,card);
check('PNG round-trip restores byte-exact card JSON, including Unicode and whitespace', ()=>assert.equal(a.parsePNG(png).card,JSON.stringify(card)));
check('Actual Nick Valentine props decode and all 18 character fields survive JSON/PNG export', ()=>{
 const capture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/nick-structured.json'),'utf8'));
 const captured=a.decodeAstroProps(capture.props);
 const r=a.structuredRecord(captured,{props:capture.props,component:capture.component});
 const actualCard=a.cardV2(r, false), actualPNG=a.embedAndVerify(base,actualCard);
 const recovered=JSON.parse(a.parsePNG(actualPNG).card);
 assert.equal(JSON.stringify(recovered.data.extensions.jannyai_harvester.source_props.character),JSON.stringify(captured.character));
 assert.equal(Object.keys(captured.character).length,18);
 assert.equal(recovered.data.extensions.jannyai_harvester.source_props_serialized,capture.props);
 for(const [dest,src] of Object.entries({name:'name',description:'personality',scenario:'scenario',first_mes:'firstMessage',mes_example:'exampleDialogs',creator:'creatorName'}))assert.equal(recovered.data[dest],captured.character[src]);
 assert.equal(recovered.data.extensions.jannyai_harvester.description_html,captured.character.description);
});
check('Independent PNG reader validates chunk order, CRCs, chara, image bytes and dimensions', ()=>{
 let pos=8; const types=[]; let recovered; const compressed=[];
 function crc(bytes) { let x=0xffffffff; for(const b of bytes){x^=b;for(let n=0;n<8;n++)x=(x>>>1)^((x&1)?0xedb88320:0);}return (x^0xffffffff)>>>0; }
 const b=Buffer.from(png);
 while(pos<b.length){const len=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8),data=b.subarray(pos+8,pos+8+len);
  assert.equal(b.readUInt32BE(pos+8+len),crc(b.subarray(pos+4,pos+8+len))); types.push(type);
  if(type==='tEXt'){assert.equal(data.subarray(0,6).toString(),'chara\0');recovered=Buffer.from(data.subarray(6).toString(),'base64').toString('utf8');}
  if(type==='IDAT')compressed.push(data);pos+=12+len;
 }
 assert.deepEqual(types,['IHDR','tEXt','IDAT','IEND']); assert.equal(recovered,JSON.stringify(card));
 assert.deepEqual(zlib.inflateSync(Buffer.concat(compressed)),Buffer.from([0,255,0,128,255]));
 assert.equal(a.parsePNG(png).width,1); assert.equal(a.parsePNG(png).height,1);
});
check('Corrupt CRC, metadata before IHDR, duplicate chara and truncated PNG reject', ()=>{
 const corrupt=new Uint8Array(png);corrupt[20]^=1;assert.throws(()=>a.parsePNG(corrupt));
 assert.throws(()=>a.parsePNG(png.subarray(0,png.length-1)));
 const meta=a.chunk('tEXt',new TextEncoder().encode('chara\0'+btoa('{}')));
 assert.throws(()=>a.parsePNG(a.concat(a.SIG,meta,base.subarray(8))));
 assert.throws(()=>a.parsePNG(a.concat(png.subarray(0,33),meta,png.subarray(33))));
 assert.throws(()=>a.embedAndVerify(png,card));
});
check('Legacy hidden-text fallback still works and reports structured failure', ()=>{
 const raw='Character Definition\nPersonality: legacy definition with enough text to exceed the payload threshold.\nScenario: location\nFirst Message: hello\nExample Dialogs: example';
 const parent={textContent:raw,parentElement:null}; const label={textContent:'Character Definition',parentElement:parent};
 const island={getAttribute:k=>({'component-export':'CharacterButtons','component-url':'/_astro/CharacterButtons.test.js',props:'invalid'}[k]),querySelectorAll:()=>[{textContent:'Download'}]};
 sandbox.document={querySelectorAll:selector=>selector==='astro-island[props]'?[island]:[label],body:{innerText:'Creator: creator'},querySelector:()=>({textContent:'Legacy'})};
 const fallback=a.harvest(); assert.equal(fallback.extraction_method,'hidden-text fallback'); assert.equal(fallback.first_mes,'hello'); assert.equal(fallback.source_islands[0].props,'invalid'); assert(fallback.extraction_warnings.length);
 island.getAttribute=k=>({'component-export':'CharacterButtons','component-url':'/_astro/CharacterButtons.test.js',props:serialized}[k]);
 const preferred=a.harvest();assert.equal(preferred.extraction_method,'astro-island props');assert.equal(preferred.scenario,'');assert.equal(preferred.first_mes,c.firstMessage);
});
async function main(){
 sandbox.fetch=async()=>new Response(new Uint8Array(base),{headers:{'content-length':String(base.length)}});
 assert.equal(Buffer.compare(Buffer.from(await a.imageBytes(props.imageUrl)),Buffer.from(base)),0);results.push('Native fetch reads bounded streamed bytes');
 sandbox.fetch=async()=>new Response('no',{status:403});await assert.rejects(()=>a.imageBytes(props.imageUrl),/HTTP 403/);
 sandbox.fetch=async()=>{throw new TypeError('Failed to fetch')};await assert.rejects(()=>a.imageBytes(props.imageUrl),/Possible causes include CORS/);
 sandbox.fetch=async()=>new Response('x',{headers:{'content-length':String(13*1024*1024)}});await assert.rejects(()=>a.imageBytes(props.imageUrl),/12 MiB/);
 sandbox.fetch=async()=>new Response(new Uint8Array(13*1024*1024));await assert.rejects(()=>a.imageBytes(props.imageUrl),/12 MiB/);
 sandbox.fetch=async()=>new Response('');await assert.rejects(()=>a.imageBytes(props.imageUrl),/empty/);
 results.push('HTTP failure, ambiguous network/CORS failure, empty and oversized responses reject accurately');
 assert(source.includes('jannyai-clamav-native-scan-v1')); assert(source.includes('// @grant        none')); results.push('Local scanner uses the Firefox Native Messaging companion bridge without userscript privileges');
 console.log(JSON.stringify({passed:results.length,tests:results},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
